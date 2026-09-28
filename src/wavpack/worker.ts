// .wv 解码 Worker：HTTP Range 拉流 + 增量块索引 + 插值探测 seek + 流式解码。
// 消息协议见 worker-protocol.ts；消费方以
// `new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })` 创建，
// Vite 自动打包（含 @audio/decode-wavpack 的 ESM+wasm，无静态资产）。
// 协议处理与 self.postMessage 解耦：工厂注入 post，node/bun 下可驱动冒烟。
import { decoder } from '@audio/decode-wavpack';
import { parseBlockHeader } from './block-header';
import {
  appendEntry,
  createIndex,
  findBlockAt,
  type IndexEntry,
} from './block-index';
import { locateBlock } from './probe-seek';
import { RangeFetcher } from './range-fetcher';
import type { WorkerCmd, WorkerMsg } from './worker-protocol';

const PROBE_BYTES = 64; // load 首块头探测：Range bytes=0-63
const CHUNK_BYTES = 64 * 1024; // 拉流循环每步读取量
const ERROR_UNSUPPORTED = '该文件为不受支持的 WavPack 文件或已损坏';

export type PostFn = (msg: WorkerMsg, transfer?: Transferable[]) => void;
export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

/** RangeFetcher/fetch 异常 → NETWORK；其余（decoder 内部）→ DECODE */
function fetchLikeError(e: unknown): 'DECODE' | 'NETWORK' {
  return /RangeFetcher|HTTP \d{3}/.test(String(e)) ? 'NETWORK' : 'DECODE';
}

type WavDecoder = Awaited<ReturnType<typeof decoder>>;

interface Session {
  fetcher: RangeFetcher;
  dec: WavDecoder;
  index: ReturnType<typeof createIndex>;
  /** 下一字节读取位置（续拉/seek 复用） */
  pos: number;
  fileSize: number;
  /** 0 = 未知（流式编码产物）：duration 粗估、seek 禁用 */
  totalSamples: number;
  sampleRate: number;
  channels: number;
  /** 已向主线程投递到的输出帧位置（pcm.startSample 连续计数） */
  outputSample: number;
  /** seek 重建后待裁剪的帧数（从组首块输出裁到目标 sample） */
  trimPending: number;
  /** 缓存首块 PCM（play(0) 快路径；投递后置 null） */
  firstPcm: Float32Array[] | null;
  firstBlockSize: number;
  /** ended 已发出：之后 resume 不再重复推送 */
  ended: boolean;
}

export interface WavpackWorkerController {
  handle(cmd: WorkerCmd): void;
}

export function createWavpackWorker(
  post: PostFn,
  fetchFn: FetchFn = (...args) => fetch(...args),
): WavpackWorkerController {
  let session: Session | null = null;
  // gen 指令代数：每条指令 +1；旧指令的异步结果发现 gen 不符即静默丢弃
  let gen = 0;
  let playing = false;

  function fail(code: 'DECODE' | 'NETWORK', message: string): void {
    post({ type: 'error', code, message });
  }

  function teardown(): void {
    session?.fetcher.abort();
    session?.dec.free();
    session = null;
  }

  function handle(cmd: WorkerCmd): void {
    gen++;
    switch (cmd.type) {
      case 'load':
        playing = false;
        void doLoad(cmd.url, gen);
        break;
      case 'play':
        playing = true;
        void doPlay(cmd.fromSample, gen);
        break;
      case 'pause':
        // decoder/索引/session 保留，仅停止拉流推送
        playing = false;
        break;
      case 'stop':
        playing = false;
        teardown();
        break;
    }
  }

  async function doLoad(url: string, myGen: number): Promise<void> {
    if (session) teardown();
    try {
      // 首块头探测：顺便从 Content-Range 拿 fileSize（locateBlock 依赖）
      const probe = await fetchFn(url, {
        headers: { Range: `bytes=0-${PROBE_BYTES - 1}` },
      });
      if (myGen !== gen) return;
      if (!probe.ok) {
        fail('NETWORK', `HTTP ${probe.status}`);
        return;
      }
      const head = new Uint8Array(await probe.arrayBuffer());
      if (myGen !== gen) return;
      const h = parseBlockHeader(head, 0);
      if (!h) {
        fail('DECODE', ERROR_UNSUPPORTED);
        return;
      }
      const fetcher = new RangeFetcher(url, fetchFn);
      const firstBlock =
        head.length >= h.blockSize ? head : await fetcher.read(0, h.blockSize);
      if (myGen !== gen) {
        fetcher.abort();
        return;
      }
      let dec: WavDecoder;
      try {
        dec = await decoder();
      } catch (e) {
        fetcher.abort();
        fail('DECODE', String(e));
        return;
      }
      if (myGen !== gen) {
        fetcher.abort();
        dec.free();
        return;
      }
      let first: ReturnType<WavDecoder['decode']>;
      try {
        first = dec.decode(firstBlock);
      } catch (e) {
        fetcher.abort();
        dec.free();
        fail('DECODE', String(e));
        return;
      }
      const ch = first.channelData;
      if (ch.length === 0 || ch[0].length === 0) {
        fetcher.abort();
        dec.free();
        fail('DECODE', ERROR_UNSUPPORTED);
        return;
      }
      const frames = ch[0].length;
      const totalSamples = h.totalSamples;
      const sampleRate = first.sampleRate;
      const sess: Session = {
        fetcher,
        dec,
        index: createIndex(totalSamples),
        pos: h.blockSize,
        fileSize: fileSizeOf(probe, head.length),
        totalSamples,
        sampleRate,
        channels: ch.length,
        outputSample: 0,
        trimPending: 0,
        firstPcm: ch,
        firstBlockSize: h.blockSize,
        ended: false,
      };
      appendEntry(sess.index, {
        offset: 0,
        sampleIndex: h.sampleIndex,
        blockSamples: h.blockSamples,
        flags: h.flags,
      });
      session = sess;
      // totalSamples=0（流式编码产物）：按平均码率粗估 duration，seek 禁用
      const durationSec =
        totalSamples > 0
          ? totalSamples / sampleRate
          : (sess.fileSize * frames) / (h.blockSize * sampleRate);
      post({ type: 'meta', sampleRate, channels: ch.length, durationSec });
    } catch (e) {
      if (myGen === gen) {
        fail('NETWORK', String(e));
        if (session) teardown();
      }
    }
  }

  async function doPlay(fromSample: number, myGen: number): Promise<void> {
    const sess = session;
    if (!sess) {
      fail('DECODE', 'play before load');
      return;
    }
    // 流式编码（totalSamples=0）时长未知：索引/探测 seek 均不可用。
    // controller 裁定：seek 请求降级为 play(0) 语义（从头播）——
    // 静默 return 会让 UI 显示播放中但永远无声（卡死）。
    // 降级后实际起点与请求的 fromSample 不同，先通知主线程对齐调度器基线
    // （投递该次播放的任何 pcm 之前），否则主线程衔接校验会把后续块全部丢弃
    if (sess.totalSamples === 0 && fromSample !== sess.outputSample) {
      fromSample = 0;
      post({ type: 'seekfallback', actualSample: 0 });
    }
    // play(0) 快路径：投递 load 缓存的首块 PCM，decoder 已定位在块尾，直接续拉
    if (fromSample === 0 && sess.firstPcm && sess.outputSample === 0) {
      const channels = sess.firstPcm.map((c) => c.slice());
      sess.firstPcm = null;
      sess.outputSample = channels[0].length;
      post(
        { type: 'pcm', startSample: 0, channels },
        channels.map((c) => c.buffer),
      );
      void pullLoop(sess, myGen);
      return;
    }
    if (sess.ended && fromSample === sess.outputSample) return; // 结束后续拉：no-op
    if (fromSample === sess.outputSample) {
      // 续拉（pause 后 resume / 队列满再续）：decoder/索引保留，不重建
      void pullLoop(sess, myGen);
      return;
    }
    // seek：索引命中直接用，未命中插值探测并 append 进索引
    const hit = findBlockAt(sess.index, fromSample);
    let entry: IndexEntry;
    let skipFrames: number;
    if (hit) {
      entry = hit.entry;
      skipFrames = hit.skipFrames;
    } else {
      let found: IndexEntry | null = null;
      try {
        found = await locateBlock(
          (start, end) => sess.fetcher.read(start, end - start),
          sess.fileSize,
          sess.totalSamples,
          fromSample,
        );
      } catch (e) {
        // 探测拉流异常（HTTP 5xx / 断网 / abort 拒绝）：按类型投递 error
        if (myGen === gen) fail(fetchLikeError(e), String(e));
        return;
      }
      if (myGen !== gen) return;
      if (!found) {
        fail('DECODE', `seek 定位失败：sample ${fromSample}`);
        return;
      }
      appendEntry(sess.index, found);
      entry = found;
      skipFrames = fromSample - found.sampleIndex;
    }
    // 重建 decoder：先备好新的再释放旧的，失败/被新指令取代时旧状态不受影响
    let newDec: WavDecoder;
    try {
      newDec = await decoder();
    } catch (e) {
      fail('DECODE', String(e));
      return;
    }
    if (myGen !== gen) {
      newDec.free();
      return;
    }
    sess.dec.free();
    sess.dec = newDec;
    sess.pos = entry.offset;
    sess.outputSample = fromSample;
    sess.trimPending = skipFrames;
    sess.firstPcm = null;
    sess.ended = false;
    void pullLoop(sess, myGen);
  }

  async function pullLoop(sess: Session, myGen: number): Promise<void> {
    while (playing && myGen === gen) {
      if (sess.pos >= sess.fileSize) {
        endOfStream(sess);
        return;
      }
      let chunk: Uint8Array;
      try {
        chunk = await sess.fetcher.read(sess.pos, CHUNK_BYTES);
      } catch (e) {
        if (myGen !== gen || !playing) return;
        // Range 越界（416）等价 EOF：服务器行为差异的防御
        if (/HTTP 416\b/.test(String(e))) {
          endOfStream(sess);
          return;
        }
        fail('NETWORK', String(e));
        return;
      }
      if (myGen !== gen) return;
      if (chunk.length === 0) {
        endOfStream(sess);
        return;
      }
      scanIndex(sess, chunk, sess.pos);
      sess.pos += chunk.length;
      let out: ReturnType<WavDecoder['decode']>;
      try {
        out = sess.dec.decode(chunk);
      } catch (e) {
        fail('DECODE', String(e));
        return;
      }
      if (myGen !== gen) return;
      deliver(sess, out);
    }
  }

  /** 拉流循环顺手扫块头：增量索引；非 wvpk 字节（含尾部 trailer）惰性跳过，
   *  字节仍整体喂给 decoder（包自身会忽略） */
  function scanIndex(sess: Session, chunk: Uint8Array, pos: number): void {
    let i = 0;
    while (i + 32 <= chunk.length) {
      const h = parseBlockHeader(chunk, i);
      if (!h) {
        i++;
        continue;
      }
      appendEntry(sess.index, {
        offset: pos + i,
        sampleIndex: h.sampleIndex,
        blockSamples: h.blockSamples,
        flags: h.flags,
      });
      i += h.blockSize;
    }
  }

  function deliver(sess: Session, out: { channelData: Float32Array[] }): void {
    const total = out.channelData[0]?.length ?? 0;
    let offset = 0;
    if (sess.trimPending > 0) {
      // seek 输出裁剪：丢掉组首块起点到目标 sample 的前缀帧
      offset = Math.min(sess.trimPending, total);
      sess.trimPending -= offset;
    }
    const frames = total - offset;
    if (frames <= 0) return;
    const channels = out.channelData.map((c) => c.slice(offset));
    post(
      { type: 'pcm', startSample: sess.outputSample, channels },
      channels.map((c) => c.buffer),
    );
    sess.outputSample += frames;
  }

  function endOfStream(sess: Session): void {
    if (sess.totalSamples > 0 && sess.outputSample < sess.totalSamples) {
      fail(
        'DECODE',
        `流提前结束：输出 ${sess.outputSample} / 应有 ${sess.totalSamples} 帧`,
      );
      return;
    }
    sess.ended = true;
    post({ type: 'ended' });
  }

  return { handle };
}

/** Content-Range 总长 → Content-Length → 已收 body 兜底 */
function fileSizeOf(res: Response, bodyLen: number): number {
  const cr = res.headers.get('content-range'); // "bytes 0-63/12345"
  if (cr) {
    const m = /\/(\d+)$/.exec(cr);
    if (m) return Number(m[1]);
  }
  const cl = res.headers.get('content-length');
  if (cl && Number(cl) > 0) return Number(cl);
  return bodyLen;
}

// ---- Worker 入口（浏览器 module worker 下生效；node/bun 导入时无害） ----
const ctx = self as unknown as {
  postMessage: (msg: WorkerMsg, transfer?: Transferable[]) => void;
  onmessage: ((e: MessageEvent<WorkerCmd>) => void) | null;
};
const worker = createWavpackWorker((msg, transfer) =>
  ctx.postMessage(msg, transfer ?? []),
);
ctx.onmessage = (e) => worker.handle(e.data);

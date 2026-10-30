// HTTP Range 拉流管理：按 span（默认 8MB）聚合请求，流式填充内部缓冲，
// read(pos, len) 命中缓冲即切片复用，攒够即返回不等整个 span 拉完。
// 顺序续读从缓冲末尾接着拉；跳读（seek/probe）作废旧缓冲，避免错位数据。

/** fetch 兼容函数（可注入测试替身） */
export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

/** 单次 Range 请求的跨度：≈80 秒音频，把串行小请求的 RTT 开销摊薄 */
export const FETCH_SPAN_BYTES = 8 * 1024 * 1024;

const ABORTED_MSG = 'RangeFetcher aborted';

/** 已拉取的连续字节缓冲：[start, start + len) */
interface BufferState {
  start: number;
  parts: Uint8Array[];
  len: number;
  /** 本缓冲计划覆盖到的终点（span 请求跨度，不含）：窗口内的 read 等待填充 */
  target: number;
  /** 填充仍在途 */
  filling: boolean;
  /** 填充失败的错误（终止后保留，供等待者抛出） */
  error: Error | null;
}

/** 一次在途 span 请求 */
interface FillRun {
  /** 本次请求起点（= 写入目标缓冲的当前末尾） */
  start: number;
  /** 本次请求终点（不含） */
  end: number;
  buf: BufferState;
  controller: AbortController;
  reader: ReadableStreamDefaultReader<Uint8Array> | null;
}

export class RangeFetcher {
  private readonly url: string;
  private readonly fetchFn: FetchLike;
  private readonly spanBytes: number;
  private buf: BufferState | null = null;
  private fill: FillRun | null = null;
  /** 文件末尾（响应字节少于请求跨度时确定；之后 read 截断到此处） */
  private eofPos: number | null = null;
  private aborted = false;
  private waiters: Array<() => void> = [];

  constructor(url: string, fetchFn: FetchLike, spanBytes = FETCH_SPAN_BYTES) {
    this.url = url;
    this.fetchFn = fetchFn;
    this.spanBytes = Math.max(1, Math.floor(spanBytes));
  }

  /** 读取 [pos, pos+len) 字节；命中缓冲直接切片，否则按 span 拉取 */
  async read(pos: number, len: number): Promise<Uint8Array> {
    if (this.aborted) throw new Error(ABORTED_MSG);
    if (len <= 0) return new Uint8Array(0);
    // 抢占权：每次 read 只抢占一次（丢弃别人新建的缓冲），之后转为等待，
    // 否则并发跳读会互相作废缓冲而活锁
    let engaged = false;
    for (;;) {
      if (this.aborted) throw new Error(ABORTED_MSG);
      if (this.eofPos !== null) {
        const avail = this.eofPos - pos;
        if (avail <= 0) return new Uint8Array(0);
        len = Math.min(len, avail);
      }
      const buf = this.buf;
      if (buf) {
        const end = buf.start + buf.len;
        if (pos >= buf.start && pos + len <= end) return sliceOf(buf, pos, len);
        if (buf.error) throw buf.error;
        if (pos >= buf.start && pos <= buf.target) {
          // 窗口内（含紧邻末尾的顺序续读）：等填充推进，未在途则接着续拉
          engaged = true;
          if (!buf.filling && pos + len > end) this.startFill(buf, end);
        } else if (!engaged || !buf.filling) {
          engaged = true;
          this.startFill(this.resetBuffer(pos), pos);
        }
      } else if (!engaged || !this.fill) {
        engaged = true;
        this.startFill(this.resetBuffer(pos), pos);
      }
      await this.waitProgress();
    }
  }

  /** 中止在途请求；之后所有 read 一律拒绝 */
  abort(): void {
    this.aborted = true;
    this.cancelFill();
    this.buf = null;
    this.notify();
  }

  private resetBuffer(start: number): BufferState {
    this.cancelFill();
    const buf: BufferState = {
      start,
      parts: [],
      len: 0,
      target: start,
      filling: false,
      error: null,
    };
    this.buf = buf;
    return buf;
  }

  /** 发起从 start 起的一个 span 请求（写入 buf 末尾，target 顺延） */
  private startFill(buf: BufferState, start: number): void {
    this.cancelFill();
    const end = start + this.spanBytes;
    buf.target = Math.max(buf.target, end);
    buf.filling = true;
    buf.error = null;
    const run: FillRun = {
      start,
      end,
      buf,
      controller: new AbortController(),
      reader: null,
    };
    this.fill = run;
    void this.fillLoop(run);
  }

  private async fillLoop(run: FillRun): Promise<void> {
    const { start, end } = run;
    try {
      const res = await this.fetchFn(this.url, {
        headers: { Range: `bytes=${start}-${end - 1}` },
        signal: run.controller.signal,
      });
      if (!res.ok) {
        throw new Error(
          `RangeFetcher: HTTP ${res.status} for bytes=${start}-${end - 1}`,
        );
      }
      if (run.controller.signal.aborted || this.fill !== run) return;
      if (!res.body) {
        // 非流式环境/测试替身：一次填充
        this.append(run, new Uint8Array(await res.arrayBuffer()));
      } else {
        const reader = res.body.getReader();
        run.reader = reader;
        for (;;) {
          const { done, value } = await reader.read();
          if (run.controller.signal.aborted || this.fill !== run) {
            await reader.cancel().catch(() => {});
            return;
          }
          if (done) break;
          if (value && value.length > 0) this.append(run, value);
        }
      }
      this.finishFill(run);
    } catch (e) {
      // 被作废/中止的填充错误不外传（等待者已自行按状态判断）
      if (run.controller.signal.aborted || this.fill !== run) return;
      this.failFill(run, e);
    }
  }

  private append(run: FillRun, chunk: Uint8Array): void {
    const buf = run.buf;
    if (this.aborted || this.buf !== buf) return;
    buf.parts.push(chunk);
    buf.len += chunk.length;
    this.trim(buf);
    this.notify();
  }

  /**
   * 滑动窗口：只保留最近 2 个 span。顺序播放时得更早的数据已消费，继续留着会让
   * 缓冲长成整个文件（大文件可达数百 MB）；更早位置的回读按跳读重新拉取。
   */
  private trim(buf: BufferState): void {
    const keep = this.spanBytes * 2;
    while (buf.parts.length > 1 && buf.len - buf.parts[0].length >= keep) {
      const head = buf.parts.shift() as Uint8Array;
      buf.start += head.length;
      buf.len -= head.length;
    }
  }

  /** 正常结束：实际字节少于请求跨度即 EOF，记录文件末尾 */
  private finishFill(run: FillRun): void {
    if (this.fill === run) this.fill = null;
    const buf = run.buf;
    if (this.buf !== buf) return;
    buf.filling = false;
    const got = buf.start + buf.len - run.start;
    if (got < run.end - run.start) this.eofPos = run.start + got;
    this.notify();
  }

  private failFill(run: FillRun, e: unknown): void {
    if (this.fill === run) this.fill = null;
    const buf = run.buf;
    if (this.buf !== buf) return;
    buf.filling = false;
    buf.error = e instanceof Error ? e : new Error(String(e));
    this.notify();
  }

  /** 取消在途 span 请求与 reader（无在途则跳过） */
  private cancelFill(): void {
    const run = this.fill;
    if (!run) return;
    this.fill = null;
    run.buf.filling = false;
    run.controller.abort();
    void run.reader?.cancel().catch(() => {});
  }

  private waitProgress(): Promise<void> {
    if (this.aborted) return Promise.resolve();
    return new Promise((resolve) => {
      this.waiters.push(resolve);
    });
  }

  /** 唤醒所有等待者（每次 append / 填充终止 / abort 后重判条件） */
  private notify(): void {
    const waiters = this.waiters;
    this.waiters = [];
    for (const wake of waiters) wake();
  }
}

/** 从 parts 拼出 [pos, pos+len)；单段命中直接 subarray（零拷贝） */
function sliceOf(buf: BufferState, pos: number, len: number): Uint8Array {
  let skip = pos - buf.start;
  for (const part of buf.parts) {
    if (skip >= part.length) {
      skip -= part.length;
      continue;
    }
    if (part.length - skip >= len) return part.subarray(skip, skip + len);
    break;
  }
  const out = new Uint8Array(len);
  let written = 0;
  skip = pos - buf.start;
  for (const part of buf.parts) {
    if (skip >= part.length) {
      skip -= part.length;
      continue;
    }
    const take = Math.min(part.length - skip, len - written);
    out.set(part.subarray(skip, skip + take), written);
    written += take;
    skip = 0;
    if (written === len) break;
  }
  return out;
}

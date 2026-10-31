// wv 解码基准 worker：Range 拉取前 maxBytes 字节到内存后，用与播放路径
// （worker.ts）完全相同的解码器（@audio/decode-wavpack，patched）与 chunk
// 尺寸（64KB）纯解码计时，产出逐段速率与汇总。
//
// 在 worker 线程跑是刻意的：播放时解码也在 worker，测量环境与真实一致，
// 且无需让出主线程（无 setTimeout(0) 的 4ms clamp 稀释速率）。

import { decoder } from '@audio/decode-wavpack';
import { BenchStats } from './bench-stat';

const CHUNK_BYTES = 64 * 1024; // 与播放路径 worker.ts 的 CHUNK_BYTES 一致

export interface BenchStartCmd {
  type: 'start';
  /** stream URL（如 /api/media/stream/VJ01002343/xxx.wv） */
  url: string;
  /** Authorization Bearer token（可为 null，公开模式） */
  token: string | null;
  /** 只测前 N 字节（大文件不整拉，防手机 OOM） */
  maxBytes: number;
}

export type BenchMsg =
  | {
      type: 'meta';
      sampleRate: number;
      channels: number;
      /** 实际拉取的字节数 */
      fetchedBytes: number;
      /** 文件总大小（Content-Range 总长） */
      fileBytes: number;
    }
  | {
      type: 'segment';
      index: number;
      audioSec: number;
      wallSec: number;
      rate: number;
      cumulativeRate: number;
    }
  | {
      type: 'done';
      audioSec: number;
      wallSec: number;
      rate: number;
      totalSamples: number;
    }
  | { type: 'error'; message: string };

async function runBench(cmd: BenchStartCmd, post: (m: BenchMsg) => void) {
  const headers: Record<string, string> = {
    Range: `bytes=0-${cmd.maxBytes - 1}`,
  };
  if (cmd.token) headers.Authorization = `Bearer ${cmd.token}`;

  // url 已由调用方拼装编码（mediaResourceUrl）；原样 fetch，与播放路径
  // （RangeFetcher）一致——再 encodeURI 会把 % 编成 %25 导致服务器 404
  const res = await fetch(cmd.url, { headers });
  if (!res.ok) {
    throw new Error(`拉取失败：HTTP ${res.status}`);
  }
  const buf = new Uint8Array(await res.arrayBuffer());

  const totalRange = res.headers.get('content-range'); // bytes 0-N/TOTAL
  const fileBytes = totalRange ? Number(totalRange.split('/')[1]) : buf.length;

  const dec = await decoder();
  const stats = new BenchStats(10);
  let metaSent = false;

  for (let off = 0; off < buf.length; off += CHUNK_BYTES) {
    const chunk = buf.subarray(off, Math.min(off + CHUNK_BYTES, buf.length));
    const t0 = performance.now();
    const out = dec.decode(chunk);
    const wallMs = performance.now() - t0;

    if (!metaSent && out.sampleRate > 0) {
      metaSent = true;
      post({
        type: 'meta',
        sampleRate: out.sampleRate,
        channels: out.channelData.length,
        fetchedBytes: buf.length,
        fileBytes,
      });
    }
    const seg = stats.add(
      out.channelData[0]?.length ?? 0,
      out.sampleRate,
      wallMs,
    );
    if (seg) {
      post({
        type: 'segment',
        index: seg.index,
        audioSec: seg.audioSec,
        wallSec: seg.wallSec,
        rate: seg.rate,
        cumulativeRate: seg.cumulativeRate,
      });
    }
  }

  if (!metaSent) throw new Error('未解析出 WavPack 块（非 .wv 数据？）');
  const s = stats.summary();
  post({
    type: 'done',
    audioSec: s.audioSec,
    wallSec: s.wallSec,
    rate: s.rate,
    totalSamples: s.totalSamples,
  });
}

self.onmessage = (e: MessageEvent<BenchStartCmd>) => {
  const cmd = e.data;
  if (cmd?.type !== 'start') return;
  const post = (m: BenchMsg) => self.postMessage(m);
  runBench(cmd, post).catch((err: unknown) => {
    post({
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    });
  });
};

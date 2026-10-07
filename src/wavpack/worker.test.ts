// worker 集成测试（node 环境，内存版 fetch 替身）：顺序播放与 seek 的
// pcm 连续性 / 与全量 decode 逐位一致 / ended 语义。
// wasm 堆泄漏由依赖补丁修复（见 patches/），其存在性由
// wavpack-patch-canary.test.ts 哨兵守护。
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import decode from '@audio/decode-wavpack';
import { createWavpackWorker, type FetchFn, type PostFn } from './worker';
import type { WorkerCmd, WorkerMsg } from './worker-protocol';

const fixture = new Uint8Array(
  readFileSync(path.join(import.meta.dirname, '__fixtures__/test-6s.wv')),
);

interface PcmBlock {
  startSample: number;
  channels: Float32Array[];
}

/** 收消息 + 等待条件的驱动壳 */
function createHarness(fetchFn: FetchFn) {
  const messages: WorkerMsg[] = [];
  const pcms: PcmBlock[] = [];
  const waiters: Array<{
    pred: (m: WorkerMsg) => boolean;
    resolve: (m: WorkerMsg) => void;
  }> = [];
  const post: PostFn = (msg) => {
    messages.push(msg);
    if (msg.type === 'pcm') {
      pcms.push({ startSample: msg.startSample, channels: msg.channels });
    }
    for (let i = waiters.length - 1; i >= 0; i--) {
      if (waiters[i].pred(msg)) {
        waiters[i].resolve(msg);
        waiters.splice(i, 1);
      }
    }
  };
  const worker = createWavpackWorker(post, fetchFn);
  return {
    pcms,
    send(cmd: WorkerCmd) {
      worker.handle(cmd);
    },
    waitFor(pred: (m: WorkerMsg) => boolean, ms = 10000): Promise<WorkerMsg> {
      const hit = messages.find(pred);
      if (hit) return Promise.resolve(hit);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error('waitFor 超时'));
        }, ms);
        waiters.push({
          pred: (m) => {
            clearTimeout(timer);
            return pred(m);
          },
          resolve,
        });
      });
    },
  };
}

/** 内存版 Range fetch */
function memFetch(buf: Uint8Array): FetchFn {
  return async (_url, init) => {
    const headers = init?.headers as Record<string, string> | undefined;
    const m = /bytes=(\d+)-(\d+)/.exec(headers?.Range ?? '');
    if (!m) {
      const ab = buf.buffer.slice(
        buf.byteOffset,
        buf.byteOffset + buf.length,
      ) as ArrayBuffer;
      return new Response(ab, { status: 200 });
    }
    const start = Number(m[1]);
    const end = Number(m[2]);
    const body = buf.subarray(start, Math.min(end + 1, buf.length));
    const ab = body.buffer.slice(
      body.byteOffset,
      body.byteOffset + body.length,
    ) as ArrayBuffer;
    return new Response(ab, {
      status: 206,
      headers: {
        'content-range': `bytes ${start}-${start + body.length - 1}/${buf.length}`,
        'content-length': String(body.length),
      },
    });
  };
}

function assertContiguous(pcms: PcmBlock[]): number {
  let cursor = pcms[0].startSample;
  for (const b of pcms) {
    expect(b.startSample).toBe(cursor);
    expect(b.channels.length).toBe(2);
    expect(b.channels[0].length).toBe(b.channels[1].length);
    cursor += b.channels[0].length;
  }
  return cursor;
}

describe('worker：顺序播放', () => {
  it('play(0)：全程 pcm 连续且与全量 decode 逐位一致', async () => {
    const h = createHarness(memFetch(fixture));
    h.send({ type: 'load', url: 'mem://test.wv' });
    const meta = await h.waitFor((m) => m.type === 'meta');
    expect(meta.type === 'meta' && meta.sampleRate).toBe(44100);

    h.send({ type: 'play', fromSample: 0 });
    await h.waitFor((m) => m.type === 'ended');

    expect(h.pcms.length).toBeGreaterThan(1);
    const total = assertContiguous(h.pcms);
    expect(total).toBe(264600);

    // 与全量 decode 逐位一致
    const ref = await decode(fixture);
    const gotL = new Float32Array(total);
    const gotR = new Float32Array(total);
    let pos = 0;
    for (const b of h.pcms) {
      gotL.set(b.channels[0], pos);
      gotR.set(b.channels[1], pos);
      pos += b.channels[0].length;
    }
    expect(ref.channelData[0].length).toBe(total);
    expect([...gotL]).toEqual([...ref.channelData[0]]);
    expect([...gotR]).toEqual([...ref.channelData[1]]);
  }, 30000);
});

describe('worker：seek', () => {
  it('seek 中段块组首后从目标 sample 连续播到结尾', async () => {
    const h = createHarness(memFetch(fixture));
    h.send({ type: 'load', url: 'mem://test.wv' });
    await h.waitFor((m) => m.type === 'meta');
    h.send({ type: 'play', fromSample: 0 });
    await h.waitFor((m) => m.type === 'pcm');
    h.send({ type: 'pause' });
    // seek 到第 3 块（sampleIndex 44100）首帧
    h.send({ type: 'play', fromSample: 44100 });
    const first = await h.waitFor(
      (m) => m.type === 'pcm' && m.startSample >= 44100,
    );
    expect(first.type === 'pcm' && first.startSample).toBe(44100);
    await h.waitFor((m) => m.type === 'ended');
    const tail = h.pcms.filter((b) => b.startSample >= 44100);
    const total = assertContiguous(tail);
    expect(total).toBe(264600);
  }, 30000);
});

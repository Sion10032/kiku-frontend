import { describe, expect, it, vi } from 'vitest';
import { FETCH_SPAN_BYTES, RangeFetcher } from './range-fetcher';

const SPAN = 256; // 测试用小 span，拉伸成 8MB 后区间断言不可读

/** 位置相关字节：[pos, pos+n) 填充 (i & 0xff)，错位读会立刻暴露 */
function bytesAt(pos: number, n: number): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = (pos + i) & 0xff;
  return out;
}

function expectBytes(data: Uint8Array, pos: number): void {
  expect([...data]).toEqual([...bytesAt(pos, data.length)]);
}

/**
 * 假 fetchFn：记录调用，按请求 range 返回对应切片（单 chunk 的 200 响应）；
 * 请求 end 超出文件总长时 clamp（EOF 短响应）
 */
function fakeFetch(totalBytes: number) {
  const calls: Array<{ url: string; range: string | undefined }> = [];
  const fetchFn = vi.fn(
    async (url: string, init?: RequestInit): Promise<Response> => {
      const range = new Headers(init?.headers).get('range') ?? undefined;
      calls.push({ url, range });
      const m = range?.match(/^bytes=(\d+)-(\d+)$/);
      const start = m ? Number(m[1]) : 0;
      const end = m ? Math.min(Number(m[2]), totalBytes - 1) : totalBytes - 1;
      const body = bytesAt(start, Math.max(0, end - start + 1));
      return new Response(body, { status: 200 });
    },
  );
  return { fetchFn, calls };
}

/** 让出事件循环，等待在途 fill 建好 reader */
function settle(ms = 10): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('RangeFetcher', () => {
  it('read 发起 span Range 请求并返回对应字节', async () => {
    const { fetchFn, calls } = fakeFetch(1000);
    const f = new RangeFetcher('http://x/test.wv', fetchFn, SPAN);
    const data = await f.read(100, 50);
    expect(data.length).toBe(50);
    expectBytes(data, 100);
    expect(calls.length).toBe(1);
    expect(calls[0].url).toBe('http://x/test.wv');
    expect(calls[0].range).toBe('bytes=100-355');
  });

  it('默认 span 为 FETCH_SPAN_BYTES（8MB）', async () => {
    expect(FETCH_SPAN_BYTES).toBe(8 * 1024 * 1024);
    const { fetchFn, calls } = fakeFetch(FETCH_SPAN_BYTES * 2);
    const f = new RangeFetcher('http://x/test.wv', fetchFn);
    const data = await f.read(16, 8);
    expect(data.length).toBe(8);
    expectBytes(data, 16);
    expect(calls[0].range).toBe(`bytes=16-${16 + FETCH_SPAN_BYTES - 1}`);
    f.abort();
  });

  it('缓冲区间包含的并发 read 直接切片复用，不重复请求', async () => {
    const { fetchFn, calls } = fakeFetch(1000);
    const f = new RangeFetcher('http://x/test.wv', fetchFn, SPAN);
    const [a, b, c] = await Promise.all([
      f.read(0, 200),
      f.read(100, 50), // ⊂ 同一 span 窗口
      f.read(199, 1), // ⊂ 同一 span 窗口
    ]);
    expect(calls.length).toBe(1);
    expect(a.length).toBe(200);
    expect(b.length).toBe(50);
    expect(c.length).toBe(1);
    expectBytes(a, 0);
    expectBytes(b, 100);
    expectBytes(c, 199);
  });

  it('缓冲命中不重复请求，跳读越界发起新 span 请求', async () => {
    const { fetchFn, calls } = fakeFetch(1000);
    const f = new RangeFetcher('http://x/test.wv', fetchFn, SPAN);
    await f.read(0, 100);
    // [200, 250) ⊂ 已拉取的 [0, 256)：直接切片
    const hit = await f.read(200, 50);
    expect(hit.length).toBe(50);
    expectBytes(hit, 200);
    expect(calls.length).toBe(1);
    // 跳出窗口 → 新 span
    const miss = await f.read(400, 50);
    expect(calls.length).toBe(2);
    expect(calls[1].range).toBe('bytes=400-655');
    expectBytes(miss, 400);
  });

  it('顺序续读超出缓冲末尾时从 bufferEnd 续拉 span', async () => {
    const { fetchFn, calls } = fakeFetch(1000);
    const f = new RangeFetcher('http://x/test.wv', fetchFn, SPAN);
    await f.read(0, 200); // 缓冲 [0, 256)
    const data = await f.read(250, 20); // 跨过缓冲末尾，从 256 续拉
    expect(calls.length).toBe(2);
    expect(calls[1].range).toBe('bytes=256-511');
    expectBytes(data, 250);
  });

  it('请求末尾越界时返回剩余字节（EOF 截断）', async () => {
    const { fetchFn } = fakeFetch(1000);
    const f = new RangeFetcher('http://x/test.wv', fetchFn, SPAN);
    const data = await f.read(990, 100);
    expect(data.length).toBe(10);
    expectBytes(data, 990);
  });

  it('abort 后活跃 read 拒绝，后续 read 也拒绝', async () => {
    let release!: (r: Response) => void;
    const fetchFn = vi.fn(
      (_url: string, _init?: RequestInit): Promise<Response> =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const f = new RangeFetcher('http://x/test.wv', fetchFn, SPAN);
    const pending = f.read(0, 100);
    f.abort();
    await expect(pending).rejects.toThrow('RangeFetcher aborted');
    await expect(f.read(0, 100)).rejects.toThrow('RangeFetcher aborted');
    release(new Response(new Uint8Array(100)));
  });

  it('len ≤ 0 直接返回空数组，不发请求', async () => {
    const { fetchFn, calls } = fakeFetch(1000);
    const f = new RangeFetcher('http://x/test.wv', fetchFn, SPAN);
    const data = await f.read(0, 0);
    expect(data.length).toBe(0);
    expect(calls.length).toBe(0);
  });

  it('顺序 read 聚合为 span 请求：N 次小 read 只发 1 次请求', async () => {
    const { fetchFn, calls } = fakeFetch(1000);
    const f = new RangeFetcher('http://x/test.wv', fetchFn, SPAN);
    for (let i = 0; i < 4; i++) {
      const data = await f.read(i * 64, 64);
      expect(data.length).toBe(64);
      expectBytes(data, i * 64);
    }
    expect(calls.length).toBe(1);
  });

  it('分段到达的流式响应：首段攒够即返回，不等整个 span', async () => {
    let ctrl!: ReadableStreamDefaultController<Uint8Array>;
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        ctrl = c;
        c.enqueue(bytesAt(0, 64)); // 首段，read 只需 64 字节
      },
    });
    const fetchFn = vi.fn(
      async (): Promise<Response> => new Response(stream, { status: 206 }),
    );
    const f = new RangeFetcher('http://x/test.wv', fetchFn, SPAN);
    const data = await f.read(0, 64);
    expectBytes(data, 0);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    // 后续段仍未到达，说明未等整个 span
    f.abort(); // 收尾：cancel 在途 reader，避免悬挂
    expect(ctrl).toBeDefined();
  }, 2000);

  it('seek 跳读清缓冲并从新位置拉取', async () => {
    const { fetchFn, calls } = fakeFetch(10000);
    const f = new RangeFetcher('http://x/test.wv', fetchFn, SPAN);
    const head = await f.read(0, 100);
    expectBytes(head, 0);
    // 跳出缓冲窗口（[0, 256)）→ 必须丢弃旧缓冲，否则会读到错位数据
    const jumped = await f.read(5000, 50);
    expect(calls.length).toBe(2);
    expect(calls[1].range).toBe('bytes=5000-5255');
    expect(jumped.length).toBe(50);
    expectBytes(jumped, 5000);
    // 再回跳（缓冲区已是 [5000, ...)）同样作废
    const back = await f.read(100, 20);
    expect(calls.length).toBe(3);
    expect(calls[2].range).toBe('bytes=100-355');
    expectBytes(back, 100);
  });

  it('滑动窗口保留有限数据：超出保留范围的旧位置回读仍正确', async () => {
    const { fetchFn, calls } = fakeFetch(5000);
    const f = new RangeFetcher('http://x/test.wv', fetchFn, SPAN);
    for (let i = 0; i < 3; i++) {
      const data = await f.read(i * SPAN, SPAN);
      expectBytes(data, i * SPAN);
    }
    expect(calls.length).toBe(3); // 顺序续拉，每条 span 一次请求
    // 缓冲已滑出最老的一段：回读作为跳读重新拉取，数据不错位
    const back = await f.read(0, 10);
    expect(calls.length).toBe(4);
    expect(calls[3].range).toBe('bytes=0-255');
    expectBytes(back, 0);
  });

  it('EOF 截断到文件尾', async () => {
    const { fetchFn, calls } = fakeFetch(1000);
    const f = new RangeFetcher('http://x/test.wv', fetchFn, SPAN);
    const data = await f.read(900, 200);
    expect(data.length).toBe(100);
    expectBytes(data, 900);
    // 越过文件尾：0 字节，不得挂死
    const tail = await f.read(1000, 1);
    expect(tail.length).toBe(0);
    expect(calls.length).toBe(1);
  });

  it('416 保持抛错（worker 侧当 EOF 处理）', async () => {
    const fetchFn = vi.fn(
      async (): Promise<Response> =>
        new Response(null, {
          status: 416,
          headers: { 'content-range': 'bytes */1000' },
        }),
    );
    const f = new RangeFetcher('http://x/test.wv', fetchFn, SPAN);
    await expect(f.read(0, 10)).rejects.toThrow(/HTTP 416/);
  });

  it('abort 中断在途并拒绝后续 read', async () => {
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(bytesAt(0, 64)); // 首段后不再有数据：read(0, 1024) 挂起等待
      },
      cancel() {
        cancelled = true;
      },
    });
    const fetchFn = vi.fn(
      async (): Promise<Response> => new Response(stream, { status: 206 }),
    );
    const f = new RangeFetcher('http://x/test.wv', fetchFn, SPAN);
    const pending = f.read(0, 1024);
    await settle(); // 让在途 fill 拿到 reader 并挂在 read 上
    f.abort();
    await expect(pending).rejects.toThrow('RangeFetcher aborted');
    expect(cancelled).toBe(true); // 在途 reader 被 cancel，无泄漏
    await expect(f.read(0, 1)).rejects.toThrow('RangeFetcher aborted');
  }, 2000);

  it('body 为 null 的响应回退 arrayBuffer 填充', async () => {
    const calls: Array<string | undefined> = [];
    const fetchFn = vi.fn(
      async (_url: string, init?: RequestInit): Promise<Response> => {
        const range = new Headers(init?.headers).get('range') ?? undefined;
        calls.push(range);
        const m = range?.match(/^bytes=(\d+)-(\d+)$/);
        const start = m ? Number(m[1]) : 0;
        const end = m ? Number(m[2]) : SPAN - 1;
        const body = bytesAt(start, end - start + 1);
        return {
          ok: true,
          status: 206,
          body: null,
          arrayBuffer: async () => body.buffer,
        } as unknown as Response;
      },
    );
    const f = new RangeFetcher('http://x/test.wv', fetchFn, SPAN);
    const data = await f.read(10, 20);
    expect(data.length).toBe(20);
    expectBytes(data, 10);
    expect(calls).toEqual(['bytes=10-265']);
    // 二次 read 命中已填充缓冲，不再请求
    const again = await f.read(200, 10);
    expectBytes(again, 200);
    expect(calls.length).toBe(1);
  });
});

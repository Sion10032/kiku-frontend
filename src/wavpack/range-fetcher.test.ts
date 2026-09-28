import { describe, expect, it, vi } from 'vitest';
import { RangeFetcher } from './range-fetcher';

/** 假 fetchFn：记录调用，返回指定字节数的 200 响应（内容 = 按请求序号填充） */
function fakeFetch(totalBytes: number) {
  const calls: Array<{ url: string; range: string | undefined }> = [];
  const fetchFn = vi.fn(
    async (url: string, init?: RequestInit): Promise<Response> => {
      const range = new Headers(init?.headers).get('range') ?? undefined;
      calls.push({ url, range });
      // 解析 bytes=a-b，返回对应切片
      const m = range?.match(/^bytes=(\d+)-(\d+)$/);
      const start = m ? Number(m[1]) : 0;
      const end = m ? Math.min(Number(m[2]), totalBytes - 1) : totalBytes - 1;
      const body = new Uint8Array(Math.max(0, end - start + 1));
      body.fill(start & 0xff);
      return new Response(body, { status: 200 });
    },
  );
  return { fetchFn, calls };
}

describe('RangeFetcher', () => {
  it('read 发起 Range 请求并返回对应字节', async () => {
    const { fetchFn, calls } = fakeFetch(1000);
    const f = new RangeFetcher('http://x/test.wv', fetchFn);
    const data = await f.read(100, 50);
    expect(data.length).toBe(50);
    expect(calls.length).toBe(1);
    expect(calls[0].url).toBe('http://x/test.wv');
    expect(calls[0].range).toBe('bytes=100-149');
  });

  it('活跃请求区间包含的并发 read 直接切片复用，不重复请求', async () => {
    const { fetchFn, calls } = fakeFetch(1000);
    const f = new RangeFetcher('http://x/test.wv', fetchFn);
    const [a, b, c] = await Promise.all([
      f.read(0, 500),
      f.read(100, 50), // ⊂ [0, 500)
      f.read(499, 1), // ⊂ [0, 500)
    ]);
    expect(calls.length).toBe(1);
    expect(a.length).toBe(500);
    expect(b.length).toBe(50);
    expect(c.length).toBe(1);
  });

  it('跨区间 read 发起新请求', async () => {
    const { fetchFn, calls } = fakeFetch(1000);
    const f = new RangeFetcher('http://x/test.wv', fetchFn);
    await f.read(0, 100);
    await f.read(200, 50);
    expect(calls.length).toBe(2);
    expect(calls[1].range).toBe('bytes=200-249');
  });

  it('请求末尾越界时返回剩余字节（EOF 截断）', async () => {
    const { fetchFn } = fakeFetch(1000);
    const f = new RangeFetcher('http://x/test.wv', fetchFn);
    const data = await f.read(990, 100);
    expect(data.length).toBe(10);
  });

  it('abort 后活跃 read 拒绝，后续 read 也拒绝', async () => {
    let release!: (r: Response) => void;
    const fetchFn = vi.fn(
      (_url: string, _init?: RequestInit): Promise<Response> =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const f = new RangeFetcher('http://x/test.wv', fetchFn);
    const pending = f.read(0, 100);
    f.abort();
    await expect(pending).rejects.toThrow();
    await expect(f.read(0, 100)).rejects.toThrow();
    release(new Response(new Uint8Array(100)));
  });

  it('len ≤ 0 直接返回空数组，不发请求', async () => {
    const { fetchFn, calls } = fakeFetch(1000);
    const f = new RangeFetcher('http://x/test.wv', fetchFn);
    const data = await f.read(0, 0);
    expect(data.length).toBe(0);
    expect(calls.length).toBe(0);
  });
});

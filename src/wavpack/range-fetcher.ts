// HTTP Range 拉流管理：活跃请求区间内的并发 read 切片复用，
// 跨区间发起新请求；abort 拒绝在途与后续 read。

/** fetch 兼容函数（可注入测试替身） */
export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

interface ActiveRequest {
  start: number;
  end: number; // [start, end) 请求区间
  promise: Promise<Uint8Array>;
  rejectOnAbort: (e: unknown) => void;
}

export class RangeFetcher {
  private readonly url: string;
  private readonly fetchFn: FetchLike;
  private active: ActiveRequest | null = null;
  private aborted = false;

  constructor(url: string, fetchFn: FetchLike) {
    this.url = url;
    this.fetchFn = fetchFn;
  }

  /** 读取 [pos, pos+len) 字节；活跃请求区间包含则直接切片复用 */
  read(pos: number, len: number): Promise<Uint8Array> {
    if (this.aborted) {
      return Promise.reject(new Error('RangeFetcher aborted'));
    }
    if (len <= 0) return Promise.resolve(new Uint8Array(0));
    const end = pos + len;
    const active = this.active;
    if (active && pos >= active.start && end <= active.end) {
      return active.promise.then((buf) =>
        buf.subarray(pos - active.start, end - active.start),
      );
    }
    let rejectOnAbort: (e: unknown) => void;
    const gate = new Promise<Uint8Array>((_, reject) => {
      rejectOnAbort = reject;
    });
    const promise = Promise.race([this.fetchRange(pos, end), gate]);
    // 防止并发 read 少于实际引用时出现 unhandled rejection
    promise.catch(() => {});
    this.active = { start: pos, end, promise, rejectOnAbort: rejectOnAbort! };
    return promise;
  }

  /** 中止在途请求；之后所有 read 一律拒绝 */
  abort(): void {
    this.aborted = true;
    const active = this.active;
    this.active = null;
    active?.rejectOnAbort(new Error('RangeFetcher aborted'));
  }

  private async fetchRange(start: number, end: number): Promise<Uint8Array> {
    const res = await this.fetchFn(this.url, {
      headers: { Range: `bytes=${start}-${end - 1}` },
    });
    if (!res.ok) {
      throw new Error(
        `RangeFetcher: HTTP ${res.status} for bytes=${start}-${end - 1}`,
      );
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    // EOF 截断：服务器可能只返回剩余字节
    if (buf.length > end - start) {
      return buf.subarray(0, end - start);
    }
    return buf;
  }
}

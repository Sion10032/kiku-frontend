// WavPack 块头解析（纯函数）。
// 块头布局（32 字节，全部小端）：
//   +0  'wvpk' magic
//   +4  ckSize（u32，块总长 − 8）
//   +8  version（u16）
//   +12 totalSamples（u32，仅首块非 0）
//   +16 sampleIndex（u32，块首样本索引）
//   +20 blockSamples（u32，0 = 非音频块）
//   +24 flags（u32）
// 多声道块组标志：INITIAL_BLOCK = 0x800（组首块），FINAL_BLOCK = 0x1000（组尾块）；
// 立体声单块组两位同时置位（0x1800）。
export const INITIAL_BLOCK = 0x800;

const MAX_BLOCK_SIZE = 1024 * 1024; // 1MB 上限
const MIN_BLOCK_SIZE = 32;

export interface WvBlockHeader {
  /** 解析位置（文件字节偏移，由调用方传入） */
  offset: number;
  /** ckSize + 8 */
  blockSize: number;
  version: number;
  /** off+12，0 = 未知 */
  totalSamples: number;
  /** off+16 */
  sampleIndex: number;
  /** off+20，0 = 非音频块 */
  blockSamples: number;
  /** off+24 */
  flags: number;
}

/**
 * 解析 off 处的 WavPack 块头。
 * 返回 null：magic ≠ 'wvpk'、blockSize < 32 或 > 1MB、version < 0x402、
 * 或剩余字节不足 32（截断头）。不抛错，供扫描器逐字节推进。
 */
export function parseBlockHeader(
  u8: Uint8Array,
  off: number,
): WvBlockHeader | null {
  if (off < 0 || off + MIN_BLOCK_SIZE > u8.length) return null;
  if (
    u8[off] !== 0x77 // 'w'
    || u8[off + 1] !== 0x76 // 'v'
    || u8[off + 2] !== 0x70 // 'p'
    || u8[off + 3] !== 0x6b // 'k'
  ) {
    return null;
  }
  const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const blockSize = view.getUint32(off + 4, true) + 8;
  if (blockSize < MIN_BLOCK_SIZE || blockSize > MAX_BLOCK_SIZE) return null;
  const version = view.getUint16(off + 8, true);
  if (version < 0x402) return null;
  return {
    offset: off,
    blockSize,
    version,
    totalSamples: view.getUint32(off + 12, true),
    sampleIndex: view.getUint32(off + 16, true),
    blockSamples: view.getUint32(off + 20, true),
    flags: view.getUint32(off + 24, true),
  };
}

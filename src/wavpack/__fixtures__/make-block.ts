// 测试专用：构造合成 WavPack 块 / 拼接文件。
// 只生成结构合法的块头（magic/ckSize/version/sampleIndex...），payload 为填充字节，
// 不承载可解码音频。供 block / probe-seek 测试构造边界场景。

export interface MakeBlockOptions {
  /** 默认 'wvpk'；可传坏 magic 构造非法块 */
  magic?: string;
  /** 显式指定 ckSize（默认 24 + payloadBytes）；可传越界值构造非法块 */
  ckSize?: number;
  /** payload 字节数（默认 0，即 blockSize = 32） */
  payloadBytes?: number;
  /** payload 填充值（默认 0x55，避免与零区混淆） */
  payloadFill?: number;
  version?: number;
  totalSamples?: number;
  sampleIndex?: number;
  blockSamples?: number;
  flags?: number;
}

export function makeBlock(opts: MakeBlockOptions = {}): Uint8Array {
  const {
    magic = 'wvpk',
    payloadBytes = 0,
    payloadFill = 0x55,
    version = 0x410,
    totalSamples = 0,
    sampleIndex = 0,
    blockSamples = 0,
    flags = 0,
  } = opts;
  const ckSize = opts.ckSize ?? 24 + payloadBytes;
  const blockSize = ckSize + 8;
  const u8 = new Uint8Array(blockSize);
  const view = new DataView(u8.buffer);
  for (let i = 0; i < 4; i++) u8[i] = magic.charCodeAt(i) ?? 0;
  view.setUint32(4, ckSize, true);
  view.setUint16(8, version, true);
  view.setUint32(12, totalSamples, true);
  view.setUint32(16, sampleIndex, true);
  view.setUint32(20, blockSamples, true);
  view.setUint32(24, flags, true);
  u8.fill(payloadFill, 32);
  return u8;
}

export function concatBlocks(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of parts) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}

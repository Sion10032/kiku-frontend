/** 文本解码结果。 */
export interface DecodedText {
  text: string;
  /** 命中的编码（供 UI 显示） */
  encoding: 'utf-8' | 'utf-16le' | 'utf-16be' | 'shift-jis';
}

/**
 * 解码文本 buffer：BOM 检测 → UTF-8 严格校验 → Shift-JIS 回退。
 *
 * kikoeru 系作品附带 txt 多为 Shift-JIS：无 BOM 时先以 fatal UTF-8
 * 试解（任何非法序列抛错），失败再按 Shift-JIS 解（非法字节替换为
 * U+FFFD，不抛错）。注意：必须用完整 buffer 解码——渲染层截断
 * （TextPreview 的 MAX_CHARS）不得提前切 buffer，否则 UTF-8 多字节
 * 序列被切断会导致误判回退。
 */
export function decodeTextData(buf: ArrayBuffer): DecodedText {
  const bytes = new Uint8Array(buf);

  if (startsWith(bytes, [ 0xEF, 0xBB, 0xBF ])) {
    return { text: decode('utf-8', bytes.subarray(3)), encoding: 'utf-8' };
  }
  if (startsWith(bytes, [ 0xFF, 0xFE ])) {
    return { text: decode('utf-16le', bytes.subarray(2)), encoding: 'utf-16le' };
  }
  if (startsWith(bytes, [ 0xFE, 0xFF ])) {
    return { text: decode('utf-16be', bytes.subarray(2)), encoding: 'utf-16be' };
  }

  try {
    // 严格模式：非法 UTF-8 序列抛错，防止 Shift-JIS 被误当 UTF-8
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return { text, encoding: 'utf-8' };
  }
  catch {
    return { text: decode('shift-jis', bytes), encoding: 'shift-jis' };
  }
}

function decode(encoding: string, bytes: Uint8Array): string {
  return new TextDecoder(encoding).decode(bytes);
}

function startsWith(bytes: Uint8Array, prefix: number[]): boolean {
  return prefix.every((b, i) => bytes[i] === b);
}

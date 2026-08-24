import { describe, expect, it } from 'vitest';
import { decodeTextData } from './encoding';

/** 由字节数组构造独立的 ArrayBuffer（新 Uint8Array 的 buffer，无偏移问题）。 */
function bytes(data: number[]): ArrayBuffer {
  return new Uint8Array(data).buffer;
}

describe('decodeTextData', () => {
  it('decodes BOM-less UTF-8 text', () => {
    const buf = new TextEncoder().encode('你好').buffer;
    expect(decodeTextData(buf)).toEqual({ text: '你好', encoding: 'utf-8' });
  });

  it('strips the UTF-8 BOM', () => {
    const buf = bytes([ 0xEF, 0xBB, 0xBF, 0x68, 0x69 ]);
    const result = decodeTextData(buf);
    expect(result).toEqual({ text: 'hi', encoding: 'utf-8' });
    expect(result.text).not.toContain('\uFEFF');
  });

  it('decodes UTF-16LE with BOM', () => {
    const buf = bytes([ 0xFF, 0xFE, 0x68, 0x00, 0x69, 0x00 ]);
    const result = decodeTextData(buf);
    expect(result).toEqual({ text: 'hi', encoding: 'utf-16le' });
    expect(result.text).not.toContain('\uFEFF');
  });

  it('decodes UTF-16BE with BOM', () => {
    const buf = bytes([ 0xFE, 0xFF, 0x00, 0x68, 0x00, 0x69 ]);
    const result = decodeTextData(buf);
    expect(result).toEqual({ text: 'hi', encoding: 'utf-16be' });
    expect(result.text).not.toContain('\uFEFF');
  });

  it('falls back to Shift-JIS when strict UTF-8 fails', () => {
    // こんにちは 的 Shift-JIS 字节；0x82 开头在严格 UTF-8 下必抛错
    const buf = bytes([ 0x82, 0xB1, 0x82, 0xF1, 0x82, 0xC9, 0x82, 0xBF, 0x82, 0xCD ]);
    expect(decodeTextData(buf)).toEqual({ text: 'こんにちは', encoding: 'shift-jis' });
  });

  it('replaces undecodable bytes with U+FFFD in the Shift-JIS fallback', () => {
    // 单独的 0x82：严格 UTF-8 抛错；Shift-JIS 下为非法前导字节 → U+FFFD
    const buf = bytes([ 0x82 ]);
    expect(decodeTextData(buf)).toEqual({ text: '\uFFFD', encoding: 'shift-jis' });
  });
});

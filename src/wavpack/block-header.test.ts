import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { INITIAL_BLOCK, parseBlockHeader } from './block-header';

const fixture = new Uint8Array(
  readFileSync(path.join(import.meta.dirname, '__fixtures__/test-6s.wv')),
);

// fixture 实测结构（6s stereo 44.1kHz）：
// 12 个音频块（每块 22050 samples）+ 尾部 93 字节 APEv2 tag（非 wvpk）
const FILE_SIZE = 328331;
const APE_TAG_OFFSET = 328238;

/** 构造一个最小合法块头（blockSize = 32，payload 可选） */
function makeBlock(
  opts: {
    magic?: string;
    ckSize?: number;
    version?: number;
    totalSamples?: number;
    sampleIndex?: number;
    blockSamples?: number;
    flags?: number;
  } = {},
): Uint8Array {
  const {
    magic = 'wvpk',
    ckSize = 24,
    version = 0x410,
    totalSamples = 0,
    sampleIndex = 0,
    blockSamples = 0,
    flags = 0,
  } = opts;
  const u8 = new Uint8Array(32);
  const view = new DataView(u8.buffer);
  for (let i = 0; i < 4; i++) u8[i] = magic.charCodeAt(i) ?? 0;
  view.setUint32(4, ckSize, true);
  view.setUint16(8, version, true);
  view.setUint32(12, totalSamples, true);
  view.setUint32(16, sampleIndex, true);
  view.setUint32(20, blockSamples, true);
  view.setUint32(24, flags, true);
  return u8;
}

describe('INITIAL_BLOCK', () => {
  it('常量为 0x800（多声道块组首块；0x1000 是 FINAL_BLOCK，立体声单块为 0x1800）', () => {
    expect(INITIAL_BLOCK).toBe(0x800);
  });
});

describe('parseBlockHeader：fixture 真实块', () => {
  it('解析首块：magic/ckSize/sampleIndex/blockSamples/flags', () => {
    const h = parseBlockHeader(fixture, 0);
    expect(h).not.toBeNull();
    expect(h!.offset).toBe(0);
    expect(h!.blockSize).toBe(30628);
    expect(h!.version).toBe(0x410);
    expect(h!.totalSamples).toBe(264600);
    expect(h!.sampleIndex).toBe(0);
    expect(h!.blockSamples).toBe(22050);
    expect(h!.flags).toBe(0x4bc1831);
  });

  it('解析第二块：totalSamples=0（仅首块记录总时长）', () => {
    const h = parseBlockHeader(fixture, 30628);
    expect(h).not.toBeNull();
    expect(h!.offset).toBe(30628);
    expect(h!.blockSize).toBe(30552);
    expect(h!.totalSamples).toBe(0);
    expect(h!.sampleIndex).toBe(22050);
    expect(h!.blockSamples).toBe(22050);
  });

  it('解析末块', () => {
    const h = parseBlockHeader(fixture, 302878);
    expect(h).not.toBeNull();
    expect(h!.offset).toBe(302878);
    expect(h!.blockSize).toBe(25360);
    expect(h!.sampleIndex).toBe(242550);
    expect(h!.sampleIndex + h!.blockSamples).toBe(264600);
  });
});

describe('parseBlockHeader：null 条件', () => {
  it('坏 magic 返回 null', () => {
    const bad = makeBlock({ magic: 'RIFF' });
    expect(parseBlockHeader(bad, 0)).toBeNull();
  });

  it('blockSize < 32（ckSize < 24）返回 null', () => {
    expect(parseBlockHeader(makeBlock({ ckSize: 23 }), 0)).toBeNull();
  });

  it('blockSize > 1MB 返回 null', () => {
    // ckSize = 0x100000 → blockSize = 0x100008 > 1MB
    expect(parseBlockHeader(makeBlock({ ckSize: 0x100000 }), 0)).toBeNull();
  });

  it('blockSize 恰好 1MB 合法', () => {
    const h = parseBlockHeader(makeBlock({ ckSize: 0xffff8 }), 0);
    expect(h).not.toBeNull();
    expect(h!.blockSize).toBe(0x100000);
  });

  it('version < 0x402 返回 null', () => {
    expect(parseBlockHeader(makeBlock({ version: 0x401 }), 0)).toBeNull();
  });

  it('version 0x402 合法', () => {
    expect(parseBlockHeader(makeBlock({ version: 0x402 }), 0)).not.toBeNull();
  });

  it('缓冲区不足 32 字节返回 null（含有效 magic 的截断头）', () => {
    const truncated = makeBlock().subarray(0, 20);
    expect(parseBlockHeader(truncated, 0)).toBeNull();
  });

  it('偏移越过缓冲区末尾返回 null', () => {
    expect(parseBlockHeader(fixture, FILE_SIZE)).toBeNull();
  });
});

describe('parseBlockHeader：尾部垃圾', () => {
  it('fixture 尾部 93 字节 APEv2 tag（非 wvpk）返回 null 不抛错', () => {
    expect(() => parseBlockHeader(fixture, APE_TAG_OFFSET)).not.toThrow();
    expect(parseBlockHeader(fixture, APE_TAG_OFFSET)).toBeNull();
  });

  it('fixture 尾拼接非 wvpk 字节后对其返回 null 不抛错', () => {
    const garbage = new Uint8Array(93).fill(0xff);
    const padded = new Uint8Array(FILE_SIZE + 93);
    padded.set(fixture, 0);
    padded.set(garbage, FILE_SIZE);
    expect(parseBlockHeader(padded, FILE_SIZE)).toBeNull();
  });
});

describe('parseBlockHeader：非音频块', () => {
  it('blockSamples=0 返回有效 header（调用方负责跳过）', () => {
    const h = parseBlockHeader(
      makeBlock({ sampleIndex: 264600, blockSamples: 0, flags: 0x820 }),
      0,
    );
    expect(h).not.toBeNull();
    expect(h!.blockSamples).toBe(0);
    expect(h!.sampleIndex).toBe(264600);
    expect(h!.flags).toBe(0x820);
  });

  it('传入非零偏移时 offset 为调用方传入值', () => {
    const block = makeBlock();
    const buf = new Uint8Array(100);
    buf.set(block, 50);
    const h = parseBlockHeader(buf, 50);
    expect(h).not.toBeNull();
    expect(h!.offset).toBe(50);
  });
});

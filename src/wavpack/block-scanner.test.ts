import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseBlockHeader } from './block-header';
import { createIndex, type IndexEntry } from './block-index';
import { createBlockScanner } from './block-scanner';
import { concatBlocks, makeBlock } from './__fixtures__/make-block';

const fixture = new Uint8Array(
  readFileSync(path.join(import.meta.dirname, '__fixtures__/test-6s.wv')),
);

/** 用 parseBlockHeader 全文件扫描出真实 entries（理想基准） */
function scanFixture(): IndexEntry[] {
  const entries: IndexEntry[] = [];
  let pos = 0;
  while (pos + 32 <= fixture.length) {
    const h = parseBlockHeader(fixture, pos);
    if (!h) break;
    entries.push({
      offset: h.offset,
      sampleIndex: h.sampleIndex,
      blockSamples: h.blockSamples,
      flags: h.flags,
    });
    pos += h.blockSize;
  }
  return entries;
}

function entriesOf(index: { entries: IndexEntry[] }): IndexEntry[] {
  return index.entries;
}

/** 按 size 切块逐个 feed 扫描器，返回索引 entries */
function scanChunked(data: Uint8Array, size: number): IndexEntry[] {
  const index = createIndex(0);
  const scanner = createBlockScanner(index);
  for (let pos = 0; pos < data.length; pos += size) {
    scanner.feed(data.subarray(pos, Math.min(pos + size, data.length)), pos);
  }
  return entriesOf(index);
}

describe('block-scanner：fixture 真实流（任意切分）', () => {
  const expected = scanFixture();

  it('整块一次 feed 与全量扫描一致', () => {
    expect(scanChunked(fixture, fixture.length)).toEqual(expected);
  });

  it('64KB worker 同款切分与全量扫描一致', () => {
    expect(scanChunked(fixture, 64 * 1024)).toEqual(expected);
  });

  // 覆盖：头跨 chunk 边界、payload 跨 chunk 边界、chunk 起点落在块中间
  it.each([7, 13, 31, 33, 100, 1000, 16384, 30000, 100000])(
    'size=%i 乱切分与全量扫描一致',
    (size) => {
      expect(scanChunked(fixture, size)).toEqual(expected);
    },
  );
});

describe('block-scanner：合成块边界场景', () => {
  it('多声道块组：同 sampleIndex 两块只索引组首', () => {
    const initial = makeBlock({
      sampleIndex: 0,
      blockSamples: 100,
      flags: 0x800,
      payloadBytes: 10,
    });
    const final = makeBlock({
      sampleIndex: 0,
      blockSamples: 100,
      flags: 0x1000,
      payloadBytes: 10,
    });
    const next = makeBlock({
      sampleIndex: 100,
      blockSamples: 100,
      flags: 0x1800,
      payloadBytes: 10,
    });
    const data = concatBlocks(initial, final, next);
    const entries = scanChunked(data, 5);
    expect(entries.map((e) => e.sampleIndex)).toEqual([0, 100]);
    expect(entries[0].offset).toBe(0);
    expect(entries[1].offset).toBe(initial.length + final.length);
  });

  it('非音频块（blockSamples=0）也进索引且不阻断扫描', () => {
    const meta = makeBlock({ payloadBytes: 20 });
    const audio = makeBlock({
      sampleIndex: 500,
      blockSamples: 50,
      payloadBytes: 10,
    });
    const data = concatBlocks(meta, audio);
    const entries = scanChunked(data, 9);
    expect(entries.map((e) => e.sampleIndex)).toEqual([0, 500]);
  });

  it('块头跨 chunk 边界（在 magic 中间切断）不丢块', () => {
    // 块 32B 头 + 10B payload；从 offset 2 开始 5 字节一切，头被切 ~7 次
    const b1 = makeBlock({
      sampleIndex: 0,
      blockSamples: 10,
      payloadBytes: 10,
    });
    const b2 = makeBlock({
      sampleIndex: 10,
      blockSamples: 10,
      payloadBytes: 10,
    });
    const data = concatBlocks(b1, b2);
    const entries = scanChunked(data, 5);
    expect(entries.length).toBe(2);
    expect(entries[1].offset).toBe(b1.length);
    expect(entries[1].sampleIndex).toBe(10);
  });

  it('大块 payload 跨多个 chunk 仍只按头定位', () => {
    const b1 = makeBlock({
      sampleIndex: 0,
      blockSamples: 10,
      payloadBytes: 200,
    });
    const b2 = makeBlock({
      sampleIndex: 10,
      blockSamples: 10,
      payloadBytes: 10,
    });
    const data = concatBlocks(b1, b2);
    const entries = scanChunked(data, 32); // payload 被 6 个 chunk 覆盖
    expect(entries.length).toBe(2);
    expect(entries[1].offset).toBe(b1.length);
  });

  it('垃圾（trailer）后停止：之前的条目保留，后续 feed no-op', () => {
    const b1 = makeBlock({
      sampleIndex: 0,
      blockSamples: 10,
      payloadBytes: 10,
    });
    const b2 = makeBlock({
      sampleIndex: 10,
      blockSamples: 10,
      payloadBytes: 10,
    });
    const trailer = new Uint8Array(93).fill(0xee);
    const data = concatBlocks(b1, b2, trailer);
    const entries = scanChunked(data, 16);
    expect(entries.length).toBe(2);
    // 再喂一个合法块也不会被索引（已停止）
    const more = makeBlock({
      sampleIndex: 20,
      blockSamples: 10,
      payloadBytes: 10,
    });
    const index = createIndex(0);
    const scanner = createBlockScanner(index);
    scanner.feed(data, 0);
    expect(scanner.stopped).toBe(true);
    scanner.feed(more, data.length);
    expect(index.entries.length).toBe(2);
  });

  it('stopped 扫描器 feed 任意 chunk 安全', () => {
    const index = createIndex(0);
    const scanner = createBlockScanner(index);
    // 32 字节非块数据：足以判定预期边界处无合法头
    scanner.feed(new Uint8Array(32).fill(0xff), 0);
    expect(scanner.stopped).toBe(true);
    expect(() => scanner.feed(fixture, 32)).not.toThrow();
    expect(index.entries.length).toBe(0);
  });
});

describe('block-scanner：onBlock 回调', () => {
  it('每个合法块回调一次（含非音频块），带绝对 offset', () => {
    const seen: number[] = [];
    const index = createIndex(0);
    const scanner = createBlockScanner(index, (e) => seen.push(e.offset));
    const b1 = makeBlock({
      sampleIndex: 0,
      blockSamples: 10,
      payloadBytes: 10,
    });
    const meta = makeBlock({ payloadBytes: 5 });
    const b2 = makeBlock({
      sampleIndex: 10,
      blockSamples: 10,
      payloadBytes: 10,
    });
    const data = concatBlocks(b1, meta, b2);
    scanner.feed(data, 0);
    expect(seen).toEqual([0, b1.length, b1.length + meta.length]);
  });
});

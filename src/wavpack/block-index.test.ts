import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseBlockHeader } from './block-header';
import { appendEntry, createIndex, findBlockAt } from './block-index';
import type { IndexEntry } from './block-index';

const fixture = new Uint8Array(
  readFileSync(path.join(import.meta.dirname, '__fixtures__/test-6s.wv')),
);

/** 用 parseBlockHeader 全文件扫描出真实 entries */
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

describe('block-index：fixture 真实 entries', () => {
  const entries = scanFixture();
  const index = createIndex(264600);
  for (const e of entries) appendEntry(index, e);

  it('全文件扫出 12 条 entry', () => {
    expect(entries.length).toBe(12);
    expect(index.entries.length).toBe(12);
    expect(index.totalSamples).toBe(264600);
  });

  it('首块：sample 0 → entry offset 0，skipFrames 0', () => {
    const r = findBlockAt(index, 0);
    expect(r).not.toBeNull();
    expect(r!.entry.offset).toBe(0);
    expect(r!.entry.sampleIndex).toBe(0);
    expect(r!.skipFrames).toBe(0);
  });

  it('首块末样本：sample 22049 → 首块，skipFrames 22049', () => {
    const r = findBlockAt(index, 22049);
    expect(r).not.toBeNull();
    expect(r!.entry.offset).toBe(0);
    expect(r!.skipFrames).toBe(22049);
  });

  it('块边界：sample 22050 → 第二块，skipFrames 0', () => {
    const r = findBlockAt(index, 22050);
    expect(r).not.toBeNull();
    expect(r!.entry.offset).toBe(30628);
    expect(r!.skipFrames).toBe(0);
  });

  it('末块末样本：sample 264599 → 末块，skipFrames 22049', () => {
    const r = findBlockAt(index, 264599);
    expect(r).not.toBeNull();
    expect(r!.entry.offset).toBe(302878);
    expect(r!.skipFrames).toBe(22049);
  });

  it('未索引区域返回 null：totalSamples 及越界', () => {
    expect(findBlockAt(index, 264600)).toBeNull();
    expect(findBlockAt(index, 300000)).toBeNull();
  });

  it('二分命中中段块：sample 130000', () => {
    const r = findBlockAt(index, 130000);
    expect(r).not.toBeNull();
    // 第 6 块（0 起）sampleIndex = 5 * 22050 = 110250
    expect(r!.entry.sampleIndex).toBe(110250);
    expect(r!.skipFrames).toBe(130000 - 110250);
  });
});

describe('block-index：appendEntry 有序去重', () => {
  it('重复 sampleIndex 不重复插入', () => {
    const index = createIndex(100);
    const e = { offset: 0, sampleIndex: 0, blockSamples: 50, flags: 0 };
    appendEntry(index, e);
    appendEntry(index, e);
    expect(index.entries.length).toBe(1);
  });

  it('乱序 append 后仍按 sampleIndex 有序', () => {
    const index = createIndex(300);
    appendEntry(index, {
      offset: 200,
      sampleIndex: 200,
      blockSamples: 100,
      flags: 0,
    });
    appendEntry(index, {
      offset: 0,
      sampleIndex: 0,
      blockSamples: 100,
      flags: 0,
    });
    appendEntry(index, {
      offset: 100,
      sampleIndex: 100,
      blockSamples: 100,
      flags: 0,
    });
    expect(index.entries.map((e) => e.sampleIndex)).toEqual([0, 100, 200]);
  });
});

describe('block-index：空索引与空洞', () => {
  it('空索引 findBlockAt 返回 null', () => {
    expect(findBlockAt(createIndex(0), 0)).toBeNull();
  });

  it('条目间空洞（块未索引）返回 null', () => {
    const index = createIndex(300);
    appendEntry(index, {
      offset: 0,
      sampleIndex: 0,
      blockSamples: 100,
      flags: 0,
    });
    // 100..200 之间未索引
    appendEntry(index, {
      offset: 100,
      sampleIndex: 200,
      blockSamples: 100,
      flags: 0,
    });
    expect(findBlockAt(index, 150)).toBeNull();
    expect(findBlockAt(index, 250)).not.toBeNull();
  });
});

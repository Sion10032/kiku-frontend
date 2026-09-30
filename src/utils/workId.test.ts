import { describe, expect, it } from 'vitest';
import {
  classifyWorkSource,
  getWorkCodePrefix,
  MANUAL_PREFIXES,
  normalizeWorkId,
} from './workId';

describe('normalizeWorkId（规范化作品 id）', () => {
  it.each([
    ['RJ01173549', 'RJ01173549'], // 8 位原样保留
    ['rj231176', 'RJ231176'], // 6 位不补零（核心回归用例：迁移作品代码）
    ['231176', 'RJ231176'], // 裸 6 位默认按 RJ 处理
    ['01173549', 'RJ01173549'], // 裸 8 位默认按 RJ 处理
    ['VJ01003042', 'VJ01003042'],
    ['UW00000001', 'UW00000001'], // 人工作品前缀（与后端 MANUAL_PREFIXES 对齐）
    ['uw123456', 'UW123456'], // 人工作品前缀：6 位不补零、大小写归一
  ])('%s → %s', (input, expected) => {
    expect(normalizeWorkId(input)).toBe(expected);
  });

  it.each([
    'rj1173549', // 7 位数字不再合法
    '1173549',
    'vj1003042', // 7 位数字不再合法（旧补零行为已移除）
    'RJ123', // 3 位
    'RJ12345', // 5 位
    'RJ123456789', // 9 位
    'abc', // 非数字
  ])('%s 抛错', (input) => {
    expect(() => normalizeWorkId(input)).toThrow();
  });
});

describe('classifyWorkSource（作品来源分类）', () => {
  it.each([
    ['RJ01173549', 'dlsite'],
    ['VJ01003042', 'dlsite'],
    ['UW00000001', 'manual'],
    ['UW123456', 'manual'],
    ['uw123456', 'manual'], // 大小写不敏感
    ['XX00000001', null], // 两位字母前缀但不在任何已知集合
    ['garbage', null],
  ])('%s → %s', (input, expected) => {
    expect(classifyWorkSource(input)).toBe(expected);
  });
});

describe('MANUAL_PREFIXES（人工前缀守卫）', () => {
  it('每项均为两个大写字母，不含 RJ/VJ，且无重复', () => {
    expect(MANUAL_PREFIXES.length).toBeGreaterThan(0);
    expect(new Set(MANUAL_PREFIXES).size).toBe(MANUAL_PREFIXES.length);
    for (const prefix of MANUAL_PREFIXES) {
      expect(prefix).toMatch(/^[A-Z]{2}$/);
      expect(['RJ', 'VJ']).not.toContain(prefix);
    }
  });
});

describe('getWorkCodePrefix（提取前缀）', () => {
  it.each([
    ['RJ01173549', 'RJ'],
    ['vj1003042', 'VJ'],
    ['1173549', null],
  ])('%s → %s', (input, expected) => {
    expect(getWorkCodePrefix(input)).toBe(expected);
  });
});

import { describe, expect, it } from 'vitest';
import { getWorkCodePrefix, normalizeWorkId } from './workId';

describe('normalizeWorkId（规范化作品 id）', () => {
  it.each([
    ['RJ01173549', 'RJ01173549'], // 8 位原样保留
    ['rj231176', 'RJ231176'], // 6 位不补零（核心回归用例：迁移作品代码）
    ['231176', 'RJ231176'], // 裸 6 位默认按 RJ 处理
    ['01173549', 'RJ01173549'], // 裸 8 位默认按 RJ 处理
    ['VJ01003042', 'VJ01003042'],
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

describe('getWorkCodePrefix（提取前缀）', () => {
  it.each([
    ['RJ01173549', 'RJ'],
    ['vj1003042', 'VJ'],
    ['1173549', null],
  ])('%s → %s', (input, expected) => {
    expect(getWorkCodePrefix(input)).toBe(expected);
  });
});

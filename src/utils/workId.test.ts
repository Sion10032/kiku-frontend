import { describe, expect, it } from 'vitest';
import { getWorkCodePrefix, normalizeWorkId } from './workId';

describe('normalizeWorkId（规范化作品 id）', () => {
  it.each([
    ['RJ01173549', 'RJ01173549'],
    ['rj1173549', 'RJ01173549'], // 小写前缀归一 + 补零
    ['1173549', 'RJ01173549'], // 无前缀默认按 RJ 处理（既有行为）
    ['VJ01003042', 'VJ01003042'],
    ['vj1003042', 'VJ01003042'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeWorkId(input)).toBe(expected);
  });

  it('数字超 8 位无法解析', () => {
    expect(() => normalizeWorkId('RJ123456789')).toThrow();
  });

  it('非数字输入抛错', () => {
    expect(() => normalizeWorkId('abc')).toThrow();
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

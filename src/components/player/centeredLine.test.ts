import { describe, expect, test } from 'vitest';
import { findCenteredLine } from './centeredLine';

describe('findCenteredLine', () => {
  test('空列表返回 -1', () => {
    expect(findCenteredLine([], 0, 400)).toBe(-1);
  });

  test('单行返回 0', () => {
    expect(findCenteredLine([100], 0, 400)).toBe(0);
  });

  test('距视口中心最近的行胜出', () => {
    // 视口高 400，scrollTop 100 → 中心 300
    // 行中心 100 / 300 / 500 → 命中第 1 行
    expect(findCenteredLine([100, 300, 500], 100, 400)).toBe(1);
    // scrollTop 260 → 中心 460，距 500（40）比距 300（160）近 → 第 2 行
    expect(findCenteredLine([100, 300, 500], 260, 400)).toBe(2);
  });

  test('距离并列时取靠前的行', () => {
    // 中心 300，行中心 200 与 400 等距 → 取 0…1 中靠前者
    expect(findCenteredLine([200, 400], 100, 400)).toBe(0);
  });

  test('scrollTop 为 0 时取最接近视口上半部的行', () => {
    expect(findCenteredLine([10, 500, 900], 0, 400)).toBe(0);
  });
});

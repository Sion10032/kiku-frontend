import { describe, expect, it } from 'vitest';
import { buildPoints, timeTicks } from './LoudnessCurveDialog';

describe('buildPoints', () => {
  it('值映射到画布坐标，null 段断开', () => {
    // 值域 [-70, 0]、宽 300 高 100：-70 → y=100（底），-35 → y=50，-17.5 → y=25
    const pts = buildPoints([-70, -35, null, -17.5], 300, 100, -70, 0);
    expect(pts[0]).toEqual([
      { x: 0, y: 100 },
      { x: 100, y: 50 },
    ]);
    expect(pts[1]).toEqual([{ x: 300, y: 25 }]);
  });
  it('空曲线 → 空段', () => {
    expect(buildPoints([], 300, 100, -70, 0)).toEqual([]);
  });
});

describe('timeTicks', () => {
  it('正常曲线取起点 / 中点 / 末尾（下标即秒）', () => {
    expect(timeTicks(301)).toEqual([
      { sec: 0, anchor: 'start' },
      { sec: 150, anchor: 'middle' },
      { sec: 300, anchor: 'end' },
    ]);
  });
  it('不足 1 秒（单点）只留起点', () => {
    expect(timeTicks(1)).toEqual([{ sec: 0, anchor: 'start' }]);
  });
  it('2 点时中点和末尾重合 → 去重', () => {
    expect(timeTicks(2)).toEqual([
      { sec: 0, anchor: 'start' },
      { sec: 1, anchor: 'end' },
    ]);
  });
  it('空曲线 / 0 点 → 无刻度', () => {
    expect(timeTicks(0)).toEqual([]);
  });
});

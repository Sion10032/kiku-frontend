import { describe, expect, it } from 'vitest';
import { buildPoints } from './LoudnessCurveDialog';

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

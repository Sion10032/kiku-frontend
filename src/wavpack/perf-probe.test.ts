import { describe, expect, it } from 'vitest';
import { shouldWarnLowPerf } from './perf-probe';

describe('shouldWarnLowPerf', () => {
  it('低于阈值判定为低性能（含实测 3× 场景）', () => {
    expect(shouldWarnLowPerf(0.5)).toBe(true);
    expect(shouldWarnLowPerf(3)).toBe(true); // 实测降级浏览器
    expect(shouldWarnLowPerf(4.99)).toBe(true);
  });

  it('达到阈值或无效值不提示', () => {
    expect(shouldWarnLowPerf(5)).toBe(false);
    expect(shouldWarnLowPerf(55)).toBe(false); // 实测 Chrome
    expect(shouldWarnLowPerf(110)).toBe(false); // 实测桌面
    expect(shouldWarnLowPerf(0)).toBe(false); // 测量失败
  });
});

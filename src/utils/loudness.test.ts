import { describe, expect, it } from 'vitest';
import { computeLoudnessGain } from './loudness';

describe('computeLoudnessGain', () => {
  it('基础增益：target(-16) − lufs(-20) = +4 dB（峰值有余量不钳制）', () => {
    expect(computeLoudnessGain(-20, -6, -16, 12)).toBe(4);
  });

  it('防削波钳制：tp=-0.5 时增益压到 -0.5', () => {
    // raw=+4 > cap=-1-(-0.5)=-0.5
    expect(computeLoudnessGain(-20, -0.5, -16, 12)).toBe(-0.5);
  });

  it('最大增益钳制：raw 超出 ±max 时取边界', () => {
    // raw=-26 超出 -5 → -5
    expect(computeLoudnessGain(10, -6, -16, 5)).toBe(-5);
  });

  it('无峰值数据视为极低电平，不做防削波钳制', () => {
    expect(computeLoudnessGain(-20, null, -16, 12)).toBe(4);
  });

  it('未分析（lufs null）→ 0 直通', () => {
    expect(computeLoudnessGain(null, -1, -16, 12)).toBe(0);
  });

  it('保留 1 位小数', () => {
    // target=-16, lufs=-17.3 → +1.3
    expect(computeLoudnessGain(-17.3, -6, -16, 12)).toBe(1.3);
  });
});

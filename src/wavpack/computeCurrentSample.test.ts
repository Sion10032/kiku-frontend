import { describe, expect, it } from 'vitest';
import { computeCurrentSample } from './audio-chunk-scheduler';

// computeCurrentSample(chainStartCtxTime, chainStartSample, ctxNow, rate)
// 链式调度的时间→sample 换算：chainStartSample + (ctxNow - chainStartCtxTime) * rate，
// 结果向下取整且不小于 chainStartSample。

describe('computeCurrentSample', () => {
  it('线性外推：ctx 时间差 × rate 叠加到链起点', () => {
    // 1.5s × 48000 = 72000
    expect(computeCurrentSample(10, 1000, 11.5, 48000)).toBe(73000);
  });

  it('零经过时间：返回链起点 sample', () => {
    expect(computeCurrentSample(10, 1000, 10, 48000)).toBe(1000);
  });

  it('ctxNow 早于链起点（时钟回拨/调度误差）：钳制到链起点', () => {
    expect(computeCurrentSample(10, 1000, 9.9, 48000)).toBe(1000);
  });

  it('小数 sample 向下取整', () => {
    // 0.5s × 44100 = 22050.5 → 22050
    expect(computeCurrentSample(0, 0, 0.5, 44100)).toBe(22050);
  });

  it('rate 为 0：不产生 NaN/Infinity，返回链起点', () => {
    expect(computeCurrentSample(10, 1000, 12, 0)).toBe(1000);
  });

  it('负 elapsed 与正 rate：仍钳制到链起点', () => {
    expect(computeCurrentSample(100, 48000, 99, 48000)).toBe(48000);
  });

  it('长链累计偏移保持整数精度（典型一首曲目的 sample 量级）', () => {
    // ~5 分钟曲目的中间位置：起点 10,000,000 + 2.5s × 44100
    expect(computeCurrentSample(1000, 10_000_000, 1002.5, 44100)).toBe(
      10_110_250,
    );
  });

  it('rate 为小数（DSD-as-PCM 等非整速率）仍正确换算', () => {
    // 5644800（DSD64 立体声）÷8 = 705600 整数，此处用 2822400/2 验证小数 rate
    expect(computeCurrentSample(0, 0, 1, 2822400.5)).toBe(2822400);
  });
});

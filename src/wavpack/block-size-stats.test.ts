import { describe, expect, it } from 'vitest';
import { createBlockSizeTracker } from './block-size-stats';

describe('createBlockSizeTracker：running mean 统计', () => {
  it('首个观测直接成为均值（load 首块初始化）', () => {
    const t = createBlockSizeTracker();
    t.observe(24000, 139264);
    expect(t.mean).toBe(139264);
    expect(t.count).toBe(1);
  });

  it('running mean：mean += (size - mean) / count', () => {
    const t = createBlockSizeTracker();
    t.observe(1000, 100);
    t.observe(1000, 200);
    t.observe(1000, 300);
    // 100 → 150 → 200
    expect(t.count).toBe(3);
    expect(t.mean).toBeCloseTo(200, 10);
  });

  it('非音频块（blockSamples=0，如 66B 杂块）不计入均值', () => {
    const t = createBlockSizeTracker();
    t.observe(1000, 139264);
    t.observe(0, 66); // metadata/杂块
    t.observe(1000, 135168);
    expect(t.count).toBe(2);
    expect(t.mean).toBeCloseTo((139264 + 135168) / 2, 10);
  });

  it('负 blockSamples / 非 0 blockSize 防御：均不计入', () => {
    const t = createBlockSizeTracker();
    t.observe(1000, 100);
    t.observe(-1, 999);
    t.observe(1000, 0);
    expect(t.count).toBe(1);
    expect(t.mean).toBe(100);
  });

  it('数值稳定性：百万次大幅波动观测后均值仍准确（不累积浮点漂移）', () => {
    const t = createBlockSizeTracker();
    const sizes = [87 * 1024, 136 * 1024, 158 * 1024];
    const n = 1_000_000;
    for (let i = 0; i < n; i++) {
      t.observe(24000, sizes[i % 3]);
    }
    const expected = (sizes[0] + sizes[1] + sizes[2]) / 3;
    // running mean 的浮点漂移为相对量级（百万次后 ~3e-7 相对误差），
    // 对 seek 窗口先验用途（KB 级容错）完全无影响
    expect(Math.abs(t.mean - expected)).toBeLessThan(expected * 1e-6);
  });

  it('无观测时 mean=0（调用方以此判定 hint 不可用）', () => {
    const t = createBlockSizeTracker();
    expect(t.mean).toBe(0);
    expect(t.count).toBe(0);
    t.observe(0, 66); // 仅杂块也不产生 hint
    expect(t.mean).toBe(0);
    expect(t.count).toBe(0);
  });
});

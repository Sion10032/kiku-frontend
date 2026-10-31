import { describe, expect, it } from 'vitest';
import { BenchStats, rateVerdict } from './bench-stat';

/** 以 48kHz 每秒 48000 样本计，解码墙钟固定 x ms/chunk */
function feed(
  stats: BenchStats,
  chunks: number,
  samplesPerChunk: number,
  sampleRate: number,
  wallMsPerChunk: number,
): void {
  for (let i = 0; i < chunks; i++) {
    stats.add(samplesPerChunk, sampleRate, wallMsPerChunk);
  }
}

describe('BenchStats', () => {
  it('凑满一段音频时长才产出段', () => {
    const stats = new BenchStats(10); // 10 秒一段
    // 48kHz：每 chunk 1 秒音频、墙钟 0.5 秒（r=2）
    expect(stats.add(48000, 48000, 500)).toBeNull(); // 1s
    feed(stats, 8, 48000, 48000, 500); // 累计 9s，仍不满
    expect(stats.summary().audioSec).toBeCloseTo(9, 5);
    const seg = stats.add(48000, 48000, 500); // 10s → 满一段
    expect(seg).not.toBeNull();
    expect(seg?.index).toBe(0);
    expect(seg?.audioSec).toBeCloseTo(10, 5);
    expect(seg?.wallSec).toBeCloseTo(5, 5);
    expect(seg?.rate).toBeCloseTo(2, 3);
    expect(seg?.cumulativeRate).toBeCloseTo(2, 3);
  });

  it('累计速率含历史段（慢段拉低累计）', () => {
    const stats = new BenchStats(2);
    // 段 0：r = 2（2s 音频 / 1s 墙钟）
    feed(stats, 2, 48000, 48000, 500);
    // 段 1：r = 0.5（2s 音频 / 4s 墙钟）
    feed(stats, 2, 48000, 48000, 2000);
    const segs = [stats.add(48000, 48000, 500)];
    // 上面 feed 完恰满两段；最后 add 是第三段的第一秒
    expect(segs[0]).toBeNull();
    const s = stats.summary();
    expect(s.audioSec).toBeCloseTo(5, 5); // 2 + 2 + 1
    expect(s.wallSec).toBeCloseTo(5.5, 5); // 1 + 4 + 0.5
    expect(s.rate).toBeCloseTo(5 / 5.5, 3);
  });

  it('样本数为 0 的 chunk 只累计墙钟不计音频', () => {
    const stats = new BenchStats(10);
    stats.add(0, 48000, 100); // 空 decode（如尾块）耗 100ms
    expect(stats.summary().audioSec).toBe(0);
    expect(stats.summary().wallSec).toBeCloseTo(0.1, 5);
    expect(stats.summary().totalSamples).toBe(0);
  });

  it('summary 速率零墙钟时为 0（不产生 NaN/Infinity）', () => {
    const stats = new BenchStats(10);
    expect(stats.summary().rate).toBe(0);
  });
});

describe('rateVerdict', () => {
  it('分级边界', () => {
    expect(rateVerdict(0.7)).toContain('不足');
    expect(rateVerdict(1.0)).toContain('临界');
    expect(rateVerdict(1.2)).toContain('临界');
    expect(rateVerdict(1.3)).toContain('从容');
    expect(rateVerdict(3)).toContain('从容');
  });
});

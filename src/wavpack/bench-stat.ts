// wv 解码基准统计：把逐 chunk 的（样本数, 墙钟毫秒）聚合成"每 N 秒音频一段"
// 的速率表 + 总汇总。纯函数模块（主线程/worker 共用），便于 Vitest 覆盖。
//
// 速率 rate = 音频时长 / 墙钟耗时（即解码实时倍率 r）：
// r > 1.3 供给从容；1.0~1.3 临界（易被网络/渲染竞争击穿）；< 1.0 供不应求。

export interface BenchSegment {
  /** 段序号（0 起） */
  index: number;
  /** 本段音频时长（秒） */
  audioSec: number;
  /** 本段墙钟耗时（秒） */
  wallSec: number;
  /** 本段瞬时速率 r */
  rate: number;
  /** 截至本段的累计速率 r */
  cumulativeRate: number;
}

export interface BenchSummary {
  audioSec: number;
  wallSec: number;
  /** 累计速率 r */
  rate: number;
  /** 消费的样本总数 */
  totalSamples: number;
}

/** 速率结论（供 UI 分级展示） */
export function rateVerdict(rate: number): string {
  if (rate >= 1.3) return '从容（≥1.3×，供给充裕）';
  if (rate >= 1.0) return '临界（1.0~1.3×，易被偶发开销击穿卡顿）';
  return '不足（<1.0×，解码跟不上播放，必卡）';
}

/**
 * 按音频时长分段的累计器。每 chunk 解码后调用 add()；
 * 每凑满 segmentAudioSec 秒音频产出一段 BenchSegment。
 */
export class BenchStats {
  private readonly segmentAudioSec: number;
  private segAudioSec = 0;
  private segWallMs = 0;
  private totalAudioSec = 0;
  private totalWallMs = 0;
  private totalSamples = 0;
  private index = 0;

  constructor(segmentAudioSec = 10) {
    this.segmentAudioSec = Math.max(0.001, segmentAudioSec);
  }

  /**
   * 记入一个 chunk 的解码结果。
   * @param samples 本 chunk 产出的每声道样本数
   * @param sampleRate 采样率（首个非零 chunk 之后才有意义）
   * @param wallMs 本 chunk 解码墙钟毫秒
   * @returns 凑满一段时返回该段，否则返回 null
   */
  add(
    samples: number,
    sampleRate: number,
    wallMs: number,
  ): BenchSegment | null {
    this.totalSamples += samples;
    this.totalWallMs += wallMs;
    this.segWallMs += wallMs;
    if (sampleRate > 0 && samples > 0) {
      const audioSec = samples / sampleRate;
      this.totalAudioSec += audioSec;
      this.segAudioSec += audioSec;
    }
    if (this.segAudioSec >= this.segmentAudioSec) {
      const seg: BenchSegment = {
        index: this.index,
        audioSec: this.segAudioSec,
        wallSec: this.segWallMs / 1000,
        rate:
          this.segWallMs > 0 ? (this.segAudioSec * 1000) / this.segWallMs : 0,
        cumulativeRate:
          this.totalWallMs > 0
            ? (this.totalAudioSec * 1000) / this.totalWallMs
            : 0,
      };
      this.index += 1;
      this.segAudioSec = 0;
      this.segWallMs = 0;
      return seg;
    }
    return null;
  }

  /** 截至当前的汇总（结束时调用；不足一段的尾部也计入） */
  summary(): BenchSummary {
    return {
      audioSec: this.totalAudioSec,
      wallSec: this.totalWallMs / 1000,
      rate:
        this.totalWallMs > 0
          ? (this.totalAudioSec * 1000) / this.totalWallMs
          : 0,
      totalSamples: this.totalSamples,
    };
  }
}

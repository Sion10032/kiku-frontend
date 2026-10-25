import type { LoudnessInfo } from '../types';

/**
 * 响度增益计算（纯函数）：作品加权 LUFS → 播放均衡增益（dB，1 位小数）。
 * 目标响度 / 最大增益为用户级设置，故在客户端计算（服务端仅下发测量值）。
 */
export function computeLoudnessGain(
  lufs: number | null,
  truePeakDb: number | null,
  targetLufs: number,
  maxGainDb: number,
): number {
  // 未分析 → 0（直通，与均衡关闭一致）
  if (lufs == null) return 0;
  const raw = targetLufs - lufs;
  // 防削波：正向增益不得把峰值推过 -1 dBTP（无峰值数据视为极低，不设限）
  const cap = -1 - (truePeakDb ?? -99);
  return (
    Math.round(Math.max(-maxGainDb, Math.min(maxGainDb, raw, cap)) * 10) / 10
  );
}

/** 音轨应生效的均衡增益（dB）：开关关闭 / 无快照 / 未分析 → 0（直通）。 */
export function trackGainDb(
  loudness: LoudnessInfo | undefined,
  enabled: boolean,
  targetLufs: number,
  maxGainDb: number,
): number {
  if (!enabled) return 0;
  return computeLoudnessGain(
    loudness?.lufs ?? null,
    loudness?.truePeakDb ?? null,
    targetLufs,
    maxGainDb,
  );
}

/**
 * 均衡增益 dB → GainNode 线性系数（单一来源，正常播放与 .wv 调度器共用）。
 * clamp(-60, 20) 后取 10^(db/20)：+20dB 防失控硬上限，-60dB 视为静音地板。
 * 平滑时间常数属调用方各自的 setTargetAtTime（统一 0.05s）。
 */
export function loudnessLinear(db: number): number {
  const capped = Math.max(-60, Math.min(20, db));
  return 10 ** (capped / 20);
}

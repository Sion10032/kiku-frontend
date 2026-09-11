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

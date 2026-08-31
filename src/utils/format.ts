/**
 * 格式化时长为 m:ss(小时以上为 h:mm:ss)；null/undefined（时长未知）返回 '—'。
 *
 * @param seconds 秒数(负数/非有限值按 0 处理；null/undefined 视为未知)
 */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return '—';
  const total =
    Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

/**
 * 剩余时间文本：-mm:ss（小时以上 -h:mm:ss），用于「时间显示模式」设置。
 *
 * duration 无效（<=0 或 NaN，如未加载/直播）时回退 "0:00"（不带负号）。
 *
 * @param currentTime 当前播放位置（秒）
 * @param duration 总时长（秒）
 */
export function formatRemaining(currentTime: number, duration: number): string {
  if (!Number.isFinite(duration) || duration <= 0) return '0:00';
  const rest = Math.max(
    0,
    duration - (Number.isFinite(currentTime) ? currentTime : 0),
  );
  return `-${formatDuration(rest)}`;
}

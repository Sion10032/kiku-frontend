import type { UserWorkProgress } from '../types';

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
 * 格式化作品总时长为人类可读文本（"5.4 小时" / "45 分钟"），用于封面角标。
 *
 * 与 formatDuration 的 h:mm:ss 播放器格式不同：这里面向浏览场景，
 * ≥ 1 小时取一位小数小时，不足 1 小时取整分钟。
 *
 * @param seconds 秒数；null/undefined/非有限值/<=0 视为未知，返回 null（调用方不渲染）
 */
export function formatTotalDuration(
  seconds: number | null | undefined,
): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }
  if (seconds >= 3600) {
    return `${(seconds / 3600).toFixed(1)} 小时`;
  }
  return `${Math.round(seconds / 60)} 分钟`;
}

/**
 * 格式化作品播放进度角标文本：有音轨时长为整百分比（"42%"），
 * 无时长但有记录为「正在听」。
 *
 * 百分比是「上次播放音轨内」的进度（position/duration），
 * 不是整部作品的进度（缺少总时长/总轨数）。
 *
 * @param progress 播放进度聚合；null/undefined（未听/未登录）返回 null（调用方不渲染）
 */
export function formatProgress(
  progress: UserWorkProgress | null | undefined,
): string | null {
  if (progress == null) return null;
  const { position, duration } = progress;
  if (duration != null && Number.isFinite(duration) && duration > 0) {
    const percent = Math.min(100, Math.round((position / duration) * 100));
    return `${percent}%`;
  }
  return '正在听';
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

import { reportProgress } from '../api/progress';
import { ApiError } from '../api/client';
import { getToken } from '../api/token';
import { useUserStore } from '../stores/userStore';

/**
 * 播放进度上报器（模块单例）。
 *
 * - 仅登录用户上报；未登录静默丢弃
 * - 节流：播放中最多每 10s 发出一次（由 usePlayer 的 250ms 轮询驱动）
 * - flush 时机：暂停、切曲、音轨自然结束（position=duration）、
 *   页面隐藏/卸载（keepalive）
 * - 删除联动守卫：suppressWorkProgress 后不再上报该作品，
 *   直到播放切到其他作品（防止删除后被下个节流窗口重建记录）
 * - 失败静默：下个节流窗口重试
 */

/** 节流间隔（ms）：播放中最多每 10s 上报一次 */
const THROTTLE_MS = 10_000;

/** 待上报的当前播放状态 */
interface PendingReport {
  workId: string;
  hash: string;
  title: string;
  position: number;
  duration: number | null;
  /** 最近一次发出上报的时刻（节流基准；0 = 尚未发过） */
  lastSentAt: number;
}

let pending: PendingReport | null = null;

/** 已删除进度、禁止再上报的作品 id（切到其他作品后解除） */
let suppressedWorkId: string | null = null;

/** 服务端已确认不存在的作品（上报 404），永不再上报 */
const deadWorks = new Set<string>();

/** 会话已失效（上报 401），全局停发；重新登录（auth→true）后复位 */
let disabled = false;

// 重新登录后恢复上报能力（如清库后换账号登录）
useUserStore.subscribe((s) => {
  if (s.auth) disabled = false;
});

/** 页面级监听只注册一次 */
let listenersInstalled = false;

function isAuthed(): boolean {
  // 登录态双重校验：store 标记（restoreSession/login 置位）+ 实际持有 token；
  // 任一缺失即未登录，不发请求（未登录浏览、会话恢复中、已登出）
  return !disabled && useUserStore.getState().auth && !!getToken();
}

async function send(keepalive = false): Promise<void> {
  const p = pending;
  if (!p || !isAuthed()) return;
  if (suppressedWorkId === p.workId || deadWorks.has(p.workId)) return;
  // 先置 lastSentAt 再发：失败也不狂重试，下个节流窗口自然覆盖
  pending = { ...p, lastSentAt: Date.now() };
  try {
    await reportProgress(
      {
        work_id: p.workId,
        media_index: p.hash,
        track_title: p.title,
        position: p.position,
        duration: p.duration,
      },
      { keepalive },
    );
  } catch (err) {
    // 拦截后不再重发：404 作品不在库（前端缓存页面播放已重建库）；
    // 401 用户不存在（幽灵 token，全局 beforeError 已清 token 跳登录）
    if (err instanceof ApiError) {
      if (err.status === 404) deadWorks.add(p.workId);
      else if (err.status === 401) disabled = true;
    }
  }
}

/** 惰性注册页面级 flush（visibilitychange / beforeunload）。 */
function installListeners(): void {
  if (listenersInstalled || typeof window === 'undefined') return;
  listenersInstalled = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void send(true);
  });
  window.addEventListener('beforeunload', () => {
    void send(true);
  });
}

/** 上报的目标音轨（playerStore.Track 的最小字段）。 */
export interface ProgressTrack {
  workId: string;
  hash: string;
  title: string;
}

/**
 * 记录播放位置（播放轮询高频调用，内部节流）。
 *
 * 首次记录（lastSentAt=0）立即发出——开始播放即建立"已读"。
 */
export function trackPlayback(
  track: ProgressTrack,
  position: number,
  duration: number | null,
): void {
  installListeners();
  if (!isAuthed() || deadWorks.has(track.workId)) return;

  // 切到其他作品：解除删除守卫（新一轮收听重新记录）
  if (suppressedWorkId && suppressedWorkId !== track.workId) {
    suppressedWorkId = null;
  }
  if (suppressedWorkId === track.workId) return;

  pending = {
    workId: track.workId,
    hash: track.hash,
    title: track.title,
    position,
    duration,
    lastSentAt: pending?.workId === track.workId ? pending.lastSentAt : 0,
  };

  if (Date.now() - pending.lastSentAt >= THROTTLE_MS) void send();
}

/** 立即发出当前待上报进度（暂停、切曲时）。 */
export function flushProgress(): void {
  void send(true);
}

/** 音轨自然结束：上报 position=duration 并立即发送（计入已听轨数）。 */
export function reportTrackEnd(track: ProgressTrack, duration: number): void {
  installListeners();
  if (
    !isAuthed()
    || deadWorks.has(track.workId)
    || suppressedWorkId === track.workId
  )
    return;
  pending = {
    workId: track.workId,
    hash: track.hash,
    title: track.title,
    position: duration,
    duration,
    lastSentAt: 0,
  };
  void send();
}

/**
 * 删除进度后的联动守卫：停止上报该作品。
 * 直到播放切到其他作品（trackPlayback 自动解除）。
 */
export function suppressWorkProgress(workId: string): void {
  suppressedWorkId = workId;
  if (pending?.workId === workId) pending = null;
}

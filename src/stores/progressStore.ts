import { create } from 'zustand';

/** 单轨播放进度（秒）。 */
export interface TrackProgress {
  position: number;
  duration: number | null;
}

interface ProgressState {
  /** workId → mediaIndex(hash) → 进度 */
  byWork: Record<string, Record<string, TrackProgress>>;
  /** 详情页进度行注入（整作品覆盖） */
  hydrate: (
    workId: string,
    rows: Array<{
      mediaIndex: string;
      position: number;
      duration: number | null;
    }>,
  ) => void;
  /** 上报成功/自然结束时写入单轨 */
  record: (
    workId: string,
    hash: string,
    position: number,
    duration: number | null,
  ) => void;
  /** 删除作品进度后清缓存 */
  clearWork: (workId: string) => void;
}

export const useProgressStore = create<ProgressState>()((set) => ({
  byWork: {},
  hydrate: (workId, rows) =>
    set((s) => ({
      byWork: {
        ...s.byWork,
        [workId]: Object.fromEntries(
          rows.map((r) => [
            r.mediaIndex,
            { position: r.position, duration: r.duration },
          ]),
        ),
      },
    })),
  record: (workId, hash, position, duration) =>
    set((s) => ({
      byWork: {
        ...s.byWork,
        [workId]: {
          ...s.byWork[workId],
          [hash]: { position, duration },
        },
      },
    })),
  clearWork: (workId) =>
    set((s) => {
      const { [workId]: _removed, ...rest } = s.byWork;
      return { byWork: rest };
    }),
}));

/** 听完判定：进度占比达到该值即视为听完（手动点击时从头重播）。 */
export const RESTART_RATIO = 0.99;
/** 听完判定：剩余时间不超过该秒数即视为听完（手动点击时从头重播）。 */
export const RESTART_REMAINING_SEC = 10;

/**
 * 续播策略（手动点击路径）：有未完历史 → 返回上次进度作为恢复起点；
 * 已听完（进度 ≥ RESTART_RATIO 或剩余 ≤ RESTART_REMAINING_SEC）、
 * 无历史或未开始 → undefined（从头）。duration 未知时无法判定听完，
 * 有进度即视为未听完。
 */
export function selectResumeStartAt(
  state: Pick<ProgressState, 'byWork'>,
  workId: string,
  hash: string,
): number | undefined {
  const p = state.byWork[workId]?.[hash];
  if (!p || p.position <= 0) return undefined;
  if (p.duration != null && p.duration > 0) {
    const finished =
      p.position / p.duration >= RESTART_RATIO
      || p.duration - p.position <= RESTART_REMAINING_SEC;
    if (finished) return undefined;
  }
  return p.position;
}

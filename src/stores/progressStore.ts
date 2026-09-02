import { create } from 'zustand';

/** 听完判定阈值（与后端 progress.service.LISTENED_RATIO 一致）。 */
export const LISTENED_RATIO = 0.95;

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

/**
 * 续播策略（D5）：有未完历史 → 返回恢复起点；已听完/无历史 → undefined（从头）。
 * duration 未知时以 position > 0 为「未听完」。
 */
export function selectResumeStartAt(
  state: Pick<ProgressState, 'byWork'>,
  workId: string,
  hash: string,
): number | undefined {
  const p = state.byWork[workId]?.[hash];
  if (!p || p.position <= 0) return undefined;
  if (
    p.duration != null
    && p.duration > 0
    && p.position / p.duration >= LISTENED_RATIO
  ) {
    return undefined;
  }
  return p.position;
}

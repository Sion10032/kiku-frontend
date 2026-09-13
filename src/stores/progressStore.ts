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

/**
 * 续播策略：有历史且 position > 0 → 返回上次进度作为恢复起点；
 * 无历史或未开始 → undefined（从头）。已听完轨 seek 到末尾后由 ended
 * 自然触发 nextTrack 衔接下一轨（order 队尾停止为已知接受行为）。
 */
export function selectResumeStartAt(
  state: Pick<ProgressState, 'byWork'>,
  workId: string,
  hash: string,
): number | undefined {
  const p = state.byWork[workId]?.[hash];
  if (!p || p.position <= 0) return undefined;
  return p.position;
}

import { useEffect, useMemo } from 'react';
import type { BatchInfo, WorkPipelineState } from '../api/tasks';
import { fetchTaskSnapshot, subscribeTaskEvents } from '../api/tasks';
import { useTasksStore } from '../stores/tasks';

// 单例连接管理：多组件共享一条 SSE（refCount 归零才断开）
let refCount = 0;
let unsubscribe: (() => void) | null = null;

function ensureSubscribed(): void {
  const state = useTasksStore.getState();
  state.setConnected(false);
  unsubscribe = subscribeTaskEvents(
    (event) => useTasksStore.getState().apply(event),
    {
      onOpen: () => useTasksStore.getState().setConnected(true),
      onError: () => useTasksStore.getState().setConnected(false),
    },
  );
  // 初始快照（SSE onopen 也推，双保险；失败静默等待 SSE 快照）
  void fetchTaskSnapshot()
    .then((snapshot) =>
      useTasksStore.getState().apply({ type: 'TASK_SNAPSHOT', snapshot }),
    )
    .catch(() => {});
}

/**
 * 任务中心状态入口：单例订阅 /api/tasks/events，返回共享快照与连接状态。
 * 任务中心 / 面板指示器 / 作品页行内状态都从这里投影（单一状态源）。
 */
export function useTasks(): {
  snapshot: ReturnType<typeof useTasksStore.getState>['snapshot'];
  connected: boolean;
} {
  const snapshot = useTasksStore((s) => s.snapshot);
  const connected = useTasksStore((s) => s.connected);

  useEffect(() => {
    refCount++;
    if (refCount === 1) ensureSubscribed();
    return () => {
      refCount--;
      if (refCount === 0) {
        unsubscribe?.();
        unsubscribe = null;
        useTasksStore.getState().setConnected(false);
      }
    };
  }, []);

  return { snapshot, connected };
}

/** 活跃批次列表（批次卡片行） */
export function useBatches(): BatchInfo[] {
  return useTasksStore((s) => s.snapshot.batches);
}

/** 单作品流水线投影（作品页行内状态） */
export function usePipeline(workId: string) {
  return useTasksStore((s) =>
    s.snapshot.pipelines.find((p) => p.workId === workId),
  );
}

/** 活跃手动流水线（作品页高优注入，不建批次卡）：存在无 batchId 且 pending/running 的阶段。
 *  任务面板入口与活跃计数据此纳入手动任务——否则无批次时入口隐藏，手动任务无处可看。
 *  选原始 pipelines 引用再 useMemo 派生，避免 selector 每次返回新数组触发无限重渲染。 */
export function useActiveManualPipelines(): WorkPipelineState[] {
  const pipelines = useTasksStore((s) => s.snapshot.pipelines);
  return useMemo(
    () =>
      pipelines.filter((p) =>
        Object.values(p.phases).some(
          (ph) =>
            !ph.batchId && (ph.status === 'running' || ph.status === 'pending'),
        ),
      ),
    [pipelines],
  );
}

import { create } from 'zustand';
import type {
  AnalysisSummaryResults,
  BatchCounters,
  BatchInfo,
  BatchKind,
  PhaseEntry,
  ScanSummaryResults,
  TaskEvent,
  TaskSnapshot,
} from '../api/tasks';

export const LOG_CAP = 500;

export function emptyTaskSnapshot(): TaskSnapshot {
  return { batches: [], pipelines: [], logs: [] };
}

function upsertPipeline(state: TaskSnapshot, e: PhaseEntry): TaskSnapshot {
  const idx = state.pipelines.findIndex((p) => p.workId === e.workId);
  const pipelines = [...state.pipelines];
  if (idx < 0) {
    pipelines.push({
      workId: e.workId,
      phases: { [e.phase]: e },
      updatedAt: e.changedAt,
    });
  } else {
    const prev = pipelines[idx];
    if (!prev) return state;
    pipelines[idx] = {
      ...prev,
      phases: { ...prev.phases, [e.phase]: e },
      updatedAt: e.changedAt,
    };
  }
  return { ...state, pipelines };
}

function upsertBatch(
  state: TaskSnapshot,
  counters: BatchCounters,
): TaskSnapshot {
  const idx = state.batches.findIndex((b) => b.batchId === counters.batchId);
  const batches = [...state.batches];
  if (idx < 0) {
    // 防御性创建（正常流程 startBatch 先于任何 delta）
    batches.push({
      batchId: counters.batchId,
      kind: counters.kind,
      createdAt: '',
      counters,
      status: 'running',
    });
  } else {
    const prev = batches[idx];
    if (!prev) return state;
    batches[idx] = { ...prev, counters };
  }
  return { ...state, batches };
}

function markBatchCompleted(
  state: TaskSnapshot,
  batchId: string,
  kind: BatchKind,
  results: ScanSummaryResults | AnalysisSummaryResults,
  completedAt: string,
): TaskSnapshot {
  const idx = state.batches.findIndex((b) => b.batchId === batchId);
  const batches = [...state.batches];
  if (idx < 0) {
    batches.push({
      batchId,
      kind,
      createdAt: '',
      counters: {
        batchId,
        kind,
        total: 0,
        running: 0,
        completed: 0,
        failed: 0,
      },
      status: 'completed',
      completedAt,
      results,
    });
  } else {
    const prev = batches[idx];
    if (!prev) return state;
    batches[idx] = { ...prev, status: 'completed', completedAt, results };
  }
  return { ...state, batches };
}

/**
 * 快照归并（纯函数，语义镜像 kiku-backend src/scanner/taskEvents.ts 的 applyTaskEvent）。
 * 两端各持一份实现（独立 git 仓库不共享包），用 parity 语义锚定：delta upsert /
 * counters 防御创建 / summary 终态 / 日志 500 封顶 / snapshot 整体替换。
 */
export function applyTaskEvent(
  snapshot: TaskSnapshot,
  event: TaskEvent,
): TaskSnapshot {
  switch (event.type) {
    case 'TASK_SNAPSHOT':
      // 防御：畸形帧（snapshot 缺失）忽略该事件，不覆盖现有快照
      return event.snapshot ?? snapshot;
    case 'TASK_DELTA': {
      let s = snapshot;
      for (const e of event.entries) s = upsertPipeline(s, e);
      for (const c of event.counters) s = upsertBatch(s, c);
      return s;
    }
    case 'BATCH_SUMMARY':
      return markBatchCompleted(
        snapshot,
        event.batchId,
        event.kind,
        event.results,
        event.completedAt,
      );
    case 'BATCH_LOG': {
      const logs = [...snapshot.logs, event.log];
      return {
        ...snapshot,
        logs: logs.length > LOG_CAP ? logs.slice(logs.length - LOG_CAP) : logs,
      };
    }
  }
}

// ---------- 选择器（供组件订阅切片，避免整快照重渲染） ----------

export function selectBatches(state: TaskSnapshot): BatchInfo[] {
  return state.batches;
}

export function selectPipeline(state: TaskSnapshot, workId: string) {
  return state.pipelines.find((p) => p.workId === workId);
}

interface TasksState {
  snapshot: TaskSnapshot;
  connected: boolean;
  /** 归并一条事件进快照 */
  apply: (event: TaskEvent) => void;
  setConnected: (connected: boolean) => void;
}

export const useTasksStore = create<TasksState>()((set) => ({
  snapshot: emptyTaskSnapshot(),
  connected: false,
  apply: (event) =>
    set((s) => ({ snapshot: applyTaskEvent(s.snapshot, event) })),
  setConnected: (connected) => set({ connected }),
}));

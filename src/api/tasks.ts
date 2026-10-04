import { fetchEventSource } from '@microsoft/fetch-event-source';
import { apiFetch } from './client';
import { getToken } from './token';

// ---------- 任务事件协议（镜像 kiku-backend src/scanner/taskEvents.ts） ----------

export type Phase = 'metadata' | 'cover' | 'track' | 'analyze';
export type PhaseStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped';
export type BatchKind = 'scan' | 'update' | 'analysis';

export interface PhaseEntry {
  workId: string;
  phase: Phase;
  status: PhaseStatus;
  error?: string;
  batchId?: string;
  /** ISO 时间戳，全部事件强制带 */
  changedAt: string;
}

export interface BatchCounters {
  batchId: string;
  kind: BatchKind;
  total: number;
  running: number;
  completed: number;
  failed: number;
}

export type BatchStatus = 'running' | 'completed' | 'cancelled' | 'failed';

export interface BatchInfo {
  batchId: string;
  kind: BatchKind;
  createdAt: string;
  counters: BatchCounters;
  status: BatchStatus;
  completedAt?: string;
  /** 批次收尾汇总（服务端直出），随 BATCH_SUMMARY 写入 */
  results?: ScanSummaryResults | AnalysisSummaryResults;
}

export interface BatchLog {
  level: string;
  message: string;
  timestamp: string;
  batchId?: string;
  workId?: string;
}

export interface WorkPipelineState {
  workId: string;
  phases: Partial<Record<Phase, PhaseEntry>>;
  updatedAt: string;
}

export interface TaskSnapshot {
  batches: BatchInfo[];
  pipelines: WorkPipelineState[];
  logs: BatchLog[];
}

export interface ScanSummaryResults {
  total: number;
  added: number;
  updated: number;
  failed: number;
  skipped: number;
  removed: number;
  purged: number;
}

export interface AnalysisSummaryResults {
  totalWorks: number;
  analyzedTracks: number;
  failedTracks: number;
  failedWorks: number;
}

export type TaskEvent =
  | { type: 'TASK_SNAPSHOT'; snapshot: TaskSnapshot }
  | { type: 'TASK_DELTA'; entries: PhaseEntry[]; counters: BatchCounters[] }
  | {
      type: 'BATCH_SUMMARY';
      batchId: string;
      kind: BatchKind;
      results: ScanSummaryResults | AnalysisSummaryResults;
      completedAt: string;
    }
  | { type: 'BATCH_LOG'; log: BatchLog };

// ---------- API ----------

/** 权威快照（GET /api/tasks；重连补播与首屏数据源） */
export function fetchTaskSnapshot(): Promise<TaskSnapshot> {
  return apiFetch<TaskSnapshot>('tasks');
}

/**
 * 订阅任务事件流（GET /api/tasks/events，SSE）。
 *
 * 返回 unsubscribe：调用即 abort 连接。重连由 fetch-event-source 按默认策略处理。
 * 私有模式下事件流需 JWT，故走 fetch-event-source（原生 EventSource 无法带 header）。
 */
export function subscribeTaskEvents(
  onEvent: (event: TaskEvent) => void,
): () => void {
  const ctrl = new AbortController();
  const token = getToken();
  void fetchEventSource('/api/tasks/events', {
    method: 'GET',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal: ctrl.signal,
    onmessage(ev) {
      try {
        onEvent(JSON.parse(ev.data) as TaskEvent);
      } catch {
        // 非 JSON 帧忽略（保活注释等）
      }
    },
  });
  return () => ctrl.abort();
}

/** 取消任务：id 为 batchId（取消批次）或 workId（取消单作品流水线） */
export function cancelTask(id: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`tasks/${id}`, { method: 'DELETE' });
}

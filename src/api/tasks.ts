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
  /**
   * 终态固化：收尾时该批次实际处理过的作品名单（去重）。
   * 活流水线按 workId 全局唯一，后续批次重跑同作品会改写归属，
   * 历史批次卡靠这份名单渲染条目，不随新批次漂移。
   */
  workIds?: string[];
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
      /** 终态固化条目名单（与快照同步携带，事件流消费者免拉快照） */
      workIds: string[];
    }
  | { type: 'BATCH_LOG'; log: BatchLog };

// ---------- 批次触发（原 api/scanner.ts、api/analysis.ts 的触发通道，B6 迁入） ----------

/** 扫描模式：scan=扫盘新增；update=刷新库内作品元数据。 */
export type ScanMode = 'scan' | 'update';

/** 触发扫描/更新（入队编排）：POST /api/scanner/scan → { batchId }；在跑 409 */
export function startScan(
  mode: ScanMode = 'scan',
  workIds?: string[],
): Promise<{ success: boolean; batchId: string }> {
  return apiFetch<{ success: boolean; batchId: string }>('scanner/scan', {
    method: 'POST',
    json: { mode, ...(workIds ? { workIds } : {}) },
  });
}

/** 终止扫描/更新：POST /api/scanner/kill（按活跃 scan:all 批次取消） */
export function killScan(): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>('scanner/kill', { method: 'POST' });
}

/** 触发响度分析（全量 pending 或子集）：POST /api/analysis/start → { batchId } */
export function startAnalysis(
  workIds?: string[],
  priority: 'low' | 'high' = 'low',
): Promise<{ success: boolean; batchId: string }> {
  return apiFetch<{ success: boolean; batchId: string }>('analysis/start', {
    method: 'POST',
    json: { priority, ...(workIds ? { workIds } : {}) },
  });
}

/** 终止响度分析：POST /api/analysis/stop（按活跃 analysis 批次取消） */
export function killAnalysis(): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>('analysis/stop', { method: 'POST' });
}

// ---------- API ----------

/** 权威快照（GET /api/tasks；重连补播与首屏数据源）。响应为 {snapshot} 包裹，此处解包。 */
export function fetchTaskSnapshot(): Promise<TaskSnapshot> {
  return apiFetch<{ snapshot: TaskSnapshot }>('tasks').then((r) => r.snapshot);
}

export interface SubscribeHooks {
  /** 连接建立（含自动重连成功） */
  onOpen?: () => void;
  /** 连接错误（fetch-event-source 默认自动重连） */
  onError?: (err: unknown) => void;
}

/**
 * 订阅任务事件流（GET /api/tasks/events，SSE）。
 *
 * 返回 unsubscribe：调用即 abort 连接。重连由 fetch-event-source 按默认策略处理。
 * 私有模式下事件流需 JWT，故走 fetch-event-source（原生 EventSource 无法带 header）。
 */
export function subscribeTaskEvents(
  onEvent: (event: TaskEvent) => void,
  hooks?: SubscribeHooks,
): () => void {
  const ctrl = new AbortController();
  const token = getToken();
  void fetchEventSource('/api/tasks/events', {
    method: 'GET',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal: ctrl.signal,
    async onopen(res) {
      if (!res.ok) throw new Error(`SSE ${res.status}`);
      hooks?.onOpen?.();
    },
    onmessage(ev) {
      try {
        onEvent(JSON.parse(ev.data) as TaskEvent);
      } catch {
        // 非 JSON 帧忽略（保活注释等）
      }
    },
    onerror(err) {
      hooks?.onError?.(err);
      // 不抛出 → fetch-event-source 自动重连（对齐项目 useSSE 惯例）
    },
  });
  return () => ctrl.abort();
}

/** 取消任务：id 为 batchId（取消批次）或 workId（取消单作品流水线） */
export function cancelTask(id: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`tasks/${id}`, { method: 'DELETE' });
}

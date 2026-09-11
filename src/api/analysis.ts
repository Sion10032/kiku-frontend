import { apiFetch } from './client';

export interface AnalysisTaskPayload {
  workId: string;
  title: string;
  status: 'pending' | 'scanning' | 'completed' | 'failed';
  analyzed: number;
  total: number;
  error?: string;
}

export interface AnalysisSnapshot {
  tasks: AnalysisTaskPayload[];
  failedTasks: AnalysisTaskPayload[];
  completed: number;
  logs: Array<{ level: string; message: string; timestamp: string }>;
}

export type AnalysisEvent =
  | { type: 'ANALYSIS_TASK'; task: AnalysisTaskPayload }
  | {
      type: 'ANALYSIS_LOG';
      log: { level: string; message: string; timestamp: string };
    }
  | {
      type: 'ANALYSIS_RESULTS';
      results: {
        totalWorks: number;
        analyzedTracks: number;
        failedTracks: number;
        failedWorks: number;
      };
    }
  | { type: 'ANALYSIS_FINISHED'; message: string }
  | { type: 'ANALYSIS_ERROR'; error: string };

/** 触发响度分析（全量，或传 workId 插队单作品）：POST /api/analysis/start */
export function startAnalysis(
  workId?: string,
): Promise<{ success: boolean; queued: boolean }> {
  return apiFetch<{ success: boolean; queued: boolean }>('analysis/start', {
    method: 'POST',
    json: workId ? { workId } : {},
  });
}

/** 终止响度分析：POST /api/analysis/stop */
export function killAnalysis(): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>('analysis/stop', { method: 'POST' });
}

export interface LoudnessCurve {
  mediaIndex: string;
  intervalSec: number;
  /** short-term LUFS 按秒序列（1 点/秒，1 位小数；null = 窗口未满/静音）；未分析为 null */
  curve: Array<number | null> | null;
}

/** 按需获取单条音轨响度曲线：GET /api/work/:id/loudness-curve?mediaIndex=...（mediaIndex 含子目录需 encode） */
export function getLoudnessCurve(
  workId: string,
  mediaIndex: string,
): Promise<LoudnessCurve> {
  return apiFetch<LoudnessCurve>(
    `work/${workId}/loudness-curve?mediaIndex=${encodeURIComponent(mediaIndex)}`,
  );
}

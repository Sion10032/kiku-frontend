import { apiFetch } from './client';
import type { ProgressRow, ReportProgressInput } from '../types';

/**
 * 上报播放进度：PUT /api/progress
 *
 * 播放器节流调用（每 10s + 暂停/切曲/结束时），失败由 progressReporter
 * 静默处理；页面卸载（beforeunload）时以 keepalive 发出。
 */
export function reportProgress(
  input: ReportProgressInput,
  opts?: { keepalive?: boolean; },
): Promise<{ success: boolean; }> {
  return apiFetch<{ success: boolean; }>('progress', {
    method: 'PUT',
    json: input,
    keepalive: opts?.keepalive,
  });
}

/** 作品全部进度行：GET /api/progress/:workId（详情页/继续播放） */
export function getWorkProgress(workId: string): Promise<ProgressRow[]> {
  return apiFetch<ProgressRow[]>(`progress/${encodeURIComponent(workId)}`);
}

/** 删除作品全部播放进度（回到未读态）：DELETE /api/progress/:workId */
export function deleteWorkProgress(workId: string): Promise<{ deleted: number; }> {
  return apiFetch<{ deleted: number; }>(`progress/${encodeURIComponent(workId)}`, {
    method: 'DELETE',
  });
}

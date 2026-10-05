import { apiFetch } from './client';
import type {
  Circle,
  Series,
  Tag,
  Tracks,
  Va,
  Work,
  WorksPage,
  WorksParams,
} from '../types';

/** 构造分页 + 排序 searchParams（去除 undefined）。 */
function worksSearchParams(
  params: Pick<WorksParams, 'page' | 'pageSize' | 'order' | 'sort' | 'seed'>,
): Record<string, string> {
  const sp: Record<string, string> = {};
  if (params.page) sp.page = String(params.page);
  if (params.pageSize != null) sp.pageSize = String(params.pageSize);
  if (params.order) sp.order = params.order;
  if (params.sort) sp.sort = params.sort;
  if (params.seed != null) sp.seed = String(params.seed);
  return sp;
}

/**
 * 统一作品列表入口：GET /works?q=…（q 可选，空 = 全量）。
 * 后端解析 LQL 查询语言（liqe），搜索/筛选/组合条件走同一端点。
 */
export function getWorksList(params: WorksParams = {}): Promise<WorksPage> {
  const { q, ...rest } = params;
  const sp = worksSearchParams(rest);
  if (q) sp.q = q;
  return apiFetch<WorksPage>('works', { searchParams: sp });
}

/** 作品详情：GET /api/work/:id（id 为完整 RJ code） */
export function getWork(id: string): Promise<Work> {
  return apiFetch<Work>(`work/${id}`);
}

/**
 * 文件树：GET /api/tracks/:id
 */
export function getTracks(id: string): Promise<Tracks> {
  return apiFetch<Tracks>(`tracks/${id}`);
}

// ---------- 社团 / 标签 / 声优 / 系列 列表 ----------

export function getCircles(): Promise<Circle[]> {
  return apiFetch<Circle[]>('circles/');
}

export function getTags(): Promise<Tag[]> {
  return apiFetch<Tag[]>('tags/');
}

export function getVas(): Promise<Va[]> {
  return apiFetch<Va[]>('vas/');
}

export function getSeries(): Promise<Series[]> {
  return apiFetch<Series[]>('series/');
}

// ---------- 响度曲线（作品详情音轨查看） ----------

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

// ---------- 管理员单作品操作 ----------

/** 重抓 DLsite 元数据 + 封面 + 音轨时长同步（高优入队）：POST /api/work/:id/refresh → 202（管理员） */
export function refreshWorkMetadata(id: string): Promise<{ workId: string }> {
  return apiFetch(`work/${id}/refresh`, { method: 'POST' });
}

/** 按磁盘内容同步音轨时长（高优入队）：POST /api/work/:id/sync-tracks → 202（管理员） */
export function syncWorkTracks(id: string): Promise<{ workId: string }> {
  return apiFetch(`work/${id}/sync-tracks`, { method: 'POST' });
}

/** 立即响度分析（高优入队，cpu 池内插队）：POST /api/work/:id/analyze → 202（管理员） */
export function analyzeWork(id: string): Promise<{ workId: string }> {
  return apiFetch(`work/${id}/analyze`, { method: 'POST' });
}

/** 软删除作品（读路径已过滤 deletedAt，删除后立即不可见）：DELETE /api/work/:id（管理员） */
export function softDeleteWork(id: string): Promise<{ success: boolean }> {
  return apiFetch(`work/${id}`, { method: 'DELETE' });
}

/** 批量软删除作品：POST /api/works/batch-delete（管理员）。返回本次删除数（已删 id 幂等跳过）。 */
export function softDeleteWorks(
  ids: string[],
): Promise<{ success: boolean; deleted: number }> {
  return apiFetch<{ success: boolean; deleted: number }>('works/batch-delete', {
    method: 'POST',
    json: { ids },
  });
}

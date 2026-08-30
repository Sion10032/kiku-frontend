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
  params: Pick<WorksParams, 'page' | 'order' | 'sort' | 'seed'>,
): Record<string, string> {
  const sp: Record<string, string> = {};
  if (params.page) sp.page = String(params.page);
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

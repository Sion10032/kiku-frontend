import { apiFetch } from './client';
import type {
  Circle,
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
 * 获取作品列表（含分页）：GET /api/works
 *
 * 仅无筛选场景；筛选（circleId/tagId/vaId/keyword）请用 getWorksList
 * 或各子端点函数。
 */
export function getWorks(params: WorksParams = {}): Promise<WorksPage> {
  return apiFetch<WorksPage>('works', {
    searchParams: worksSearchParams(params),
  });
}

/**
 * 统一作品列表入口：按筛选路由到对应端点（均已分页）。
 * 无筛选 GET /works；筛选走 circles/tags/vas/search 子端点。
 */
export function getWorksList(params: WorksParams): Promise<WorksPage> {
  const { circleId, tagId, vaId, keyword, ...rest } = params;
  if (circleId != null) {
    return apiFetch<WorksPage>(`circles/${circleId}/works`, {
      searchParams: worksSearchParams(rest),
    });
  }
  if (tagId != null) {
    return apiFetch<WorksPage>(`tags/${tagId}/works`, {
      searchParams: worksSearchParams(rest),
    });
  }
  if (vaId != null) {
    return apiFetch<WorksPage>(`vas/${encodeURIComponent(vaId)}/works`, {
      searchParams: worksSearchParams(rest),
    });
  }
  if (keyword) {
    return apiFetch<WorksPage>(`search/${encodeURIComponent(keyword)}`, {
      searchParams: worksSearchParams(rest),
    });
  }
  return apiFetch<WorksPage>('works', { searchParams: worksSearchParams(rest) });
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

/** 社团下的作品：GET /api/circles/:id/works （分页响应） */
export function getCircleWorks(
  id: number,
  params: Omit<WorksParams, 'circleId' | 'tagId' | 'vaId' | 'keyword'> = {},
): Promise<WorksPage> {
  return apiFetch<WorksPage>(`circles/${id}/works`, {
    searchParams: worksSearchParams(params),
  });
}

/** 标签下的作品：GET /api/tags/:id/works （分页响应） */
export function getTagWorks(
  id: number,
  params: Omit<WorksParams, 'circleId' | 'tagId' | 'vaId' | 'keyword'> = {},
): Promise<WorksPage> {
  return apiFetch<WorksPage>(`tags/${id}/works`, {
    searchParams: worksSearchParams(params),
  });
}

/** 声优下的作品：GET /api/vas/:id/works （分页响应） */
export function getVaWorks(
  id: string,
  params: Omit<WorksParams, 'circleId' | 'tagId' | 'vaId' | 'keyword'> = {},
): Promise<WorksPage> {
  return apiFetch<WorksPage>(`vas/${encodeURIComponent(id)}/works`, {
    searchParams: worksSearchParams(params),
  });
}

/** 搜索：GET /api/search/:keyword （分页响应，透传 page/order/sort） */
export function searchWorks(
  keyword: string,
  params: Omit<WorksParams, 'circleId' | 'tagId' | 'vaId' | 'keyword'> = {},
): Promise<WorksPage> {
  return apiFetch<WorksPage>(`search/${encodeURIComponent(keyword)}`, {
    searchParams: worksSearchParams(params),
  });
}

// ---------- 社团 / 标签 / 声优 列表 ----------

export function getCircles(): Promise<Circle[]> {
  return apiFetch<Circle[]>('circles/');
}

export function getTags(): Promise<Tag[]> {
  return apiFetch<Tag[]>('tags/');
}

export function getVas(): Promise<Va[]> {
  return apiFetch<Va[]>('vas/');
}

export function getCircle(id: number): Promise<Circle> {
  return apiFetch<Circle>(`circles/${id}`);
}

export function getTag(id: number): Promise<Tag> {
  return apiFetch<Tag>(`tags/${id}`);
}

export function getVa(id: string): Promise<Va> {
  return apiFetch<Va>(`vas/${encodeURIComponent(id)}`);
}

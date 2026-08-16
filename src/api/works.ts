import { apiFetch, ApiError } from './client';
import { buildMockTracks } from '../mocks/tracks';
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
 * 通用入口——筛选（circleId/tagId/vaId/keyword）使用各自的子端点，
 * 见 getCircleWorks / getTagWorks / getVaWorks / searchWorks。
 */
export function getWorks(params: WorksParams = {}): Promise<WorksPage> {
  return apiFetch<WorksPage>('works', {
    searchParams: worksSearchParams(params),
  });
}

/** 作品详情：GET /api/work/:id（id 为完整 RJ code） */
export function getWork(id: string): Promise<Work> {
  return apiFetch<Work>(`work/${id}`);
}

/**
 * 文件树：GET /api/tracks/:id
 *
 * ⚠️ 后端 /tracks/:id 尚未实现（返回 501 stub，见 TODO.md 注意事项 13）。
 * 请求失败（501/404）时回退到 mock 文件树（mocks/tracks.ts），保证 WorkTree
 * 可渲染、可播放；后端实现后移除该 fallback 与 mock 模块。
 */
export async function getTracks(id: string): Promise<Tracks> {
  try {
    return await apiFetch<Tracks>(`tracks/${id}`);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 501 || err.status === 404)) {
      // 后端实现后移除 mock fallback
      return buildMockTracks(id);
    }
    throw err;
  }
}

/** 圈子下的作品：GET /api/circles/:id/works （返回裸数组） */
export function getCircleWorks(
  id: number,
  params: Omit<WorksParams, 'circleId' | 'tagId' | 'vaId' | 'keyword'> = {},
): Promise<Work[]> {
  return apiFetch<Work[]>(`circles/${id}/works`, {
    searchParams: worksSearchParams(params),
  });
}

/** 标签下的作品：GET /api/tags/:id/works （返回裸数组） */
export function getTagWorks(
  id: number,
  params: Omit<WorksParams, 'circleId' | 'tagId' | 'vaId' | 'keyword'> = {},
): Promise<Work[]> {
  return apiFetch<Work[]>(`tags/${id}/works`, {
    searchParams: worksSearchParams(params),
  });
}

/** 声优下的作品：GET /api/vas/:id/works （返回裸数组） */
export function getVaWorks(
  id: string,
  params: Omit<WorksParams, 'circleId' | 'tagId' | 'vaId' | 'keyword'> = {},
): Promise<Work[]> {
  return apiFetch<Work[]>(`vas/${encodeURIComponent(id)}/works`, {
    searchParams: worksSearchParams(params),
  });
}

/** 搜索：GET /api/search/:keyword （返回 {works}，无分页） */
export function searchWorks(keyword: string): Promise<{ works: Work[] }> {
  return apiFetch<{ works: Work[] }>(
    `search/${encodeURIComponent(keyword)}`,
  );
}

// ---------- 圈子 / 标签 / 声优 列表 ----------

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

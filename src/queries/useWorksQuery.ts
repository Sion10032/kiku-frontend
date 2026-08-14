import {
  useInfiniteQuery,
  useQuery,
} from '@tanstack/react-query';
import {
  getWorks,
  getWork,
  getCircleWorks,
  getTagWorks,
  getVaWorks,
  searchWorks,
} from '../api/works';
import type { Work, WorksParams } from '../types';

/**
 * 作品库无限滚动查询（仅 /works，含分页）。
 *
 * 筛选（circleId/tagId/vaId/keyword）后端返回裸数组无分页，
 * 请改用 useFilteredWorks / useSearchWorks。
 */
export function useWorksInfinite(
  params: Omit<WorksParams, 'circleId' | 'tagId' | 'vaId' | 'keyword'> = {},
) {
  return useInfiniteQuery({
    queryKey: ['works', params],
    queryFn: ({ pageParam }) => getWorks({ ...params, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { currentPage, pageSize, totalCount } = lastPage.pagination;
      return currentPage * pageSize < totalCount
        ? currentPage + 1
        : undefined;
    },
  });
}

/** 按圈子筛选的作品（一次拉全，后端无分页）。 */
export function useCircleWorks(circleId: number | undefined) {
  return useQuery({
    queryKey: ['works', 'circle', circleId],
    queryFn: () => getCircleWorks(circleId!),
    enabled: circleId != null,
  });
}

/** 按标签筛选的作品。 */
export function useTagWorks(tagId: number | undefined) {
  return useQuery({
    queryKey: ['works', 'tag', tagId],
    queryFn: () => getTagWorks(tagId!),
    enabled: tagId != null,
  });
}

/** 按声优筛选的作品。 */
export function useVaWorks(vaId: string | undefined) {
  return useQuery({
    queryKey: ['works', 'va', vaId],
    queryFn: () => getVaWorks(vaId!),
    enabled: vaId != null,
  });
}

/** 搜索结果（一次拉全，后端无分页）。 */
export function useSearchWorks(keyword: string | undefined) {
  return useQuery({
    queryKey: ['works', 'search', keyword],
    queryFn: () => searchWorks(keyword!),
    enabled: !!keyword,
  });
}

/** 作品详情（步骤 7 使用，此处一并导出）。 */
export function useWorkQuery(id: number) {
  return useQuery({
    queryKey: ['work', id],
    queryFn: () => getWork(id),
    enabled: id != null,
  });
}

/** 把无限滚动 / 筛选 / 搜索的响应统一拍平为 Work[] 的辅助类型。 */
export type WorksResult = {
  works: Work[];
  totalCount?: number;
};

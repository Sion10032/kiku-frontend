import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
} from '@tanstack/react-query';
import { getWorksList, getWork, getTracks } from '../api/works';
import type { WorksParams } from '../types';

/** 语义别名：WorksFilter 的字段已全部含于 WorksParams，直接复用。 */
type ListParams = WorksParams;

/**
 * 排序+筛选部分作为 key 主体，page 单独维度。
 *
 * base 对象显式写全 order/sort/seed/circleId/tagId/vaId/keyword 七个键
 * （键序固定），确保 queryKey hash 两侧同构，不会因调用方构造差异而漂移。
 */
function listKeyParts(params: ListParams & { page: number }) {
  const { order, sort, seed, circleId, tagId, vaId, keyword, page } = params;
  const base = {
    order,
    sort,
    seed,
    circleId,
    tagId,
    vaId,
    keyword,
  };
  return [base, page] as const;
}

/** 列表 query key 构造（loader 与 hooks 共用，避免漂移）。 */
export function worksListQueryKey(params: ListParams & { page: number }) {
  const [base, page] = listKeyParts(params);
  return ['works', base, page] as const;
}

/** 作品库按页查询（分页模式）。keepPreviousData 避免翻页闪 loading。 */
export function useWorksPage(
  params: ListParams & { page: number },
  enabled = true,
) {
  return useQuery({
    queryKey: worksListQueryKey(params),
    queryFn: () => getWorksList(params),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    enabled,
  });
}

/** 作品库无限滚动查询（无限模式，key 为 ['works', base]，与按页 key 不冲突）。 */
export function useWorksInfinite(params: ListParams = {}, enabled = true) {
  const [base] = listKeyParts({ ...params, page: 1 });
  return useInfiniteQuery({
    queryKey: ['works', base],
    queryFn: ({ pageParam }) => getWorksList({ ...params, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { currentPage, pageSize, totalCount } = lastPage.pagination;
      return currentPage * pageSize < totalCount ? currentPage + 1 : undefined;
    },
    enabled,
  });
}

/** 作品详情（步骤 7 使用，此处一并导出）。 */
export function useWorkQuery(id: string) {
  return useQuery({
    queryKey: ['work', id],
    queryFn: () => getWork(id),
    enabled: id != null,
  });
}

/** 作品文件树（步骤 7 使用）。后端 501 时由 getTracks 内部回退 mock。 */
export function useTracksQuery(id: string) {
  return useQuery({
    queryKey: ['tracks', id],
    queryFn: () => getTracks(id),
    enabled: id != null,
  });
}

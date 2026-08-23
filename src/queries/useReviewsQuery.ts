import { useMemo } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import { getReviewsByUser } from '../api/review';
import { getWork } from '../api/works';
import type { Work } from '../types';

/**
 * 当前用户的全部评价（含评分 / 短评 / 进度标记）。
 * GET /api/review?username=:name（后端返回裸数组，无分页）。
 */
export function useReviewsByUser(username: string | undefined) {
  return useQuery({
    queryKey: [ 'reviews', 'user', username ],
    queryFn: () => getReviewsByUser(username!),
    enabled: !!username,
  });
}

/**
 * 按 id 批量拉取作品信息（收藏页 review 只有 workId，需 join work 详情）。
 *
 * 避免逐个串行查询（N+1）：
 * - queryKey 与 useWorkQuery 一致（['work', id]），与作品详情页共享 react-query 缓存；
 * - useQueries 并行发起、相同 key 自动去重，仅 id 集合变化时重新请求。
 *
 * 返回 id → Work 的映射（加载中/失败的项不在映射内，由调用方据此判断缺失）。
 */
export function useWorkMap(workIds: string[]) {
  const ids = useMemo(() => [ ...new Set(workIds) ], [ workIds ]);
  const results = useQueries({
    queries: ids.map(id => ({
      queryKey: [ 'work', id ] as const,
      queryFn: () => getWork(id),
    })),
  });

  const works = new Map<string, Work>();
  ids.forEach((id, i) => {
    const data = results[i]?.data;
    if (data) works.set(id, data);
  });

  return {
    works,
    isPending: results.some(r => r.isPending),
    isError: results.some(r => r.isError),
  };
}

import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../api/favourite';
import { useUserStore } from '../stores/userStore';
import type { FavouriteTargetType } from '../types';

/**
 * 当前用户收藏列表（私密：未登录不发请求）。
 * GET /api/favourites?targetType=...
 */
export function useFavourites(targetType?: FavouriteTargetType) {
  const auth = useUserStore((s) => s.auth);
  return useQuery({
    queryKey: ['favourites', 'list', targetType ?? 'all'],
    queryFn: () => api.getFavourites(targetType),
    enabled: auth,
  });
}

/**
 * 批量查询「是否已收藏」（卡片红心 / 列表行心形）。
 * ids 排序去重后进 queryKey，避免渲染期间数组重建导致请求风暴。
 * 未登录（auth=false）或空 ids 时 enabled=false。
 */
export function useFavouriteStatus(
  targetType: FavouriteTargetType,
  ids: string[],
) {
  const auth = useUserStore((s) => s.auth);
  const key = useMemo(() => [...new Set(ids)].sort().join(','), [ids]);
  return useQuery({
    queryKey: ['favourites', 'status', targetType, key],
    queryFn: () =>
      api.getFavouriteStatus(targetType, key.split(',').filter(Boolean)),
    enabled: auth && key.length > 0,
  });
}

/**
 * 收藏 / 取消收藏（乐观更新）。
 *
 * onMutate 把 ['favourites','status',targetType] 下所有缓存映射打补丁，
 * 红心即时切换；onSettled 失效 ['favourites'] 让列表查询对齐服务端。
 */
export function useFavouriteMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    // 注：返回类型显式标注为 Promise<unknown>，
    // 否则 add/remove 两种响应的联合类型会破坏 useMutation 的泛型推断。
    mutationFn: async (input: {
      targetType: FavouriteTargetType;
      targetId: string;
      favourited: boolean;
    }): Promise<unknown> =>
      input.favourited
        ? api.addFavourite(input.targetType, input.targetId)
        : api.removeFavourite(input.targetType, input.targetId),
    onMutate: async (input) => {
      await queryClient.cancelQueries({
        queryKey: ['favourites', 'status', input.targetType],
      });
      const snapshots = queryClient.getQueriesData<{
        [id: string]: boolean;
      }>({ queryKey: ['favourites', 'status', input.targetType] });
      for (const [key, data] of snapshots) {
        if (!data) continue;
        queryClient.setQueryData(key, {
          ...data,
          [input.targetId]: input.favourited,
        });
      }
      return { snapshots };
    },
    onError: (_err, _input, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['favourites'] });
    },
  });
}

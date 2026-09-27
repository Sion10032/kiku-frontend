import { useQuery } from '@tanstack/react-query';
import { getCircles, getSeries, getTags, getVas } from '../api/works';
import type { Circle, Series, Tag, Va } from '../types';

/** 列表页实体类型（与路由 /list/$type 的枚举一致）。 */
export type ListType = 'circles' | 'tags' | 'vas' | 'series';

/** 实体列表行联合类型（queryKey 决定实际分支）。 */
type EntityListRow = Circle | Tag | Va | Series;

/**
 * 社团 / 标签 / 声优 / 系列 列表查询。
 *
 * 按 type 单发一个请求（其余类型不请求）；queryKey 即实体类型
 * （['circles'] 等），列表页与全局搜索等复用同一份缓存。
 * circles/vas/series 响应内联当前用户的 favourited（匿名全 false）。
 */
export function useEntityListQuery(type: ListType) {
  return useQuery<EntityListRow[]>({
    queryKey: [type],
    queryFn: async () => {
      switch (type) {
        case 'circles':
          return getCircles();
        case 'tags':
          return getTags();
        case 'vas':
          return getVas();
        case 'series':
          return getSeries();
      }
    },
  });
}

// 具名快捷 hooks：全局搜索等需要同时取多类实体的场景
// （与 useEntityListQuery 共享 queryKey，不会重复发请求）。

export function useCirclesQuery() {
  return useQuery<Circle[]>({ queryKey: ['circles'], queryFn: getCircles });
}

export function useTagsQuery() {
  return useQuery<Tag[]>({ queryKey: ['tags'], queryFn: getTags });
}

export function useVasQuery() {
  return useQuery<Va[]>({ queryKey: ['vas'], queryFn: getVas });
}

export function useSeriesQuery() {
  return useQuery<Series[]>({ queryKey: ['series'], queryFn: getSeries });
}

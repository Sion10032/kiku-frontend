import { useQuery } from '@tanstack/react-query';
import { getCircles, getSeries, getTags, getVas } from '../api/works';

/**
 * 社团 / 标签 / 声优 / 系列 列表查询（列表页步骤 9）。
 *
 * 各端点均返回裸数组（无分页），queryKey 按实体类型区分，
 * 便于列表页与后续收藏页等复用同一份缓存。
 */
export function useCirclesQuery() {
  return useQuery({
    queryKey: ['circles'],
    queryFn: getCircles,
  });
}

export function useTagsQuery() {
  return useQuery({
    queryKey: ['tags'],
    queryFn: getTags,
  });
}

export function useVasQuery() {
  return useQuery({
    queryKey: ['vas'],
    queryFn: getVas,
  });
}

export function useSeriesQuery() {
  return useQuery({
    queryKey: ['series'],
    queryFn: getSeries,
  });
}

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getHistory } from '../api/progress';
import { useUserStore } from '../stores/userStore';

/** query key：page/pageSize 显式全键，hash 稳定（对齐 useWorksQuery 风格）。 */
export function historyQueryKey(params: { page: number; pageSize: number }) {
  return ['history', params] as const;
}

/**
 * 最近收听条带（作品库顶部）：固定取 10 条。
 *
 * staleTime 30s：播放后回到作品库，超 30s 自动刷新（无感）；
 * 未登录不发请求（enabled）。
 */
export function useRecentHistory() {
  const authed = useUserStore((s) => s.auth);
  return useQuery({
    queryKey: historyQueryKey({ page: 1, pageSize: 10 }),
    queryFn: () => getHistory({ page: 1, pageSize: 10 }),
    staleTime: 30_000,
    enabled: authed,
  });
}

/** 收听历史页分页查询（keepPreviousData 防翻页闪 loading）。 */
export function useHistoryPage(page: number) {
  const authed = useUserStore((s) => s.auth);
  return useQuery({
    queryKey: historyQueryKey({ page, pageSize: 20 }),
    queryFn: () => getHistory({ page, pageSize: 20 }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    enabled: authed,
  });
}

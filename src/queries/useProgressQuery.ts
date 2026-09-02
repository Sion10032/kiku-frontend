import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getWorkProgress } from '../api/progress';
import { useUserStore } from '../stores/userStore';
import { useProgressStore } from '../stores/progressStore';

/**
 * 作品全部进度行（GET /api/progress/:workId，登录才启用）。
 * 数据到位后注入 progressStore：WorkTree 显示与 playLeaf 续播策略共用单一数据源。
 */
export function useWorkProgressQuery(workId: string) {
  const auth = useUserStore((s) => s.auth);
  const query = useQuery({
    queryKey: ['progress', workId],
    queryFn: () => getWorkProgress(workId),
    enabled: auth,
  });

  useEffect(() => {
    if (query.data) useProgressStore.getState().hydrate(workId, query.data);
  }, [workId, query.data]);

  return query;
}

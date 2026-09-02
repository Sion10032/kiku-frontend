import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../api/progress';
import { useProgressStore } from '../stores/progressStore';

/**
 * 删除作品全部播放进度(DELETE /api/progress/:workId,回到未读态)。
 *
 * 成功后失效:
 * - ['works', ...]:作品列表(未读角标/进度 chip)
 * - ['work', id]:作品详情(继续播放区块)
 * - ['progress', id]:进度查询(Work 页)
 * 并清除 progressStore 中该作品的缓存。
 */
export function useDeleteProgressMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (workId: string) => api.deleteWorkProgress(workId),
    onSuccess: (_data, workId) => {
      useProgressStore.getState().clearWork(workId);
      queryClient.invalidateQueries({ queryKey: ['works'] });
      queryClient.invalidateQueries({ queryKey: ['work'] });
      queryClient.invalidateQueries({ queryKey: ['progress', workId] });
    },
  });
}

/**
 * 标记已读/未读（PUT/DELETE /api/progress/:workId/read，进度不动）。
 * 成功后失效 works/work（read 随 formattedWork 注入）。
 */
export function useReadStateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ workId, read }: { workId: string; read: boolean }) =>
      read ? api.markWorkRead(workId) : api.markWorkUnread(workId),
    onSuccess: (_data, { workId }) => {
      queryClient.invalidateQueries({ queryKey: ['works'] });
      queryClient.invalidateQueries({ queryKey: ['work'] });
      queryClient.invalidateQueries({ queryKey: ['progress', workId] });
    },
  });
}

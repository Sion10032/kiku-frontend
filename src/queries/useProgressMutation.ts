import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../api/progress';

/**
 * 删除作品全部播放进度(DELETE /api/progress/:workId,回到未读态)。
 *
 * 成功后失效:
 * - ['works', ...]:作品列表(未读角标/进度 chip)
 * - ['work', id]:作品详情(继续播放区块)
 */
export function useDeleteProgressMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (workId: string) => api.deleteWorkProgress(workId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ 'works' ] });
      queryClient.invalidateQueries({ queryKey: [ 'work' ] });
    },
  });
}

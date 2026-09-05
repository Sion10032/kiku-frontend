import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../api/works';

/**
 * 管理员单作品操作 mutations。
 * - 更新元数据：重抓 DLsite + 音轨同步 → 失效 work/works（详情与列表立即反映）
 * - 更新音轨时长：diff 同步 → 失效 work（duration 为详情 SUM）与 tracks（时长行）
 * - 删除：软删 → 失效 works/favourites；跳转由组件层 onSuccess 回调处理
 */
export function useRefreshWorkMetadataMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (workId: string) => api.refreshWorkMetadata(workId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work'] });
      queryClient.invalidateQueries({ queryKey: ['works'] });
    },
  });
}

export function useSyncWorkTracksMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (workId: string) => api.syncWorkTracks(workId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work'] });
      queryClient.invalidateQueries({ queryKey: ['tracks'] });
    },
  });
}

export function useSoftDeleteWorkMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (workId: string) => api.softDeleteWork(workId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['works'] });
      queryClient.invalidateQueries({ queryKey: ['favourites'] });
    },
  });
}

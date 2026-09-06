import { useMutation, useQueryClient } from '@tanstack/react-query';
import { M3eSnackbar } from '@m3e/react/snackbar';
import * as api from '../api/works';

/** 提取给用户看的错误消息（apiFetch 已把后端 error 字段转成 ApiError.message）。 */
function apiErrorMessage(err: unknown): string {
  return err instanceof Error && err.message ? err.message : '未知错误';
}

/**
 * 管理员单作品操作 mutations。
 * - 更新元数据：重抓 DLsite + 音轨同步 → 失效 work/works（详情与列表立即反映）
 * - 更新音轨时长：diff 同步 → 失效 work（duration 为详情 SUM）与 tracks（时长行）
 * - 删除：软删 → 失效 works/favourites；跳转由组件层 onSuccess 回调处理
 *
 * 全程用 Snackbar 反馈（进行中 / 成功 / 失败）；invalidQueries 失效后详情与
 * 列表自动 refetch。删除的失效与成功提示放在 onSettled：v5 中 mutate 级
 * onSuccess 会覆盖 hook 级 onSuccess（组件层用它做关闭弹窗 + 跳转）。
 */
export function useRefreshWorkMetadataMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (workId: string) => api.refreshWorkMetadata(workId),
    onMutate: () => {
      M3eSnackbar.open('正在更新元数据…');
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['work'] });
      queryClient.invalidateQueries({ queryKey: ['works'] });
      M3eSnackbar.open(`元数据已更新：《${data.title}》`);
    },
    onError: (err) => {
      M3eSnackbar.open(`更新元数据失败：${apiErrorMessage(err)}`);
    },
  });
}

export function useSyncWorkTracksMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (workId: string) => api.syncWorkTracks(workId),
    onMutate: () => {
      M3eSnackbar.open('正在同步音轨时长…');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work'] });
      queryClient.invalidateQueries({ queryKey: ['tracks'] });
      M3eSnackbar.open('音轨时长已同步');
    },
    onError: (err) => {
      M3eSnackbar.open(`同步音轨时长失败：${apiErrorMessage(err)}`);
    },
  });
}

export function useSoftDeleteWorkMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (workId: string) => api.softDeleteWork(workId),
    onMutate: () => {
      M3eSnackbar.open('正在删除作品…');
    },
    onSettled: (_data, error) => {
      if (error) {
        M3eSnackbar.open(`删除失败：${apiErrorMessage(error)}`);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['works'] });
      queryClient.invalidateQueries({ queryKey: ['favourites'] });
      M3eSnackbar.open('作品已删除');
    },
  });
}

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { M3eSnackbar } from '@m3e/react/snackbar';
import i18next from 'i18next';
import * as api from '../api/works';

/** 提取给用户看的错误消息（apiFetch 已把后端 error 字段转成 ApiError.message）。 */
function apiErrorMessage(err: unknown): string {
  return err instanceof Error && err.message
    ? err.message
    : i18next.t('common.unknown-error');
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
  return useMutation({
    mutationFn: (workId: string) => api.refreshWorkMetadata(workId),
    // 202 = 已入队（后端本地化消息）；404/409 = 后端本地化错误直显
    onSuccess: () => {
      M3eSnackbar.open(i18next.t('works.admin.queued'));
    },
    onError: (err) => {
      M3eSnackbar.open(apiErrorMessage(err));
    },
  });
}

export function useSyncWorkTracksMutation() {
  return useMutation({
    mutationFn: (workId: string) => api.syncWorkTracks(workId),
    onSuccess: () => {
      M3eSnackbar.open(i18next.t('works.admin.queued'));
    },
    onError: (err) => {
      M3eSnackbar.open(apiErrorMessage(err));
    },
  });
}

/**
 * 触发响度分析（单作品，高优先级入队）：进度走任务中心。
 * 不做查询失效/进度绑定——分析耗时分钟级，完成后任务中心可见。
 */
export function useStartAnalysisMutation() {
  return useMutation({
    mutationFn: (workId: string) => api.analyzeWork(workId),
    onSuccess: () => {
      M3eSnackbar.open(i18next.t('works.admin.queued'));
    },
    onError: (err) => {
      M3eSnackbar.open(apiErrorMessage(err));
    },
  });
}

export function useSoftDeleteWorkMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (workId: string) => api.softDeleteWork(workId),
    onMutate: () => {
      M3eSnackbar.open(i18next.t('works.admin.deleting-work'));
    },
    onSettled: (_data, error) => {
      if (error) {
        M3eSnackbar.open(
          i18next.t('works.admin.delete-failed', {
            message: apiErrorMessage(error),
          }),
        );
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['works'] });
      queryClient.invalidateQueries({ queryKey: ['favourites'] });
      M3eSnackbar.open(i18next.t('works.admin.work-deleted'));
    },
  });
}

/**
 * 批量软删除（音声管理页多选）：一次请求返回实际删除数，Snackbar 反馈；
 * 失效 works/favourites。清空选中由组件层 onSuccess 回调处理（同单删的跳转模式）。
 */
export function useBatchSoftDeleteWorksMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => api.softDeleteWorks(ids),
    onMutate: (ids) => {
      M3eSnackbar.open(
        i18next.t('works.admin.batch-deleting', { count: ids.length }),
      );
    },
    onSettled: (data, error) => {
      if (error) {
        M3eSnackbar.open(
          i18next.t('works.admin.batch-delete-failed', {
            message: apiErrorMessage(error),
          }),
        );
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['works'] });
      queryClient.invalidateQueries({ queryKey: ['favourites'] });
      M3eSnackbar.open(
        i18next.t('works.admin.batch-deleted', { count: data?.deleted ?? 0 }),
      );
    },
  });
}

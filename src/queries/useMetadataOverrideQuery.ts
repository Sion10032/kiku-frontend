import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { M3eSnackbar } from '@m3e/react/snackbar';
import {
  getMetadataOverride,
  resetMetadataField,
  saveMetadataOverride,
} from '../api/metadata';
import type { MetadataField, SaveMetadataOverrideInput } from '../types';

/** 提取给用户看的错误消息（apiFetch 已把后端 error 字段转成 ApiError.message）。 */
function apiErrorMessage(err: unknown): string {
  return err instanceof Error && err.message ? err.message : '未知错误';
}

export function metadataOverrideKey(workId: string) {
  return ['metadataOverride', workId] as const;
}

/** 编辑回显（弹窗打开时 enabled；staleTime 0 保证每次打开拿最新覆盖状态）。 */
export function useMetadataOverride(workId: string, enabled: boolean) {
  return useQuery({
    queryKey: metadataOverrideKey(workId),
    queryFn: () => getMetadataOverride(workId),
    enabled,
    staleTime: 0,
  });
}

/** 覆盖影响详情与列表 → 两处缓存都失效（同 useWorkAdminMutation）。 */
function useInvalidateOverriddenWorks() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['work'] });
    qc.invalidateQueries({ queryKey: ['works'] });
  };
}

export function useSaveMetadataOverrideMutation(workId: string) {
  const qc = useQueryClient();
  const invalidate = useInvalidateOverriddenWorks();
  return useMutation({
    mutationFn: (input: SaveMetadataOverrideInput) =>
      saveMetadataOverride(workId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: metadataOverrideKey(workId) });
      invalidate();
      M3eSnackbar.open('元数据覆盖已保存');
    },
    onError: (err) => {
      M3eSnackbar.open(`保存失败：${apiErrorMessage(err)}`);
    },
  });
}

export function useResetMetadataFieldMutation(workId: string) {
  const qc = useQueryClient();
  const invalidate = useInvalidateOverriddenWorks();
  return useMutation({
    mutationFn: (field: MetadataField) => resetMetadataField(workId, field),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: metadataOverrideKey(workId) });
      invalidate();
      M3eSnackbar.open('已恢复原始值');
    },
    onError: (err) => {
      M3eSnackbar.open(`恢复失败：${apiErrorMessage(err)}`);
    },
  });
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { M3eSnackbar } from '@m3e/react/snackbar';
import {
  getMetadataOverride,
  resetMetadataField,
  sanitizeTitles,
  saveMetadataOverride,
} from '../api/metadata';
import type {
  MetadataField,
  SaveMetadataOverrideInput,
  SanitizeTitlesInput,
} from '../types';

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

/**
 * 标题净化：dryRun=true 预览静默（结果由组件读 data 渲染）；
 * false 执行成功后失效作品缓存并弹完成提示（含覆盖已有覆盖的计数）。
 */
export function useSanitizeTitlesMutation() {
  const invalidate = useInvalidateOverriddenWorks();
  return useMutation({
    mutationFn: (input: SanitizeTitlesInput) => sanitizeTitles(input),
    onSuccess: (data, variables) => {
      if (!variables.dryRun) {
        invalidate();
        M3eSnackbar.open(
          `标题净化完成：修改 ${data.matched} 件（其中 ${data.overridden} 件为覆盖已有覆盖）`,
        );
      }
    },
    onError: (err) => {
      M3eSnackbar.open(`标题净化失败：${apiErrorMessage(err)}`);
    },
  });
}

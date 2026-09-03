import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import * as api from '../api/settingsBackup';
import {
  applySettingsSnapshot,
  getSettingsSnapshot,
} from '../stores/settingsStore';
import { useUserStore } from '../stores/userStore';
import type { SettingsBackupSummary } from '../types';

/** 备份列表（私密：未登录不发请求）。GET /api/settings-backups */
export function useSettingBackups(): UseQueryResult<{
  backups: SettingsBackupSummary[];
}> {
  const auth = useUserStore((s) => s.auth);
  return useQuery({
    queryKey: ['settings-backups', 'list'],
    queryFn: api.listSettingBackups,
    enabled: auth,
  });
}

/**
 * 备份当前设置到指定 name（覆盖）。
 * PUT /api/settings-backups/:name；成功后失效备份列表。
 * 错误向上抛（页面层捕获 ApiError 弹 snackbar）。
 */
export function useBackupSettingsMutation(): UseMutationResult<
  unknown,
  Error,
  string
> {
  const queryClient = useQueryClient();
  return useMutation({
    // 注：mutationFn 返回类型显式标注为 Promise<unknown>（同 useFavouriteMutation），
    // 与 hook 签名 UseMutationResult<unknown, Error, string> 对齐。
    mutationFn: (name: string): Promise<unknown> =>
      api.putSettingBackup(name, getSettingsSnapshot()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-backups'] });
    },
  });
}

/**
 * 拉取指定备份并应用到本地 store（restore 不改云端数据，无需失效列表）。
 * GET /api/settings-backups/:name；错误向上抛（页面层捕获 ApiError 弹提示）。
 */
export function useRestoreSettingsMutation(): UseMutationResult<
  void,
  Error,
  string
> {
  return useMutation({
    mutationFn: async (name: string) => {
      const detail = await api.getSettingBackup(name);
      applySettingsSnapshot(detail.payload);
    },
  });
}

/**
 * 删除指定备份。
 * DELETE /api/settings-backups/:name；成功后失效备份列表。
 * 错误向上抛（页面层捕获 ApiError 弹 snackbar）。
 */
export function useDeleteSettingBackupMutation(): UseMutationResult<
  unknown,
  Error,
  string
> {
  const queryClient = useQueryClient();
  return useMutation({
    // 注：mutationFn 返回类型显式标注为 Promise<unknown>（同上），与 hook 签名对齐。
    mutationFn: (name: string): Promise<unknown> =>
      api.deleteSettingBackup(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-backups'] });
    },
  });
}

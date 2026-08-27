import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getAdminConfig, updateAdminConfig } from '../api/config';
import { refreshSharedConfig } from '../api/sharedConfig';
import type { AdminConfig } from '../types';

export const ADMIN_CONFIG_KEY = ['adminConfig'] as const;

/** 管理员配置（Folders 与 Advanced 共享同一份缓存）。 */
export function useAdminConfig() {
  return useQuery({
    queryKey: ADMIN_CONFIG_KEY,
    queryFn: getAdminConfig,
  });
}

/** 更新管理员配置：成功后直接写回缓存（响应即最新配置），并刷新 sharedConfig。 */
export function useUpdateAdminConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<AdminConfig>) => updateAdminConfig(patch),
    onSuccess: (updated) => {
      qc.setQueryData(ADMIN_CONFIG_KEY, updated);
      refreshSharedConfig().catch(() => {});
    },
  });
}

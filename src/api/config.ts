import { apiFetch } from './client';
import type { AdminConfig, SharedConfig } from '../types';

/** 获取管理员配置：GET /api/config/admin */
export function getAdminConfig(): Promise<AdminConfig> {
  return apiFetch<AdminConfig>('config/admin');
}

/** 保存管理员配置（部分字段）：PUT /api/config/admin */
export function updateAdminConfig(
  patch: Partial<AdminConfig>,
): Promise<AdminConfig> {
  return apiFetch<AdminConfig>('config/admin', {
    method: 'PUT',
    json: patch,
  });
}

/** 获取共享配置（所有用户可见）：GET /api/config/shared */
export function getSharedConfig(): Promise<SharedConfig> {
  return apiFetch<SharedConfig>('config/shared');
}

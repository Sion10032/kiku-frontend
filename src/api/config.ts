import { apiFetch } from './client';
import type { AdminConfig } from '../types';

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

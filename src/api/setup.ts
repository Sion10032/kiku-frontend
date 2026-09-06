import { apiFetch } from './client';
import type { InstanceMode, LoginResponse } from '../types';

/** Setup 状态守卫：GET /api/setup（用户表是否为空） */
export function getSetupStatus(): Promise<{ needed: boolean }> {
  return apiFetch<{ needed: boolean }>('setup');
}

/** Setup 输入：管理员账号 + 实例配置（migrateFromKikoeru 在可用时随初始化一并迁移） */
export interface SetupInput {
  name: string;
  password: string;
  instanceMode: InstanceMode;
  allowRegistration: boolean;
  migrateFromKikoeru?: boolean;
}

/** 初始化：POST /api/setup（成功返回登录态） */
export function setup(input: SetupInput): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('setup', {
    method: 'POST',
    json: input,
  });
}

/** 迁移状态：GET /api/setup/migration/status（Setup 向导专用，白名单） */
export interface MigrationStatus {
  available: boolean;
  migrated: boolean;
  flavor?: 'number178-fork' | 'vanilla';
  stats?: {
    works: number;
    users: number;
    reviews: number;
    playHistory: number;
    covers: number;
  };
}

export function getMigrationStatus(): Promise<MigrationStatus> {
  return apiFetch<MigrationStatus>('setup/migration/status');
}

/** 执行迁移：POST /api/setup/migration/run */
export function runMigration(): Promise<{ stats: Record<string, number> }> {
  return apiFetch<{ stats: Record<string, number> }>('setup/migration/run', {
    method: 'POST',
  });
}

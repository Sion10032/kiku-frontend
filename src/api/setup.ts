import { apiFetch } from './client';
import type { InstanceMode, LoginResponse } from '../types';

/** Setup 状态守卫：GET /api/setup（用户表是否为空） */
export function getSetupStatus(): Promise<{ needed: boolean }> {
  return apiFetch<{ needed: boolean }>('setup');
}

/** Setup 输入：管理员账号 + 实例配置 */
export interface SetupInput {
  name: string;
  password: string;
  instanceMode: InstanceMode;
  allowRegistration: boolean;
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

/** 启动后台迁移：POST /api/setup/migration/run（运行中 409；进度走 /setup/migration/events SSE） */
export function runMigration(): Promise<{ started: boolean }> {
  return apiFetch<{ started: boolean }>('setup/migration/run', {
    method: 'POST',
  });
}

/** /setup/migration/events 的负载：MIGRATION_STATE 为全量 state，其余为对应事件对象 */
export interface MigrationSseData {
  running: boolean;
  imported: number;
  total: number;
  stats: Record<string, number> | null;
  error: string | null;
}

/** 迁移进度 SSE 端点（Setup 向导用，免鉴权白名单内） */
export const MIGRATION_SSE_URL = '/api/setup/migration/events';

// ---- setup 状态缓存 ----
// 全应用唯一的 setup 预检点是 /login 与 /setup 的 beforeLoad 守卫；
// 业务页面刷新不探测（未初始化时由业务请求 401 落到 /login）。

let setupNeeded: boolean | null = null;

export async function ensureSetupStatus(): Promise<boolean> {
  if (setupNeeded === null) {
    setupNeeded = (await getSetupStatus()).needed;
  }
  return setupNeeded;
}

/** 同步读取已缓存的 setup 状态（尚未拉取时为 null）。 */
export function getSetupNeeded(): boolean | null {
  return setupNeeded;
}

/** 标记 setup 已完成（向导提交成功后调用，避免后续导航再重定向）。 */
export function markSetupDone(): void {
  setupNeeded = false;
}

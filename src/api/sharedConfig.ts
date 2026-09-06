import { getSharedConfig } from '../api/config';
import { getSetupStatus } from './setup';
import type { SharedConfig } from '../types';

/**
 * sharedConfig 缓存：模块级 promise 缓存（模式同 restoreSession），
 * 整个应用生命周期只请求一次。根路由 beforeLoad 中首次拉取，
 * 守卫与组件通过它读取 instanceMode / allowRegistration。
 */

let configPromise: Promise<SharedConfig> | null = null;
let cached: SharedConfig | null = null;

export function ensureSharedConfig(): Promise<SharedConfig> {
  if (!configPromise) {
    configPromise = getSharedConfig()
      .then((c) => {
        cached = c;
        return c;
      })
      .catch((err) => {
        // 失败时清除缓存，下次重试
        configPromise = null;
        throw err;
      });
  }
  return configPromise;
}

/** 同步读取已缓存的 sharedConfig（尚未拉取完成时为 null）。 */
export function getCachedSharedConfig(): SharedConfig | null {
  return cached;
}

/** 强制重新拉取（setup 向导 / 管理后台保存配置后调用）。 */
export function refreshSharedConfig(): Promise<SharedConfig> {
  configPromise = null;
  return ensureSharedConfig();
}

// ---- setup 状态缓存（首次部署引导） ----

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

import { apiFetch } from './client';
import type { SettingsBackupDetail, SettingsBackupSummary } from '../types';

/** 列出当前用户全部设置备份：GET /api/settings-backups */
export function listSettingBackups(): Promise<{
  backups: SettingsBackupSummary[];
}> {
  return apiFetch<{ backups: SettingsBackupSummary[] }>('settings-backups');
}

/**
 * 读取指定设置备份：GET /api/settings-backups/:name
 *
 * 后端 DTO 的 payload 是 JSON 文本，这里 parse 成对象后返回；
 * parse 失败（备份内容损坏）不抛错、退化为空对象，
 * 避免单条坏备份阻塞备份列表/恢复 UI。
 */
export async function getSettingBackup(
  name: string,
): Promise<SettingsBackupDetail> {
  const detail = await apiFetch<{
    name: string;
    payload: string;
    updatedAt: string;
  }>(`settings-backups/${encodeURIComponent(name)}`);

  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(detail.payload) as Record<string, unknown>;
  } catch {
    // payload 非法 JSON：保持空对象，保留 name/updatedAt 元信息
  }
  return { ...detail, payload };
}

/**
 * 保存设置备份：PUT /api/settings-backups/:name
 *
 * 新建时已达每用户上限（10 条）后端返回 409；同名覆盖更新不受限
 * （409 由 apiFetch 统一抛 ApiError，status=409，页面层捕获提示）。
 */
export function putSettingBackup(
  name: string,
  payload: Record<string, unknown>,
): Promise<{ name: string; updatedAt: string }> {
  return apiFetch<{ name: string; updatedAt: string }>(
    `settings-backups/${encodeURIComponent(name)}`,
    { method: 'PUT', json: { payload } },
  );
}

/** 删除设置备份：DELETE /api/settings-backups/:name */
export function deleteSettingBackup(
  name: string,
): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(
    `settings-backups/${encodeURIComponent(name)}`,
    { method: 'DELETE' },
  );
}

import { apiFetch } from './client';
import type { RootFolder } from '../types';

/**
 * 根目录（媒体库）管理：/api/config/root-folders。
 *
 * name 是主键，且是任意用户文本（可能含 `/`、空格、日文），所以 PUT/DELETE
 * 的「当前名字」走 query string（URLSearchParams 自动编码），不放进 path 段。
 */

/** 列出全部根目录：GET /api/config/root-folders */
export function listRootFolders(): Promise<{ folders: RootFolder[] }> {
  return apiFetch<{ folders: RootFolder[] }>('config/root-folders');
}

/** 新建根目录：POST /api/config/root-folders（同名 → 409） */
export function createRootFolder(body: RootFolder): Promise<RootFolder> {
  return apiFetch<RootFolder>('config/root-folders', {
    method: 'POST',
    json: body,
  });
}

/** 更新 / 重命名根目录：PUT /api/config/root-folders?name=<当前名> */
export function updateRootFolder(
  currentName: string,
  body: RootFolder,
): Promise<RootFolder> {
  return apiFetch<RootFolder>('config/root-folders', {
    method: 'PUT',
    searchParams: new URLSearchParams({ name: currentName }),
    json: body,
  });
}

/** 删除根目录：DELETE /api/config/root-folders?name=<当前名>（名下有作品 → 409） */
export function deleteRootFolder(name: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>('config/root-folders', {
    method: 'DELETE',
    searchParams: new URLSearchParams({ name }),
  });
}

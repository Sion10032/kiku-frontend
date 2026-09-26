import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createRootFolder,
  deleteRootFolder,
  listRootFolders,
  updateRootFolder,
} from '../api/rootFolders';
import type { RootFolder } from '../types';
import { ADMIN_CONFIG_KEY } from './useAdminQuery';

export const ROOT_FOLDERS_KEY = ['rootFolders'] as const;

/**
 * 根目录列表（Folders 页唯一数据源）。
 * 变更后由各 mutation 统一失效 ROOT_FOLDERS_KEY 与 ADMIN_CONFIG_KEY。
 */
export function useRootFolders() {
  return useQuery({
    queryKey: ROOT_FOLDERS_KEY,
    queryFn: listRootFolders,
  });
}

/**
 * 写操作成功后同时失效两个 key：
 * - ROOT_FOLDERS_KEY：列表本身；
 * - ADMIN_CONFIG_KEY：Advanced 页等处可能仍缓存着含旧 rootFolders 形状的配置，
 *   一并失效最省心（AdminConfig 已不再包含该字段）。
 */
function useInvalidateRootFolders() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ROOT_FOLDERS_KEY });
    qc.invalidateQueries({ queryKey: ADMIN_CONFIG_KEY });
  };
}

/** 新建根目录（同名 → ApiError 409，文案由后端本地化）。 */
export function useCreateRootFolder() {
  const invalidate = useInvalidateRootFolders();
  return useMutation({
    mutationFn: (body: RootFolder) => createRootFolder(body),
    onSuccess: invalidate,
  });
}

/** 更新 / 重命名根目录（currentName 为改名前的名字）。 */
export function useUpdateRootFolder() {
  const invalidate = useInvalidateRootFolders();
  return useMutation({
    mutationFn: ({
      currentName,
      body,
    }: {
      currentName: string;
      body: RootFolder;
    }) => updateRootFolder(currentName, body),
    onSuccess: invalidate,
  });
}

/** 删除根目录（名下有作品 → ApiError 409，文案含作品数）。 */
export function useDeleteRootFolder() {
  const invalidate = useInvalidateRootFolders();
  return useMutation({
    mutationFn: (name: string) => deleteRootFolder(name),
    onSuccess: invalidate,
  });
}

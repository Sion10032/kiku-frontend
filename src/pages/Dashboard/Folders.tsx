import { useState } from 'react';
import { M3eButton } from '@m3e/react/button';
import { M3eCard } from '@m3e/react/card';
import { M3eFormField } from '@m3e/react/form-field';
import { M3eSnackbar } from '@m3e/react/snackbar';
import ConfirmDialog from '../../components/ConfirmDialog';
import DashboardPage from '../../components/dashboard/DashboardPage';
import type { RootFolder } from '../../types';
import { showApiError } from '../../utils/apiError';
import {
  useAdminConfig,
  useUpdateAdminConfig,
} from '../../queries/useAdminQuery';

/**
 * 文件夹管理页面。
 *
 * - 读取 AdminConfig.rootFolders，增删改后写回。
 * - RootFolder = { name: string; path: string }。
 */
export default function Folders() {
  const { data: config, isPending } = useAdminConfig();
  const updateConfig = useUpdateAdminConfig();
  const folders = config?.rootFolders ?? [];
  const saving = updateConfig.isPending;

  // 新增表单
  const [newName, setNewName] = useState('');
  const [newPath, setNewPath] = useState('');

  // 编辑中的索引（-1 表示不在编辑）
  const [editIndex, setEditIndex] = useState(-1);
  const [editName, setEditName] = useState('');
  const [editPath, setEditPath] = useState('');

  // 待删除的文件夹索引（非 null 时显示确认对话框）
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);

  async function saveFolders(next: RootFolder[]) {
    try {
      await updateConfig.mutateAsync({ rootFolders: next });
      M3eSnackbar.open('保存成功');
    } catch (err) {
      showApiError(err, '保存失败');
    }
  }

  function handleAdd() {
    const name = newName.trim();
    const path = newPath.trim();
    if (!name || !path) {
      M3eSnackbar.open('名称和路径不能为空');
      return;
    }
    if (folders.some((f) => f.path === path)) {
      M3eSnackbar.open('该路径已存在');
      return;
    }
    const next = [...folders, { name, path }];
    setNewName('');
    setNewPath('');
    saveFolders(next);
  }

  function handleDelete(index: number) {
    setPendingDelete(index);
  }

  function confirmDelete() {
    if (pendingDelete === null) return;
    const next = folders.filter((_, i) => i !== pendingDelete);
    if (editIndex === pendingDelete) setEditIndex(-1);
    else if (editIndex > pendingDelete) setEditIndex(editIndex - 1);
    setPendingDelete(null);
    saveFolders(next);
  }

  function startEdit(index: number) {
    setEditIndex(index);
    setEditName(folders[index].name);
    setEditPath(folders[index].path);
  }

  function handleEditSave() {
    const name = editName.trim();
    const path = editPath.trim();
    if (!name || !path) {
      M3eSnackbar.open('名称和路径不能为空');
      return;
    }
    const next = folders.map((f, i) => (i === editIndex ? { name, path } : f));
    setEditIndex(-1);
    saveFolders(next);
  }

  if (isPending) {
    return (
      <DashboardPage title='文件夹'>
        <p className='opacity-70'>加载中…</p>
      </DashboardPage>
    );
  }
  if (!config) {
    return (
      <DashboardPage title='文件夹'>
        <p className='text-[var(--md-sys-color-error)]'>无法加载配置</p>
      </DashboardPage>
    );
  }

  return (
    <DashboardPage title='文件夹'>
      <h2 className='m-0 text-lg font-normal'>根文件夹</h2>
      <M3eCard>
        <div slot='content'>
          {folders.length === 0 && (
            <p className='m-0 text-sm opacity-50'>暂无根文件夹</p>
          )}

          <div className='flex flex-col gap-3'>
            {folders.map((folder, index) => (
              <div
                key={`${folder.path}-${index}`}
                className='flex flex-col gap-2 rounded-md border border-[var(--md-sys-color-outline-variant)] p-3'
              >
                {editIndex === index ? (
                  <>
                    <M3eFormField variant='outlined' hideSubscript='always'>
                      <label slot='label' htmlFor={`edit-name-${index}`}>
                        名称
                      </label>
                      <input
                        id={`edit-name-${index}`}
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className='w-full border-none bg-transparent py-2 text-sm outline-none'
                      />
                    </M3eFormField>
                    <M3eFormField variant='outlined' hideSubscript='always'>
                      <label slot='label' htmlFor={`edit-path-${index}`}>
                        路径
                      </label>
                      <input
                        id={`edit-path-${index}`}
                        value={editPath}
                        onChange={(e) => setEditPath(e.target.value)}
                        className='w-full border-none bg-transparent py-2 text-sm outline-none'
                      />
                    </M3eFormField>
                    <div className='flex gap-2'>
                      <M3eButton
                        variant='text'
                        onClick={() => setEditIndex(-1)}
                      >
                        取消
                      </M3eButton>
                      <M3eButton
                        variant='filled'
                        disabled={saving}
                        onClick={handleEditSave}
                      >
                        保存
                      </M3eButton>
                    </div>
                  </>
                ) : (
                  <div className='flex items-center justify-between gap-2'>
                    <div className='min-w-0 flex-1'>
                      <div className='truncate text-sm font-medium'>
                        {folder.name}
                      </div>
                      <div className='truncate text-xs opacity-50'>
                        {folder.path}
                      </div>
                    </div>
                    <div className='flex shrink-0 gap-1'>
                      <M3eButton
                        variant='text'
                        onClick={() => startEdit(index)}
                      >
                        编辑
                      </M3eButton>
                      <M3eButton
                        variant='text'
                        className='text-[var(--md-sys-color-error)]'
                        disabled={saving}
                        onClick={() => handleDelete(index)}
                      >
                        删除
                      </M3eButton>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* 新增文件夹（内联表单） */}
          <div
            role='group'
            aria-label='添加根文件夹'
            className='mt-3 flex flex-wrap items-end gap-3 border-t border-[var(--md-sys-color-outline-variant)] pt-3'
          >
            <M3eFormField
              variant='outlined'
              hideSubscript='always'
              className='min-w-40 flex-1 [--m3e-form-field-width:100%]'
            >
              <label slot='label' htmlFor='new-folder-name'>
                名称
              </label>
              <input
                id='new-folder-name'
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder='如：主音声库'
                className='w-full border-none bg-transparent py-2 text-sm outline-none'
              />
            </M3eFormField>
            <M3eFormField
              variant='outlined'
              hideSubscript='always'
              className='min-w-56 flex-[2] [--m3e-form-field-width:100%]'
            >
              <label slot='label' htmlFor='new-folder-path'>
                路径
              </label>
              <input
                id='new-folder-path'
                value={newPath}
                onChange={(e) => setNewPath(e.target.value)}
                placeholder='/path/to/library'
                className='w-full border-none bg-transparent py-2 text-sm outline-none'
              />
            </M3eFormField>
            <M3eButton variant='filled' disabled={saving} onClick={handleAdd}>
              添加
            </M3eButton>
          </div>
        </div>
      </M3eCard>

      <ConfirmDialog
        open={pendingDelete !== null}
        title='删除根文件夹'
        message={
          pendingDelete !== null
            ? `确定删除「${folders[pendingDelete]?.name}」吗？已入库的作品记录不受影响。`
            : ''
        }
        confirmLabel='删除'
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </DashboardPage>
  );
}

import { useState } from 'react';
import { M3eButton } from '@m3e/react/button';
import { M3eCard } from '@m3e/react/card';
import { M3eFormField } from '@m3e/react/form-field';
import { M3eSnackbar } from '@m3e/react/snackbar';
import { useTranslation } from 'react-i18next';
import ConfirmDialog from '../../components/ConfirmDialog';
import DashboardPage from '../../components/dashboard/DashboardPage';
import {
  useCreateRootFolder,
  useDeleteRootFolder,
  useRootFolders,
  useUpdateRootFolder,
} from '../../queries/useRootFolders';
import type { RootFolder } from '../../types';
import { showApiError } from '../../utils/apiError';

/**
 * 文件夹管理页面。
 *
 * - 数据源为 /api/config/root-folders（RootFolder = { name; path: string | null }），
 *   增删改分别调用 mutation，成功后由 query 失效刷新列表。
 * - name 是主键；path 为 null = 迁移遗留未配置，需提示补配。
 */
export default function Folders() {
  const { t } = useTranslation();
  const { data, isPending, isError } = useRootFolders();
  const folders = data?.folders ?? [];

  const createFolder = useCreateRootFolder();
  const updateFolder = useUpdateRootFolder();
  const deleteFolder = useDeleteRootFolder();
  const saving =
    createFolder.isPending || updateFolder.isPending || deleteFolder.isPending;

  // 新增表单
  const [newName, setNewName] = useState('');
  const [newPath, setNewPath] = useState('');

  // 编辑态：editingName 是改名前的当前名字（作为 PUT 的 currentName）
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPath, setEditPath] = useState('');

  // 待删除的根目录名（非 null 时显示确认对话框）
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const pendingFolder = folders.find((f) => f.name === pendingDelete) ?? null;

  async function handleAdd() {
    const name = newName.trim();
    const path = newPath.trim();
    if (!name || !path) {
      M3eSnackbar.open(t('dashboard.folders.name-path-required'));
      return;
    }
    try {
      await createFolder.mutateAsync({ name, path });
      setNewName('');
      setNewPath('');
      M3eSnackbar.open(t('common.save-success'));
    } catch (err) {
      showApiError(err, t('common.save-failed'));
    }
  }

  function startEdit(folder: RootFolder) {
    setEditingName(folder.name);
    setEditName(folder.name);
    // path 为 null（迁移遗留未配置）时从空串开始，用户必须填路径。
    setEditPath(folder.path ?? '');
  }

  async function handleEditSave() {
    if (editingName === null) return;
    const name = editName.trim();
    const path = editPath.trim();
    if (!name || !path) {
      M3eSnackbar.open(t('dashboard.folders.name-path-required'));
      return;
    }
    try {
      await updateFolder.mutateAsync({
        currentName: editingName,
        body: { name, path },
      });
      setEditingName(null);
      M3eSnackbar.open(t('common.save-success'));
    } catch (err) {
      showApiError(err, t('common.save-failed'));
    }
  }

  async function confirmDelete() {
    if (pendingDelete === null) return;
    try {
      await deleteFolder.mutateAsync(pendingDelete);
      if (editingName === pendingDelete) setEditingName(null);
      M3eSnackbar.open(t('common.save-success'));
    } catch (err) {
      showApiError(err, t('common.save-failed'));
    } finally {
      setPendingDelete(null);
    }
  }

  if (isPending) {
    return (
      <DashboardPage title={t('dashboard.folders.title')}>
        <p className='opacity-70'>{t('common.loading')}</p>
      </DashboardPage>
    );
  }
  if (isError) {
    return (
      <DashboardPage title={t('dashboard.folders.title')}>
        <p className='text-[var(--md-sys-color-error)]'>
          {t('dashboard.load-failed')}
        </p>
      </DashboardPage>
    );
  }

  return (
    <DashboardPage title={t('dashboard.folders.title')}>
      <h2 className='m-0 text-lg font-normal'>
        {t('dashboard.folders.root-folders')}
      </h2>
      <M3eCard>
        <div slot='content'>
          {folders.length === 0 && (
            <p className='m-0 text-sm opacity-50'>
              {t('dashboard.folders.empty')}
            </p>
          )}

          <div className='flex flex-col gap-3'>
            {folders.map((folder) => (
              <div
                key={folder.name}
                className='flex flex-col gap-2 rounded-md border border-[var(--md-sys-color-outline-variant)] p-3'
              >
                {editingName === folder.name ? (
                  <>
                    <M3eFormField variant='outlined' hideSubscript='always'>
                      <label slot='label' htmlFor={`edit-name-${folder.name}`}>
                        {t('dashboard.folders.name')}
                      </label>
                      <input
                        id={`edit-name-${folder.name}`}
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className='w-full border-none bg-transparent py-2 text-sm outline-none'
                      />
                    </M3eFormField>
                    <M3eFormField variant='outlined' hideSubscript='always'>
                      <label slot='label' htmlFor={`edit-path-${folder.name}`}>
                        {t('dashboard.folders.path')}
                      </label>
                      <input
                        id={`edit-path-${folder.name}`}
                        value={editPath}
                        onChange={(e) => setEditPath(e.target.value)}
                        placeholder='/path/to/library'
                        className='w-full border-none bg-transparent py-2 text-sm outline-none'
                      />
                    </M3eFormField>
                    <div className='flex gap-2'>
                      <M3eButton
                        variant='text'
                        onClick={() => setEditingName(null)}
                      >
                        {t('common.cancel')}
                      </M3eButton>
                      <M3eButton
                        variant='filled'
                        disabled={saving}
                        onClick={handleEditSave}
                      >
                        {t('common.save')}
                      </M3eButton>
                    </div>
                  </>
                ) : (
                  <div className='flex items-center justify-between gap-2'>
                    <div className='min-w-0 flex-1'>
                      <div className='truncate text-sm font-medium'>
                        {folder.name}
                      </div>
                      <div
                        className={`truncate text-xs ${
                          folder.path
                            ? 'opacity-50'
                            : 'text-[var(--md-sys-color-error)]'
                        }`}
                      >
                        {folder.path ?? t('dashboard.folders.path-unset')}
                      </div>
                    </div>
                    <div className='flex shrink-0 gap-1'>
                      <M3eButton
                        variant='text'
                        onClick={() => startEdit(folder)}
                      >
                        {t('dashboard.folders.edit')}
                      </M3eButton>
                      <M3eButton
                        variant='text'
                        className='text-[var(--md-sys-color-error)]'
                        disabled={saving}
                        onClick={() => setPendingDelete(folder.name)}
                      >
                        {t('common.delete')}
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
            aria-label={t('dashboard.folders.add-root-folder')}
            className='mt-3 flex flex-wrap items-end gap-3 border-t border-[var(--md-sys-color-outline-variant)] pt-3'
          >
            <M3eFormField
              variant='outlined'
              hideSubscript='always'
              className='min-w-40 flex-1 [--m3e-form-field-width:100%]'
            >
              <label slot='label' htmlFor='new-folder-name'>
                {t('dashboard.folders.name')}
              </label>
              <input
                id='new-folder-name'
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t('dashboard.folders.name-ph')}
                className='w-full border-none bg-transparent py-2 text-sm outline-none'
              />
            </M3eFormField>
            <M3eFormField
              variant='outlined'
              hideSubscript='always'
              className='min-w-56 flex-[2] [--m3e-form-field-width:100%]'
            >
              <label slot='label' htmlFor='new-folder-path'>
                {t('dashboard.folders.path')}
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
              {t('dashboard.folders.add')}
            </M3eButton>
          </div>
        </div>
      </M3eCard>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={t('dashboard.folders.delete-root-title')}
        message={
          pendingFolder
            ? t('dashboard.folders.delete-root-confirm', {
                name: pendingFolder.name,
              })
            : ''
        }
        confirmLabel={t('common.delete')}
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </DashboardPage>
  );
}

import { useEffect, useState } from 'react';
import { M3eButton } from '@m3e/react/button';
import { M3eCard } from '@m3e/react/card';
import { M3eFormField } from '@m3e/react/form-field';
import { M3eSnackbar } from '@m3e/react/snackbar';
import { getAdminConfig, updateAdminConfig } from '../../api/config';
import type { RootFolder } from '../../types';

/**
 * 文件夹管理页面。
 *
 * - 读取 AdminConfig.rootFolders，增删改后写回。
 * - RootFolder = { name: string; path: string }。
 */
export default function Folders() {
  const [folders, setFolders] = useState<RootFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 新增表单
  const [newName, setNewName] = useState('');
  const [newPath, setNewPath] = useState('');

  // 编辑中的索引（-1 表示不在编辑）
  const [editIndex, setEditIndex] = useState(-1);
  const [editName, setEditName] = useState('');
  const [editPath, setEditPath] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const config = await getAdminConfig();
        if (!cancelled) setFolders(config.rootFolders ?? []);
      } catch (err) {
        M3eSnackbar.open(
          err instanceof Error ? err.message : '加载配置失败',
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveFolders(next: RootFolder[]) {
    setSaving(true);
    try {
      const updated = await updateAdminConfig({ rootFolders: next });
      setFolders(updated.rootFolders ?? next);
      M3eSnackbar.open('保存成功');
    } catch (err) {
      M3eSnackbar.open(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
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
    const next = folders.filter((_, i) => i !== index);
    if (editIndex === index) {
      setEditIndex(-1);
    } else if (editIndex > index) {
      setEditIndex(editIndex - 1);
    }
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
    const next = folders.map((f, i) =>
      i === editIndex ? { name, path } : f,
    );
    setEditIndex(-1);
    saveFolders(next);
  }

  if (loading) {
    return <p className="opacity-70">加载中…</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <M3eCard>
        <div slot="header">
          <span className="text-sm font-medium">根文件夹</span>
        </div>
        <div slot="content">
          {folders.length === 0 && (
            <p className="m-0 text-sm opacity-50">暂无根文件夹</p>
          )}

          <div className="flex flex-col gap-3">
            {folders.map((folder, index) => (
              <div
                key={`${folder.path}-${index}`}
                className="flex flex-col gap-2 rounded-md border border-[var(--md-sys-color-outline-variant)] p-3"
              >
                {editIndex === index ? (
                  <>
                    <M3eFormField variant="outlined" hideSubscript="always">
                      <label slot="label" htmlFor={`edit-name-${index}`}>
                        名称
                      </label>
                      <input
                        id={`edit-name-${index}`}
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full border-none bg-transparent py-2 text-sm outline-none"
                      />
                    </M3eFormField>
                    <M3eFormField variant="outlined" hideSubscript="always">
                      <label slot="label" htmlFor={`edit-path-${index}`}>
                        路径
                      </label>
                      <input
                        id={`edit-path-${index}`}
                        value={editPath}
                        onChange={(e) => setEditPath(e.target.value)}
                        className="w-full border-none bg-transparent py-2 text-sm outline-none"
                      />
                    </M3eFormField>
                    <div className="flex gap-2">
                      <M3eButton
                        variant="text"
                        onClick={() => setEditIndex(-1)}
                      >
                        取消
                      </M3eButton>
                      <M3eButton
                        variant="filled"
                        disabled={saving}
                        onClick={handleEditSave}
                      >
                        保存
                      </M3eButton>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {folder.name}
                      </div>
                      <div className="truncate text-xs opacity-50">
                        {folder.path}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <M3eButton
                        variant="text"
                        onClick={() => startEdit(index)}
                      >
                        编辑
                      </M3eButton>
                      <M3eButton
                        variant="text"
                        className="text-[var(--md-sys-color-error)]"
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
        </div>
      </M3eCard>

      {/* 新增文件夹 */}
      <M3eCard>
        <div slot="header">
          <span className="text-sm font-medium">添加根文件夹</span>
        </div>
        <div slot="content">
          <div className="flex flex-col gap-3">
            <M3eFormField variant="outlined" hideSubscript="always">
              <label slot="label" htmlFor="new-folder-name">
                名称
              </label>
              <input
                id="new-folder-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="如：主音声库"
                className="w-full border-none bg-transparent py-2 text-sm outline-none"
              />
            </M3eFormField>
            <M3eFormField variant="outlined" hideSubscript="always">
              <label slot="label" htmlFor="new-folder-path">
                路径
              </label>
              <input
                id="new-folder-path"
                value={newPath}
                onChange={(e) => setNewPath(e.target.value)}
                placeholder="/path/to/library"
                className="w-full border-none bg-transparent py-2 text-sm outline-none"
              />
            </M3eFormField>
            <M3eButton
              variant="filled"
              disabled={saving}
              onClick={handleAdd}
            >
              添加
            </M3eButton>
          </div>
        </div>
      </M3eCard>
    </div>
  );
}

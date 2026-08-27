import { useState } from 'react';
import { M3eButton } from '@m3e/react/button';
import { M3eCard } from '@m3e/react/card';
import { M3eFormField } from '@m3e/react/form-field';
import { M3eSelect, type M3eSelectElement } from '@m3e/react/select';
import { M3eOption } from '@m3e/react/option';
import { M3eSnackbar } from '@m3e/react/snackbar';
import ConfirmDialog from '../../components/ConfirmDialog';
import {
  useUsers,
  useCreateUser,
  useUpdatePassword,
  useDeleteUsers,
} from '../../queries/useUsersQuery';
import { showApiError } from '../../utils/apiError';

/**
 * 用户管理页面。
 *
 * - 用户列表（getUsers）
 * - 创建用户（group 仅 user|guest，不能创建 administrator）
 * - 改密（updatePassword）
 * - 删除用户（deleteUsers）
 */
export default function UserManage() {
  const { data: users = [], isPending } = useUsers();
  const createMutation = useCreateUser();
  const pwdMutation = useUpdatePassword();
  const deleteMutation = useDeleteUsers();
  const saving =
    createMutation.isPending
    || pwdMutation.isPending
    || deleteMutation.isPending;

  // 创建表单
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newGroup, setNewGroup] = useState<'user' | 'guest'>('user');

  // 改密
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [newPwd, setNewPwd] = useState('');

  // 待删除的用户名（非 null 时显示确认对话框）
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  async function handleCreate() {
    const name = newName.trim();
    const password = newPassword.trim();
    if (!name || !password) {
      M3eSnackbar.open('用户名和密码不能为空');
      return;
    }
    if (name.length < 4) {
      M3eSnackbar.open('用户名至少 4 个字符');
      return;
    }
    if (password.length < 5) {
      M3eSnackbar.open('密码至少 5 个字符');
      return;
    }
    try {
      await createMutation.mutateAsync({ name, password, group: newGroup });
      setNewName('');
      setNewPassword('');
      setNewGroup('user');
      M3eSnackbar.open(`用户 ${name} 创建成功`);
    } catch (err) {
      showApiError(err, '创建失败');
    }
  }

  async function handleUpdatePassword() {
    if (!editingUser) return;
    const pwd = newPwd.trim();
    if (!pwd || pwd.length < 5) {
      M3eSnackbar.open('密码至少 5 个字符');
      return;
    }
    try {
      await pwdMutation.mutateAsync({ name: editingUser, newPassword: pwd });
      setEditingUser(null);
      setNewPwd('');
      M3eSnackbar.open(`用户 ${editingUser} 密码已更新`);
    } catch (err) {
      showApiError(err, '更新失败');
    }
  }

  function handleDelete(name: string) {
    setPendingDelete(name);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const name = pendingDelete;
    setPendingDelete(null);
    try {
      await deleteMutation.mutateAsync({ users: [{ name }] });
      M3eSnackbar.open(`用户 ${name} 已删除`);
    } catch (err) {
      showApiError(err, '删除失败');
    }
  }

  function onGroupChange(e: Event) {
    const value = (e.target as M3eSelectElement).value as string | null;
    if (value === 'user' || value === 'guest') {
      setNewGroup(value);
    }
  }

  if (isPending) {
    return <p className='opacity-70'>加载中…</p>;
  }

  return (
    <div className='flex flex-col gap-4'>
      {/* 用户列表 */}
      <M3eCard>
        <div slot='header'>
          <span className='text-sm font-medium'>用户列表 ({users.length})</span>
        </div>
        <div slot='content'>
          {users.length === 0 && (
            <p className='m-0 text-sm opacity-50'>暂无用户</p>
          )}

          <div className='flex flex-col gap-2'>
            {users.map((user) => (
              <div
                key={user.name}
                className='flex items-center justify-between gap-2 rounded-md border border-[var(--md-sys-color-outline-variant)] p-3'
              >
                <div className='min-w-0 flex-1'>
                  <span className='text-sm font-medium'>{user.name}</span>
                  <span
                    className='ml-2 rounded-sm px-1.5 py-0.5 text-xs'
                    style={{
                      background: 'var(--md-sys-color-secondary-container)',
                      color: 'var(--md-sys-color-on-secondary-container)',
                    }}
                  >
                    {user.group}
                  </span>
                </div>

                <div className='flex shrink-0 gap-1'>
                  {editingUser === user.name ? (
                    <>
                      <M3eFormField variant='outlined' hideSubscript='always'>
                        <label slot='label' htmlFor={`pwd-${user.name}`}>
                          新密码
                        </label>
                        <input
                          id={`pwd-${user.name}`}
                          type='password'
                          value={newPwd}
                          onChange={(e) => setNewPwd(e.target.value)}
                          placeholder='至少 5 个字符'
                          className='w-full border-none bg-transparent py-2 text-sm outline-none'
                        />
                      </M3eFormField>
                      <M3eButton
                        variant='text'
                        onClick={() => {
                          setEditingUser(null);
                          setNewPwd('');
                        }}
                      >
                        取消
                      </M3eButton>
                      <M3eButton
                        variant='filled'
                        disabled={saving}
                        onClick={handleUpdatePassword}
                      >
                        保存
                      </M3eButton>
                    </>
                  ) : (
                    <>
                      <M3eButton
                        variant='text'
                        onClick={() => {
                          setEditingUser(user.name);
                          setNewPwd('');
                        }}
                      >
                        改密
                      </M3eButton>
                      <M3eButton
                        variant='text'
                        className='text-[var(--md-sys-color-error)]'
                        disabled={saving}
                        onClick={() => handleDelete(user.name)}
                      >
                        删除
                      </M3eButton>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </M3eCard>

      {/* 创建用户 */}
      <M3eCard>
        <div slot='header'>
          <span className='text-sm font-medium'>创建用户</span>
        </div>
        <div slot='content'>
          <div className='flex flex-col gap-3'>
            <M3eFormField variant='outlined' hideSubscript='always'>
              <label slot='label' htmlFor='new-user-name'>
                用户名（至少 4 个字符）
              </label>
              <input
                id='new-user-name'
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder='用户名'
                className='w-full border-none bg-transparent py-2 text-sm outline-none'
              />
            </M3eFormField>
            <M3eFormField variant='outlined' hideSubscript='always'>
              <label slot='label' htmlFor='new-user-pwd'>
                密码（至少 5 个字符）
              </label>
              <input
                id='new-user-pwd'
                type='password'
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder='密码'
                className='w-full border-none bg-transparent py-2 text-sm outline-none'
              />
            </M3eFormField>
            <M3eFormField variant='outlined' hideSubscript='always'>
              <label slot='label' htmlFor='new-user-group'>
                用户组
              </label>
              <M3eSelect id='new-user-group' onChange={onGroupChange}>
                <M3eOption value='user' selected={newGroup === 'user'}>
                  user
                </M3eOption>
                <M3eOption value='guest' selected={newGroup === 'guest'}>
                  guest
                </M3eOption>
              </M3eSelect>
            </M3eFormField>
            <M3eButton
              variant='filled'
              disabled={saving}
              onClick={handleCreate}
            >
              {saving ? '创建中…' : '创建用户'}
            </M3eButton>
          </div>
        </div>
      </M3eCard>

      <ConfirmDialog
        open={pendingDelete !== null}
        title='删除用户'
        message={
          pendingDelete !== null
            ? `确定删除用户「${pendingDelete}」吗？该操作不可恢复。`
            : ''
        }
        confirmLabel='删除'
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

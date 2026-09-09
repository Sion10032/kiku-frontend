import { useState } from 'react';
import { M3eButton } from '@m3e/react/button';
import { M3eCard } from '@m3e/react/card';
import { M3eDialog } from '@m3e/react/dialog';
import { M3eFormField } from '@m3e/react/form-field';
import { M3eSnackbar } from '@m3e/react/snackbar';
import { useTranslation } from 'react-i18next';
import ConfirmDialog from '../../components/ConfirmDialog';
import DashboardPage from '../../components/dashboard/DashboardPage';
import { InputRow, SegmentedRow } from '../../components/dashboard/SettingRows';
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
  const { t } = useTranslation();
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
      M3eSnackbar.open(t('dashboard.users.name-required'));
      return;
    }
    if (name.length < 4) {
      M3eSnackbar.open(t('dashboard.users.name-too-short'));
      return;
    }
    if (password.length < 5) {
      M3eSnackbar.open(t('dashboard.users.password-too-short'));
      return;
    }
    try {
      await createMutation.mutateAsync({ name, password, group: newGroup });
      setNewName('');
      setNewPassword('');
      setNewGroup('user');
      M3eSnackbar.open(t('dashboard.users.create-success', { name }));
    } catch (err) {
      showApiError(err, t('dashboard.users.create-failed'));
    }
  }

  async function handleUpdatePassword() {
    if (!editingUser) return;
    const pwd = newPwd.trim();
    if (!pwd || pwd.length < 5) {
      M3eSnackbar.open(t('dashboard.users.password-too-short'));
      return;
    }
    try {
      await pwdMutation.mutateAsync({ name: editingUser, newPassword: pwd });
      setEditingUser(null);
      setNewPwd('');
      M3eSnackbar.open(t('dashboard.users.pwd-updated', { name: editingUser }));
    } catch (err) {
      showApiError(err, t('dashboard.users.update-failed'));
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
      M3eSnackbar.open(t('dashboard.users.deleted', { name }));
    } catch (err) {
      showApiError(err, t('dashboard.users.delete-failed'));
    }
  }

  if (isPending) {
    return (
      <DashboardPage title={t('dashboard.users.title')}>
        <p className='opacity-70'>{t('common.loading')}</p>
      </DashboardPage>
    );
  }

  return (
    <DashboardPage title={t('dashboard.users.title')}>
      {/* 用户列表 */}
      <h2 className='m-0 text-lg font-normal'>
        {t('dashboard.users.list', { n: users.length })}
      </h2>
      <M3eCard>
        <div slot='content'>
          {users.length === 0 && (
            <p className='m-0 text-sm opacity-50'>
              {t('dashboard.users.empty')}
            </p>
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
                  <M3eButton
                    variant='text'
                    onClick={() => {
                      setEditingUser(user.name);
                      setNewPwd('');
                    }}
                  >
                    {t('dashboard.users.change-pwd')}
                  </M3eButton>
                  <M3eButton
                    variant='text'
                    className='text-[var(--md-sys-color-error)]'
                    disabled={saving}
                    onClick={() => handleDelete(user.name)}
                  >
                    {t('common.delete')}
                  </M3eButton>
                </div>
              </div>
            ))}
          </div>
        </div>
      </M3eCard>

      {/* 创建用户 */}
      <h2 className='m-0 text-lg font-normal'>{t('dashboard.users.create')}</h2>
      <M3eCard>
        <div slot='content' className='flex flex-col gap-6'>
          <InputRow
            id='new-user-name'
            label={t('dashboard.users.username')}
            description={t('dashboard.users.username-desc')}
            placeholder={t('dashboard.users.username')}
            value={newName}
            onChange={setNewName}
          />
          <InputRow
            id='new-user-pwd'
            type='password'
            label={t('dashboard.users.password')}
            description={t('dashboard.users.password-desc')}
            placeholder={t('dashboard.users.password')}
            value={newPassword}
            onChange={setNewPassword}
          />
          <SegmentedRow
            label={t('dashboard.users.group')}
            options={[
              { value: 'user', label: 'user' },
              { value: 'guest', label: 'guest' },
            ]}
            value={newGroup}
            onChange={(value) => {
              if (value === 'user' || value === 'guest') setNewGroup(value);
            }}
          />
          <div className='flex justify-end'>
            <M3eButton
              variant='filled'
              disabled={saving}
              onClick={handleCreate}
            >
              {saving
                ? t('dashboard.users.creating')
                : t('dashboard.users.create')}
            </M3eButton>
          </div>
        </div>
      </M3eCard>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={t('dashboard.users.delete-title')}
        message={
          pendingDelete !== null
            ? t('dashboard.users.delete-confirm', { name: pendingDelete })
            : ''
        }
        confirmLabel={t('common.delete')}
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

      {/* 修改密码 */}
      <PasswordDialog
        user={editingUser}
        pwd={newPwd}
        saving={pwdMutation.isPending}
        onPwdChange={setNewPwd}
        onSave={handleUpdatePassword}
        onClose={() => setEditingUser(null)}
      />
    </DashboardPage>
  );
}

/** 改密弹窗：常驻挂载 + open 控制。 */
function PasswordDialog({
  user,
  pwd,
  saving,
  onPwdChange,
  onSave,
  onClose,
}: {
  user: string | null;
  pwd: string;
  saving: boolean;
  onPwdChange: (value: string) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <M3eDialog
      open={user !== null}
      dismissible
      closeLabel={t('common.close')}
      onClosed={onClose}
    >
      <span slot='header'>{t('dashboard.users.pwd-dialog-title')}</span>
      <div className='flex flex-col gap-4 py-2'>
        <p className='m-0 text-sm opacity-70'>
          {t('dashboard.users.user-label', { name: user ?? '' })}
        </p>
        <p className='m-0 text-sm opacity-70'>
          {t('dashboard.users.new-pwd-hint')}
        </p>
        <M3eFormField
          variant='outlined'
          hideSubscript='always'
          floatLabel='always'
        >
          <input
            id='dlg-new-pwd'
            aria-label={t('dashboard.users.new-pwd')}
            type='password'
            value={pwd}
            onChange={(e) => onPwdChange(e.target.value)}
            className='w-full border-none bg-transparent py-2 text-sm outline-none'
          />
        </M3eFormField>
      </div>
      <div slot='actions' className='flex justify-end gap-2'>
        <M3eButton variant='text' onClick={onClose}>
          {t('common.cancel')}
        </M3eButton>
        <M3eButton variant='filled' disabled={saving} onClick={onSave}>
          {t('common.save')}
        </M3eButton>
      </div>
    </M3eDialog>
  );
}

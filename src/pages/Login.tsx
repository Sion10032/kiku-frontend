import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { useNavigate, Link } from '@tanstack/react-router';
import { M3eFormField } from '@m3e/react/form-field';
import { M3eButton } from '@m3e/react/button';
import { M3eIcon } from '@m3e/react/icon';
import { M3eSnackbar } from '@m3e/react/snackbar';
import '@m3e/icons/outlined/person';
import '@m3e/icons/outlined/lock';
import '@m3e/icons/outlined/library_music';
import { useAuth } from '../hooks/useAuth';
import { getCachedSharedConfig } from '../api/sharedConfig';
import { ApiError } from '../api/client';

/**
 * 登录页。
 *
 * 表单提交 → useAuth.login → 存 token + 更新 userStore → 跳转 /works。
 * 401 显示后端错误信息；其他错误统一提示。
 */
export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  /** 原生 input 上按回车 → 手动触发 form 提交（M3eButton 在 shadow DOM 内，隐式提交不可靠）。 */
  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    e.currentTarget.form?.requestSubmit();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      await login({ name, password });
      M3eSnackbar.open('登录成功');
      navigate({ to: '/works' });
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.status === 401
            ? '用户名或密码错误'
            : err.message
          : '登录失败，请检查网络';
      M3eSnackbar.open(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className='flex min-h-dvh items-center justify-center p-4'>
      <form
        onSubmit={onSubmit}
        className='flex w-full max-w-sm flex-col gap-5 rounded-3xl p-8 shadow-lg'
      >
        <div className='mb-2 flex flex-col items-center gap-2'>
          <M3eIcon name='library_music' className='text-4xl' />
          <h1 className='m-0 text-2xl font-medium'>Kiku</h1>
        </div>

        <M3eFormField variant='outlined' className='w-full'>
          <label slot='label' htmlFor='login-name'>
            用户名
          </label>
          <M3eIcon slot='prefix' name='person' />
          <input
            id='login-name'
            type='text'
            autoComplete='username'
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={onKeyDown}
            required
            minLength={4}
            className='w-full border-none bg-transparent p-y-2 text-base outline-none'
          />
        </M3eFormField>

        <M3eFormField variant='outlined' className='w-full'>
          <label slot='label' htmlFor='login-password'>
            密码
          </label>
          <M3eIcon slot='prefix' name='lock' />
          <input
            id='login-password'
            type='password'
            autoComplete='current-password'
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={onKeyDown}
            required
            minLength={5}
            className='w-full border-none bg-transparent py-2 text-base outline-none'
          />
        </M3eFormField>

        <M3eButton
          type='submit'
          variant='filled'
          className='mt-2 w-full'
          disabled={loading}
        >
          {loading ? '登录中…' : '登录'}
        </M3eButton>

        {getCachedSharedConfig()?.allowRegistration && (
          <Link
            to='/register'
            className='text-center text-sm text-(--md-sys-color-primary) no-underline'
          >
            没有账号？注册
          </Link>
        )}
      </form>
    </div>
  );
}

import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from '@tanstack/react-router';
import { M3eFormField } from '@m3e/react/form-field';
import { M3eButton } from '@m3e/react/button';
import { M3eIcon } from '@m3e/react/icon';
import { M3eSnackbar } from '@m3e/react/snackbar';
import '@m3e/icons/outlined/person';
import '@m3e/icons/outlined/lock';
import '@m3e/icons/outlined/library_music';
import { register } from '../api/auth';
import { setToken } from '../api/token';
import { useUserStore } from '../stores/userStore';
import { ApiError } from '../api/client';

/**
 * 注册页。守卫保证仅在 allowRegistration 开启时可到达。
 * 注册成功自动登录（存 token + 更新 userStore）→ 跳 /works。
 * 重名（409）提示「用户名已存在」。
 */
export default function Register() {
  const navigate = useNavigate();
  const setUser = useUserStore((s) => s.setUser);
  const setAuth = useUserStore((s) => s.setAuth);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const res = await register({ name: name.trim(), password });
      setToken(res.token);
      setUser(res.name, res.group);
      setAuth(true);
      M3eSnackbar.open('注册成功');
      navigate({ to: '/works' });
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.status === 409
            ? '用户名已存在'
            : err.message
          : '注册失败，请检查网络';
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
          <h1 className='m-0 text-2xl font-medium'>注册 Kiku</h1>
        </div>

        <M3eFormField variant='outlined' className='w-full'>
          <label slot='label' htmlFor='register-name'>
            用户名
          </label>
          <M3eIcon slot='prefix' name='person' />
          <input
            id='register-name'
            type='text'
            autoComplete='username'
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={4}
            className='w-full border-none bg-transparent py-2 text-base outline-none'
          />
        </M3eFormField>

        <M3eFormField variant='outlined' className='w-full'>
          <label slot='label' htmlFor='register-password'>
            密码
          </label>
          <M3eIcon slot='prefix' name='lock' />
          <input
            id='register-password'
            type='password'
            autoComplete='new-password'
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
          {loading ? '注册中…' : '注册'}
        </M3eButton>

        <Link
          to='/login'
          className='text-center text-sm text-(--md-sys-color-primary) no-underline'
        >
          已有账号？返回登录
        </Link>
      </form>
    </div>
  );
}

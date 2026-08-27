import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { M3eFormField } from '@m3e/react/form-field';
import { M3eButton } from '@m3e/react/button';
import { M3eIcon } from '@m3e/react/icon';
import { M3eSwitch } from '@m3e/react/switch';
import { M3eRadio } from '@m3e/react/radio-group';
import {
  M3eStepper,
  M3eStep,
  M3eStepPanel,
  M3eStepperNext,
  M3eStepperPrevious,
} from '@m3e/react/stepper';
import { M3eSnackbar } from '@m3e/react/snackbar';
import '@m3e/icons/outlined/person';
import '@m3e/icons/outlined/lock';
import '@m3e/icons/outlined/library_music';
import { setup as apiSetup } from '../api/auth';
import { setToken } from '../api/token';
import { markSetupDone, refreshSharedConfig } from '../api/sharedConfig';
import { useUserStore } from '../stores/userStore';
import { ApiError } from '../api/client';
import type { InstanceMode } from '../types';

/**
 * 首次部署引导向导（m3e-stepper 三步，linear）：
 * 1. 管理员账号（form 校验 name ≥ 4、password ≥ 5 门控下一步）
 * 2. 实例模式（默认私有）
 * 3. 允许注册开关（默认关）
 *
 * 提交 POST /api/auth/setup → 存 token + 更新 userStore → 跳 /works。
 * 根路由守卫保证仅在用户表为空时可到达本页。
 */
export default function Setup() {
  const navigate = useNavigate();
  const setUser = useUserStore((s) => s.setUser);
  const setAuth = useUserStore((s) => s.setAuth);

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [instanceMode, setInstanceMode] = useState<InstanceMode>('private');
  const [allowRegistration, setAllowRegistration] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await apiSetup({
        name: name.trim(),
        password,
        instanceMode,
        allowRegistration,
      });
      setToken(res.token);
      setUser(res.name, res.group);
      setAuth(true);
      markSetupDone();
      await refreshSharedConfig();
      M3eSnackbar.open('初始化完成');
      navigate({ to: '/works' });
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : '初始化失败，请检查网络';
      M3eSnackbar.open(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className='flex min-h-dvh items-center justify-center p-4'>
      <div className='flex w-full max-w-md flex-col gap-5 rounded-3xl p-8 shadow-lg'>
        <div className='mb-2 flex flex-col items-center gap-2'>
          <M3eIcon name='library_music' className='text-4xl' />
          <h1 className='m-0 text-2xl font-medium'>Kiku 初始化</h1>
        </div>

        <M3eStepper orientation='vertical'>
          {/* 第 1 步：管理员账号（form 校验门控下一步） */}
          {/* for 是 React 保留属性名，用 attr:for 前缀设置为 attribute */}
          <M3eStep htmlFor='setup-step-account'>管理员账号</M3eStep>
          <M3eStep htmlFor='setup-step-mode'>实例模式</M3eStep>
          <M3eStep htmlFor='setup-step-register'>注册开关</M3eStep>

          <M3eStepPanel id='setup-step-account'>
            <form className='flex flex-col gap-5'>
              <M3eFormField variant='outlined' className='w-full'>
                <label slot='label' htmlFor='setup-name'>
                  管理员用户名
                </label>
                <M3eIcon slot='prefix' name='person' />
                <input
                  id='setup-name'
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
                <label slot='label' htmlFor='setup-password'>
                  密码
                </label>
                <M3eIcon slot='prefix' name='lock' />
                <input
                  id='setup-password'
                  type='password'
                  autoComplete='new-password'
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={5}
                  className='w-full border-none bg-transparent py-2 text-base outline-none'
                />
              </M3eFormField>
            </form>
            <div slot='actions'>
              <M3eButton>
                <M3eStepperNext>下一步</M3eStepperNext>
              </M3eButton>
            </div>
          </M3eStepPanel>

          <M3eStepPanel id='setup-step-mode'>
            <p className='m-0 text-sm opacity-70'>
              私有模式需要登录；公开模式匿名可浏览（只读）。
            </p>
            <form className='mt-4 flex flex-col gap-3'>
              <label className='flex cursor-pointer items-center gap-3'>
                <M3eRadio
                  name='instance-mode'
                  checked={instanceMode === 'private'}
                  onChange={() => setInstanceMode('private')}
                />
                <span className='text-sm'>私有（需要登录）</span>
              </label>
              <label className='flex cursor-pointer items-center gap-3'>
                <M3eRadio
                  name='instance-mode'
                  checked={instanceMode === 'public'}
                  onChange={() => setInstanceMode('public')}
                />
                <span className='text-sm'>公开（匿名只读浏览）</span>
              </label>
            </form>
            <div slot='actions'>
              <M3eButton>
                <M3eStepperPrevious>上一步</M3eStepperPrevious>
              </M3eButton>
              <M3eButton>
                <M3eStepperNext>下一步</M3eStepperNext>
              </M3eButton>
            </div>
          </M3eStepPanel>

          <M3eStepPanel id='setup-step-register'>
            <p className='m-0 text-sm opacity-70'>
              是否允许用户自行注册（注册用户默认 user 权限，可随时在后台修改）。
            </p>
            <label className='mt-4 flex items-center justify-between gap-3'>
              <span className='text-sm'>允许注册</span>
              <M3eSwitch
                checked={allowRegistration}
                onInput={(e) =>
                  setAllowRegistration((e.target as HTMLInputElement).checked)
                }
              />
            </label>
            <div slot='actions'>
              <M3eButton>
                <M3eStepperPrevious>上一步</M3eStepperPrevious>
              </M3eButton>
              <M3eButton disabled={loading} onClick={onSubmit}>
                {loading ? '初始化中…' : '完成初始化'}
              </M3eButton>
            </div>
          </M3eStepPanel>
        </M3eStepper>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import {
  MIGRATION_SSE_URL,
  setup as apiSetup,
  getMigrationStatus,
  runMigration,
  type MigrationSseData,
} from '../api/setup';
import { setToken } from '../api/token';
import { markSetupDone, refreshSharedConfig } from '../api/sharedConfig';
import { useSSE } from '../hooks/useSSE';
import { useUserStore } from '../stores/userStore';
import { ApiError } from '../api/client';
import type { InstanceMode } from '../types';

/**
 * 首次部署引导向导（m3e-stepper 四步，linear）：
 * 1. 管理员账号（form 校验 name ≥ 4、password ≥ 5 门控下一步）
 * 2. 迁移旧数据（检测 kikoeru 旧数据，展示版本与统计；开关选择是否迁移）
 * 3. 实例模式（默认私有）
 * 4. 允许注册开关（默认关）
 *
 * 点击完成初始化：需迁移时先启动后台迁移（SSE 展示进度，完成/失败自动衔接），随后
 * 提交 POST /api/setup → 存 token + 更新 userStore → 跳 /works。
 * 根路由守卫保证仅在用户表为空时可到达本页。
 */

/** 向导提交阶段：idle 可点击；migrating 后台迁移中；finishing 正在写入初始化配置 */
type SetupPhase = 'idle' | 'migrating' | 'finishing';
export default function Setup() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setUser = useUserStore((s) => s.setUser);
  const setAuth = useUserStore((s) => s.setAuth);

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [instanceMode, setInstanceMode] = useState<InstanceMode>('private');
  const [allowRegistration, setAllowRegistration] = useState(false);
  const [phase, setPhase] = useState<SetupPhase>('idle');
  const phaseRef = useRef<SetupPhase>('idle');
  const [mig, setMig] = useState({ imported: 0, total: 0 });
  const [migStatus, setMigStatus] = useState<Awaited<
    ReturnType<typeof getMigrationStatus>
  > | null>(null);
  const [migLoading, setMigLoading] = useState(true);
  const [migEnabled, setMigEnabled] = useState(true);

  const goPhase = (p: SetupPhase): void => {
    phaseRef.current = p;
    setPhase(p);
  };

  // 首次挂载拉取迁移状态（migLoading 初始即 true，避免在 effect 体内 setState）；
  // migStatus 就绪（含失败兜底值）后 effect 早退，不会重复请求
  useEffect(() => {
    if (migStatus) return;
    getMigrationStatus()
      .then(setMigStatus)
      .catch(() => setMigStatus({ available: false, migrated: false }))
      .finally(() => setMigLoading(false));
  }, [migStatus]);

  // 是否随初始化迁移：检测到旧数据且开关打开且尚未迁移
  const shouldMigrate =
    migStatus?.available === true && migEnabled && !migStatus.migrated;

  async function submitSetup(): Promise<void> {
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
      M3eSnackbar.open(t('auth.setup.success'));
      navigate({ to: '/works' });
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : t('auth.setup.failed');
      M3eSnackbar.open(msg);
      goPhase('idle');
      // 置空迁移状态触发重新拉取：迁移已完成时（migrated=true）重试将
      // 直接提交初始化，避免重复 runMigration 而陷入迁移错误循环
      setMigStatus(null);
    }
  }

  function proceedAfterMigration(): void {
    if (phaseRef.current !== 'migrating') return;
    goPhase('finishing');
    void submitSetup();
  }

  function failMigration(error?: string | null): void {
    if (phaseRef.current !== 'migrating') return;
    goPhase('idle');
    M3eSnackbar.open(error ?? t('auth.setup.migration-failed'));
  }

  async function onSubmit(): Promise<void> {
    if (phaseRef.current !== 'idle') return;
    if (!shouldMigrate) {
      goPhase('finishing');
      await submitSetup();
      return;
    }
    goPhase('migrating');
    try {
      await runMigration();
    } catch (err) {
      // 409 = 已有迁移在跑（如上次中断遗留），直接订阅进度即可
      if (!(err instanceof ApiError && err.status === 409)) {
        goPhase('idle');
        M3eSnackbar.open(
          err instanceof ApiError
            ? err.message
            : t('auth.setup.migration-start-failed'),
        );
      }
    }
  }

  // 仅迁移阶段订阅；DONE/ERROR 终态由 init 重放兜底（刷新/断线重连恢复）
  useSSE(phase === 'migrating' ? MIGRATION_SSE_URL : '', (event, data) => {
    const d = data as MigrationSseData;
    switch (event) {
      case 'MIGRATION_STATE':
        if (d.error) {
          failMigration(d.error);
          return;
        }
        if (d.stats) {
          proceedAfterMigration();
          return;
        }
        if (d.running) setMig({ imported: d.imported, total: d.total });
        return;
      case 'MIGRATION_PROGRESS':
        setMig({ imported: d.imported, total: d.total });
        return;
      case 'MIGRATION_DONE':
        proceedAfterMigration();
        return;
      case 'MIGRATION_ERROR':
        failMigration(d.error);
        return;
    }
  });

  return (
    <div className='flex min-h-dvh items-center justify-center p-4'>
      <div className='flex w-full max-w-md flex-col gap-5 rounded-3xl p-8 shadow-lg'>
        <div className='mb-2 flex flex-col items-center gap-2'>
          <M3eIcon name='library_music' className='text-4xl' />
          <h1 className='m-0 text-2xl font-medium'>{t('auth.setup.title')}</h1>
        </div>

        <M3eStepper orientation='vertical' linear>
          <M3eStep editable htmlFor='setup-step-account'>
            {t('auth.setup.step-account')}
          </M3eStep>
          <M3eStep editable htmlFor='setup-step-migrate'>
            {t('auth.setup.step-migrate')}
          </M3eStep>
          <M3eStep editable htmlFor='setup-step-mode'>
            {t('auth.setup.step-mode')}
          </M3eStep>
          <M3eStep editable htmlFor='setup-step-register'>
            {t('auth.setup.step-register')}
          </M3eStep>

          <M3eStepPanel id='setup-step-account'>
            <form className='flex flex-col gap-5'>
              <M3eFormField variant='outlined' className='w-full'>
                <label slot='label' htmlFor='setup-name'>
                  {t('auth.setup.admin-username')}
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
                  {t('auth.password')}
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
                <M3eStepperNext>{t('auth.setup.next')}</M3eStepperNext>
              </M3eButton>
            </div>
          </M3eStepPanel>

          {/* 第 2 步：迁移旧数据（探测数量展示 + 是否迁移的选择，迁移推迟到提交时执行） */}
          <M3eStepPanel id='setup-step-migrate'>
            {migLoading && !migStatus && (
              <p className='m-0 text-sm opacity-70'>
                {t('auth.setup.detecting')}
              </p>
            )}

            {!migStatus?.available && !migLoading && (
              <p className='m-0 text-sm opacity-70'>
                {t('auth.setup.no-old-data')}
              </p>
            )}

            {migStatus?.available && (
              <div className='flex flex-col gap-3'>
                <p className='m-0 text-sm opacity-70'>
                  {migStatus.flavor === 'number178-fork'
                    ? t('auth.setup.detected-number178')
                    : t('auth.setup.detected-kikoeru')}
                </p>
                <ul className='m-0 list-inside list-disc text-sm'>
                  <li>
                    {t('auth.setup.stat-works', {
                      count: migStatus.stats?.works ?? 0,
                    })}
                  </li>
                  <li>
                    {t('auth.setup.stat-users', {
                      count: migStatus.stats?.users ?? 0,
                    })}
                  </li>
                  <li>
                    {t('auth.setup.stat-reviews', {
                      count: migStatus.stats?.reviews ?? 0,
                    })}
                  </li>
                  <li>
                    {t('auth.setup.stat-play-history', {
                      count: migStatus.stats?.playHistory ?? 0,
                    })}
                  </li>
                  <li>
                    {t('auth.setup.stat-covers', {
                      count: migStatus.stats?.covers ?? 0,
                    })}
                  </li>
                </ul>
                <label className='mt-2 flex items-center justify-between gap-3'>
                  <span className='text-sm'>
                    {t('auth.setup.step-migrate')}
                  </span>
                  <M3eSwitch
                    checked={migEnabled}
                    onInput={(e) =>
                      setMigEnabled((e.target as HTMLInputElement).checked)
                    }
                  />
                </label>
                <p className='m-0 text-xs opacity-60'>
                  {t('auth.setup.migrate-switch-desc')}
                </p>
                <p className='m-0 text-xs opacity-60'>
                  {t('auth.setup.root-folder-hint')}
                </p>
              </div>
            )}

            <div slot='actions'>
              <M3eButton>
                <M3eStepperPrevious>
                  {t('auth.setup.previous')}
                </M3eStepperPrevious>
              </M3eButton>
              <M3eButton>
                <M3eStepperNext>{t('auth.setup.next')}</M3eStepperNext>
              </M3eButton>
            </div>
          </M3eStepPanel>

          <M3eStepPanel id='setup-step-mode'>
            <p className='m-0 text-sm opacity-70'>
              {t('auth.setup.mode-desc')}
            </p>
            <form className='mt-4 flex flex-col gap-3'>
              <label className='flex cursor-pointer items-center gap-3'>
                <M3eRadio
                  name='instance-mode'
                  checked={instanceMode === 'private'}
                  onChange={() => setInstanceMode('private')}
                />
                <span className='text-sm'>{t('auth.setup.mode-private')}</span>
              </label>
              <label className='flex cursor-pointer items-center gap-3'>
                <M3eRadio
                  name='instance-mode'
                  checked={instanceMode === 'public'}
                  onChange={() => setInstanceMode('public')}
                />
                <span className='text-sm'>{t('auth.setup.mode-public')}</span>
              </label>
            </form>
            <div slot='actions'>
              <M3eButton>
                <M3eStepperPrevious>
                  {t('auth.setup.previous')}
                </M3eStepperPrevious>
              </M3eButton>
              <M3eButton>
                <M3eStepperNext>{t('auth.setup.next')}</M3eStepperNext>
              </M3eButton>
            </div>
          </M3eStepPanel>

          <M3eStepPanel id='setup-step-register'>
            <p className='m-0 text-sm opacity-70'>
              {t('auth.setup.register-desc')}
            </p>
            <label className='mt-4 flex items-center justify-between gap-3'>
              <span className='text-sm'>
                {t('auth.setup.allow-registration')}
              </span>
              <M3eSwitch
                checked={allowRegistration}
                onInput={(e) =>
                  setAllowRegistration((e.target as HTMLInputElement).checked)
                }
              />
            </label>
            {(phase === 'migrating' || phase === 'finishing') && (
              <div className='mt-3 flex flex-col gap-1'>
                {phase === 'migrating' ? (
                  <>
                    <span className='text-sm opacity-70'>
                      {t('auth.setup.migrating', {
                        imported: mig.imported,
                        total: mig.total,
                      })}
                    </span>
                    <progress
                      className='w-full'
                      value={mig.total > 0 ? mig.imported : 0}
                      max={mig.total > 0 ? mig.total : 1}
                    />
                  </>
                ) : (
                  <span className='text-sm opacity-70'>
                    {t('auth.setup.finalizing')}
                  </span>
                )}
              </div>
            )}
            <div slot='actions'>
              <M3eButton>
                <M3eStepperPrevious>
                  {t('auth.setup.previous')}
                </M3eStepperPrevious>
              </M3eButton>
              <M3eButton disabled={phase !== 'idle'} onClick={onSubmit}>
                {phase === 'migrating'
                  ? t('auth.setup.phase-migrating')
                  : phase === 'finishing'
                    ? t('auth.setup.phase-finishing')
                    : t('auth.setup.finish')}
              </M3eButton>
            </div>
          </M3eStepPanel>
        </M3eStepper>
      </div>
    </div>
  );
}

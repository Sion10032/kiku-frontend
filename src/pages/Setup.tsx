import { useEffect, useRef, useState } from 'react';
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
      M3eSnackbar.open('初始化完成');
      navigate({ to: '/works' });
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : '初始化失败，请检查网络';
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
    M3eSnackbar.open(error ?? '迁移失败');
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
          err instanceof ApiError ? err.message : '迁移启动失败，请检查网络',
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
          <h1 className='m-0 text-2xl font-medium'>Kiku 初始化</h1>
        </div>

        <M3eStepper orientation='vertical'>
          {/* 第 1 步：管理员账号（form 校验门控下一步） */}
          {/* for 是 React 保留属性名，用 attr:for 前缀设置为 attribute */}
          <M3eStep htmlFor='setup-step-account'>管理员账号</M3eStep>
          <M3eStep htmlFor='setup-step-migrate'>迁移旧数据</M3eStep>
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

          {/* 第 2 步：迁移旧数据（探测数量展示 + 是否迁移的选择，迁移推迟到提交时执行） */}
          <M3eStepPanel id='setup-step-migrate'>
            {migLoading && !migStatus && (
              <p className='m-0 text-sm opacity-70'>检测中…</p>
            )}

            {!migStatus?.available && !migLoading && (
              <p className='m-0 text-sm opacity-70'>
                未检测到旧数据（old-data 目录）。可跳过此步，之后无法自动迁移。
              </p>
            )}

            {migStatus?.available && (
              <div className='flex flex-col gap-3'>
                <p className='m-0 text-sm opacity-70'>
                  检测到
                  {migStatus.flavor === 'number178-fork'
                    ? ' Number178 fork 版（kikoeru number17）'
                    : ' kikoeru 原版'}
                  旧数据：
                </p>
                <ul className='m-0 list-inside list-disc text-sm'>
                  <li>作品 {migStatus.stats?.works ?? 0} 部</li>
                  <li>用户 {migStatus.stats?.users ?? 0} 个（含密码）</li>
                  <li>评论 {migStatus.stats?.reviews ?? 0} 条</li>
                  <li>
                    播放历史 {migStatus.stats?.playHistory ?? 0}{' '}
                    条（迁为已读标记）
                  </li>
                  <li>封面 {migStatus.stats?.covers ?? 0} 张</li>
                </ul>
                <label className='mt-2 flex items-center justify-between gap-3'>
                  <span className='text-sm'>迁移旧数据</span>
                  <M3eSwitch
                    checked={migEnabled}
                    onInput={(e) =>
                      setMigEnabled((e.target as HTMLInputElement).checked)
                    }
                  />
                </label>
                <p className='m-0 text-xs opacity-60'>
                  将在完成初始化时一并迁移；关闭则跳过，之后无法自动迁移。
                </p>
                <p className='m-0 text-xs opacity-60'>
                  迁移后请在设置中把 rootFolder
                  路径改为当前环境实际路径，再执行扫描。
                </p>
              </div>
            )}

            <div slot='actions'>
              <M3eButton>
                <M3eStepperPrevious>上一步</M3eStepperPrevious>
              </M3eButton>
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
            {(phase === 'migrating' || phase === 'finishing') && (
              <div className='mt-3 flex flex-col gap-1'>
                {phase === 'migrating' ? (
                  <>
                    <span className='text-sm opacity-70'>
                      正在迁移旧数据… {mig.imported}/{mig.total} 张封面
                    </span>
                    <progress
                      className='w-full'
                      value={mig.total > 0 ? mig.imported : 0}
                      max={mig.total > 0 ? mig.total : 1}
                    />
                  </>
                ) : (
                  <span className='text-sm opacity-70'>
                    迁移完成，正在写入初始化配置…
                  </span>
                )}
              </div>
            )}
            <div slot='actions'>
              <M3eButton>
                <M3eStepperPrevious>上一步</M3eStepperPrevious>
              </M3eButton>
              <M3eButton disabled={phase !== 'idle'} onClick={onSubmit}>
                {phase === 'migrating'
                  ? '迁移中…'
                  : phase === 'finishing'
                    ? '初始化中…'
                    : '完成初始化'}
              </M3eButton>
            </div>
          </M3eStepPanel>
        </M3eStepper>
      </div>
    </div>
  );
}

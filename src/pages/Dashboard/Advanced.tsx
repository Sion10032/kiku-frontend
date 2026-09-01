import { useState } from 'react';
import { useBlocker } from '@tanstack/react-router';
import { M3eButton } from '@m3e/react/button';
import { M3eCard } from '@m3e/react/card';
import { M3eDialog } from '@m3e/react/dialog';
import { M3eSnackbar } from '@m3e/react/snackbar';
import type { AdminConfig } from '../../types';
import { showApiError } from '../../utils/apiError';
import {
  useAdminConfig,
  useUpdateAdminConfig,
} from '../../queries/useAdminQuery';
import { SETTINGS_SECTIONS, validateNumbers } from './settingsSchema';
import SettingsSection from './SettingsSection';
import DashboardPage from '../../components/dashboard/DashboardPage';
import { InputRow } from '../../components/dashboard/SettingRows';

/**
 * 高级设置页面：SETTINGS_SECTIONS 驱动的表单。
 * - react-query 读写；dirty 时保存按钮可点、离开路由有确认。
 * - md5secret 只写不回显。
 */
export default function Advanced() {
  const { data: cfg, isPending } = useAdminConfig();
  const updateConfig = useUpdateAdminConfig();

  const [delta, setDelta] = useState<Partial<AdminConfig>>({});
  const [numberText, setNumberText] = useState<Partial<Record<string, string>>>(
    {},
  );
  const [secret, setSecret] = useState('');

  if (isPending)
    return (
      <DashboardPage title='高级设置'>
        <p className='opacity-70'>加载中…</p>
      </DashboardPage>
    );
  if (!cfg)
    return (
      <DashboardPage title='高级设置'>
        <p className='text-[var(--md-sys-color-error)]'>无法加载配置</p>
      </DashboardPage>
    );

  // 只读视图：服务器配置 + 本地增量 delta，无需同步 effect。
  // dirty = delta 非空（有字段改动）或填了新 secret。
  const draft: AdminConfig = { ...cfg, ...delta };
  const hasSecret = secret.trim().length > 0;
  const isDirty = Object.keys(delta).length > 0 || hasSecret;

  // const 箭头函数（非 function 声明）以保留上方空值窄化
  const setField = (key: string, value: unknown) => {
    setDelta((prev) => {
      // 改回服务器当前值＝撤销该字段的本地编辑
      if (value === cfg[key as keyof AdminConfig]) {
        const rest = Object.fromEntries(
          Object.entries(prev).filter(([k]) => k !== key),
        );
        return rest as Partial<AdminConfig>;
      }
      return { ...prev, [key]: value };
    });
  };

  const setNumText = (key: string, text: string) => {
    setNumberText((prev) => ({ ...prev, [key]: text }));
    const n = Number(text);
    if (text.trim() !== '' && Number.isFinite(n)) setField(key, n);
    // 空/非法文本不写入 delta，save 前由 validate 拦截
  };

  // save 前校验：先拦编辑中的非法数字输入，再对最终值做 min/max 范围校验
  const validate = (): string | null => {
    for (const section of SETTINGS_SECTIONS) {
      for (const field of section.fields) {
        if (field.type !== 'number') continue;
        const text = numberText[field.key];
        if (text === undefined) continue;
        const n = Number(text);
        if (text.trim() === '' || !Number.isFinite(n))
          return `「${field.label}」不是有效数字`;
      }
    }
    return validateNumbers(draft);
  };

  const handleSave = async () => {
    const err = validate();
    if (err) {
      M3eSnackbar.open(err);
      return;
    }
    // setField 已保证 delta 中每个键都 ≠ 服务器值，patch 直接取增量
    if (!isDirty) {
      M3eSnackbar.open('没有需要保存的更改');
      return;
    }
    const patch: Partial<AdminConfig> = { ...delta };
    if (hasSecret) patch.md5secret = secret.trim();
    try {
      await updateConfig.mutateAsync(patch);
      setDelta({});
      setNumberText({});
      setSecret('');
      M3eSnackbar.open('保存成功');
    } catch (e) {
      showApiError(e, '保存失败');
    }
  };

  return (
    <DashboardPage title='高级设置'>
      {SETTINGS_SECTIONS.map((section) => (
        <SettingsSection
          key={section.title}
          section={section}
          draft={draft}
          numberText={numberText}
          onChange={setField}
          onNumberTextChange={setNumText}
        />
      ))}

      {/* 安全：secret 只写不回显 */}
      <SecretCard secret={secret} onSecretChange={setSecret} />

      <div className='flex items-center justify-end gap-3'>
        {isDirty && <span className='text-xs opacity-60'>有未保存的更改</span>}
        <M3eButton
          variant='filled'
          disabled={!isDirty || updateConfig.isPending}
          onClick={handleSave}
        >
          {updateConfig.isPending ? '保存中…' : '保存所有设置'}
        </M3eButton>
      </div>

      <LeaveGuard isDirty={isDirty} />
    </DashboardPage>
  );
}

/** md5secret 只写输入区（h2 标题 + 行式输入，同设置分组版式）。 */
function SecretCard({
  secret,
  onSecretChange,
}: {
  secret: string;
  onSecretChange: (v: string) => void;
}) {
  return (
    <>
      <h2 className='m-0 text-lg font-normal'>安全设置</h2>
      <M3eCard>
        <div slot='content' className='flex flex-col gap-6'>
          <InputRow
            id='md5secret'
            label='MD5 Secret'
            description='只写不回显，留空则不修改'
            type='password'
            placeholder='输入新 secret…'
            widthClassName='sm:w-72'
            value={secret}
            onChange={onSecretChange}
          />
        </div>
      </M3eCard>
    </>
  );
}

/** dirty 离开守卫：路由跳转确认 + beforeunload。 */
function LeaveGuard({ isDirty }: { isDirty: boolean }) {
  const blocker = useBlocker({
    shouldBlockFn: () => isDirty,
    withResolver: true,
    enableBeforeUnload: true,
  });
  // 常驻挂载 + open 控制
  const blocked = blocker.status === 'blocked';
  return (
    <M3eDialog
      open={blocked}
      dismissible
      closeLabel='关闭'
      onClosed={() => {
        if (blocker.status === 'blocked') blocker.reset();
      }}
    >
      <span slot='header'>有未保存的更改</span>
      <p className='m-0 text-sm'>离开将丢弃当前修改，确定继续吗？</p>
      <div slot='actions' className='flex justify-end gap-2'>
        <M3eButton
          variant='text'
          onClick={() => {
            if (blocker.status === 'blocked') blocker.reset();
          }}
        >
          留下
        </M3eButton>
        <M3eButton
          variant='text'
          className='text-[var(--md-sys-color-error)]'
          onClick={() => {
            if (blocker.status === 'blocked') blocker.proceed();
          }}
        >
          离开
        </M3eButton>
      </div>
    </M3eDialog>
  );
}

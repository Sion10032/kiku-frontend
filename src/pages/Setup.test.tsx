// @vitest-environment jsdom
import type { ReactNode } from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Setup from './Setup';

// ---- mock 状态（vi.hoisted 保证先于被提升的 vi.mock 工厂求值可用）----
const h = vi.hoisted(() => ({
  api: {
    setup: vi.fn(),
    getMigrationStatus: vi.fn(),
    runMigration: vi.fn(),
  },
  snackbarOpen: vi.fn(),
}));

vi.mock('../api/setup', () => ({
  MIGRATION_SSE_URL: '/api/setup/migration/events',
  setup: h.api.setup,
  getMigrationStatus: h.api.getMigrationStatus,
  runMigration: h.api.runMigration,
  markSetupDone: () => {},
}));

// 挂载副作用：迁移进度 SSE 订阅替换为 no-op，只渲染静态结构
vi.mock('../hooks/useSSE', () => ({
  useSSE: () => {},
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => async () => {},
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('i18next', () => ({
  default: { t: (key: string) => key },
}));

vi.mock('@m3e/react/snackbar', () => ({
  M3eSnackbar: { open: h.snackbarOpen },
}));

// @m3e/web 组件在 jsdom 无法注册 custom elements，全部 mock 成轻量转发组件。
// stepper 系列转发到真实标签名（React 19 会把传入 props 设置为 attribute），
// 使测试能断言 Setup 传入的 linear / editable 接线是否真的到达元素。
vi.mock('@m3e/react/stepper', async () => {
  const { createElement } = await import('react');
  return {
    M3eStepper: (props: Record<string, unknown>) =>
      createElement('m3e-stepper', props),
    M3eStep: (props: Record<string, unknown>) =>
      createElement('m3e-step', props),
    M3eStepPanel: (props: Record<string, unknown>) =>
      createElement('m3e-step-panel', props),
    M3eStepperNext: (props: Record<string, unknown>) =>
      createElement('m3e-stepper-next', props),
    M3eStepperPrevious: (props: Record<string, unknown>) =>
      createElement('m3e-stepper-previous', props),
  };
});

vi.mock('@m3e/react/form-field', () => ({
  M3eFormField: (props: { children?: ReactNode }) => (
    <div>{props.children}</div>
  ),
}));

// M3eButton 必须透传 type：Next 的 submit 接线（Button-in-form）是被测契约
vi.mock('@m3e/react/button', () => ({
  M3eButton: (props: {
    children?: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    type?: 'button' | 'submit' | 'reset';
  }) => (
    <button
      type={props.type ?? 'button'}
      disabled={props.disabled}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  ),
}));

vi.mock('@m3e/react/icon', () => ({
  M3eIcon: (props: { name?: string; className?: string }) => (
    <span className={props.className} data-icon={props.name} />
  ),
}));

vi.mock('@m3e/react/switch', () => ({
  M3eSwitch: (props: { checked?: boolean }) => (
    <input type='checkbox' checked={props.checked ?? false} readOnly />
  ),
}));

vi.mock('@m3e/react/radio-group', () => ({
  M3eRadio: (props: { name?: string; checked?: boolean }) => (
    <input
      type='radio'
      name={props.name}
      checked={props.checked ?? false}
      readOnly
    />
  ),
}));

// 图标 side-effect 导入（注册 custom element）在 jsdom 无法执行，置空
vi.mock('@m3e/icons/outlined/person', () => ({}));
vi.mock('@m3e/icons/outlined/lock', () => ({}));
vi.mock('@m3e/icons/outlined/library_music', () => ({}));

function renderSetup() {
  return render(<Setup />);
}

/** 吸收仍在飞的异步更新（getMigrationStatus 的 promise 链） */
async function flushAsync() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

/** 第 1 步（管理员账号）panel 内的 form */
function accountForm(container: HTMLElement): HTMLFormElement {
  const form = container.querySelector<HTMLFormElement>(
    'm3e-step-panel#setup-step-account form',
  );
  if (!form) throw new Error('第 1 步 panel 内未找到 form');
  return form;
}

beforeEach(() => {
  h.api.getMigrationStatus.mockReset().mockResolvedValue({
    available: false,
    migrated: false,
  });
  h.snackbarOpen.mockClear();
});

afterEach(() => {
  cleanup();
});

describe('Setup 向导 linear 门控接线（P1-15）', () => {
  it('stepper 带 linear，四个 step 各带 editable', async () => {
    const { container } = renderSetup();
    await flushAsync();

    // linear：stepper 内部 _moveTo 的门控开关（缺失时第一步可任意前进/跳转）
    const stepper = container.querySelector('m3e-stepper');
    expect(stepper).not.toBeNull();
    expect(stepper?.hasAttribute('linear')).toBe(true);

    // editable：已完成步骤可回退修改（后退拦截的放行条件）
    const steps = container.querySelectorAll('m3e-step');
    expect(steps).toHaveLength(4);
    for (const step of steps) {
      expect(step.hasAttribute('editable')).toBe(true);
    }
  });

  it('第 1 步 form 约束接线：空/过短表单 checkValidity 为 false，合法输入后为 true', async () => {
    const { container } = renderSetup();
    await flushAsync();
    const form = accountForm(container);

    // 空表单：required（valueMissing）生效
    expect(form.checkValidity()).toBe(false);
    const username = screen.getByLabelText(
      'auth.setup.admin-username',
    ) as HTMLInputElement;
    const password = screen.getByLabelText('auth.password') as HTMLInputElement;
    expect(username.validity.valueMissing).toBe(true);

    // minLength 接线（tooShort 由真实浏览器原生校验执行；jsdom 不参与计算）
    expect(username.minLength).toBe(4);
    expect(password.minLength).toBe(5);

    // 合法输入后通过
    fireEvent.change(username, { target: { value: 'admin' } });
    fireEvent.change(password, { target: { value: 'secret' } });
    expect(form.checkValidity()).toBe(true);
  });

  it('第 1 步 Next 位于 actions 槽、不在 form 内：门控仅由 linear 承担', async () => {
    const { container } = renderSetup();
    await flushAsync();
    const form = accountForm(container);

    // 形态决定（经浏览器人工验证）：不引入原生 submit / requestSubmit 路径。
    // 前进与否完全由 stepper 的 linear 门控（_moveTo 对 panel form 的
    // checkValidity），form 仅承载 required/minLength 约束本身。
    expect(form.querySelector('button[type="submit"]')).toBeNull();
    expect(form.querySelector('m3e-stepper-next')).toBeNull();

    // Next 仍在第 1 步 panel 的 actions 槽中
    const panel = container.querySelector('m3e-step-panel#setup-step-account');
    expect(panel?.querySelector('m3e-stepper-next')).not.toBeNull();
  });

  it('挂载冒烟：渲染到第 1 步 panel（含用户名/密码输入框）', async () => {
    renderSetup();
    expect(
      await screen.findByLabelText('auth.setup.admin-username'),
    ).toBeDefined();
    expect(screen.getByLabelText('auth.password')).toBeDefined();
    // 第 1/2/3 步各有一个 Next（jsdom 下 panel 均渲染），非空即可
    expect(screen.getAllByText('auth.setup.next').length).toBeGreaterThan(0);
  });
});

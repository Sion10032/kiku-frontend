// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  getSetupNeeded: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('../api/setup', () => ({ getSetupNeeded: h.getSetupNeeded }));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => h.navigate,
  Link: (props: { children?: ReactNode }) => <a>{props.children}</a>,
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ login: vi.fn() }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('i18next', () => ({
  default: { t: (key: string) => key },
}));

vi.mock('@m3e/react/snackbar', () => ({
  M3eSnackbar: { open: vi.fn() },
}));

// @m3e/web 组件在 jsdom 无法注册 custom elements：全部降级为轻量转发
vi.mock('@m3e/react/form-field', () => ({
  M3eFormField: (props: { children?: ReactNode }) => (
    <div>{props.children}</div>
  ),
}));
vi.mock('@m3e/react/button', () => ({
  M3eButton: (props: { children?: ReactNode }) => (
    <button type='submit'>{props.children}</button>
  ),
}));
vi.mock('@m3e/react/icon', () => ({ M3eIcon: () => null }));

import Login from './Login';

describe('Login 初始化入口', () => {
  beforeEach(() => {
    h.getSetupNeeded.mockReset();
    h.navigate.mockReset();
  });
  afterEach(cleanup);

  it('needed=true：展示初始化入口，点击跳 /setup', () => {
    h.getSetupNeeded.mockReturnValue(true);
    render(<Login />);

    const entry = screen.getByText('auth.first-time-setup');
    fireEvent.click(entry);
    expect(h.navigate).toHaveBeenCalledWith({ to: '/setup' });
  });

  it('needed=false：不展示初始化入口，注册入口照旧', () => {
    h.getSetupNeeded.mockReturnValue(false);
    render(<Login />);

    expect(screen.queryByText('auth.first-time-setup')).toBeNull();
    expect(screen.getByText('auth.no-account-register')).toBeTruthy();
  });
});

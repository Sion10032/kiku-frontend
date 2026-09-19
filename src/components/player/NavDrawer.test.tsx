// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useUserStore } from '../../stores/userStore';
import NavDrawer from './NavDrawer';

vi.mock('@tanstack/react-router', () => ({
  Link: (props: {
    to: string;
    children?: ReactNode | ((state: { isActive: boolean }) => ReactNode);
  }) => (
    <a href={props.to}>
      {typeof props.children === 'function'
        ? props.children({ isActive: false })
        : props.children}
    </a>
  ),
  useNavigate: () => async () => {},
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// @m3e 组件在 jsdom 无法注册 custom elements，mock 成轻量转发组件；
// M3eNavMenu 渲染 <nav>，测试据此区分「滚动导航区」与「钉底区」两个菜单
vi.mock('@m3e/react/nav-menu', () => ({
  M3eNavMenu: (props: { children?: ReactNode }) => <nav>{props.children}</nav>,
  M3eNavMenuItemGroup: (props: { children?: ReactNode }) => (
    <div>{props.children}</div>
  ),
  M3eNavMenuItem: (props: { children?: ReactNode; selected?: boolean }) => (
    <div data-selected={props.selected ?? false}>{props.children}</div>
  ),
}));

vi.mock('@m3e/react/icon', () => ({
  M3eIcon: (props: { name?: string }) => <span data-icon={props.name} />,
}));

vi.mock('@m3e/react/icon-button', () => ({
  M3eIconButton: (props: { children?: ReactNode; onClick?: () => void }) => (
    <button type='button' onClick={props.onClick}>
      {props.children}
    </button>
  ),
}));

// 图标 side-effect 导入（注册 custom element）在 jsdom 无法执行，置空
vi.mock('@m3e/icons/outlined/library_music', () => ({}));
vi.mock('@m3e/icons/outlined/favorite', () => ({}));
vi.mock('@m3e/icons/outlined/star', () => ({}));
vi.mock('@m3e/icons/outlined/groups', () => ({}));
vi.mock('@m3e/icons/outlined/tag', () => ({}));
vi.mock('@m3e/icons/outlined/record_voice_over', () => ({}));
vi.mock('@m3e/icons/outlined/library_books', () => ({}));
vi.mock('@m3e/icons/outlined/admin_panel_settings', () => ({}));
vi.mock('@m3e/icons/outlined/settings', () => ({}));
vi.mock('@m3e/icons/outlined/person', () => ({}));
vi.mock('@m3e/icons/outlined/logout', () => ({}));

beforeEach(() => {
  // 复位真实 zustand store（模块单例）
  useUserStore.setState({ auth: false, name: '', group: '' });
});

afterEach(() => {
  cleanup();
});

describe('NavDrawer 钉底区布局（管理后台 + 设置）', () => {
  it('管理员：管理后台与设置同处钉底菜单，且管理后台在设置之上', () => {
    useUserStore.setState({
      auth: true,
      name: 'tester',
      group: 'administrator',
    });
    render(<NavDrawer />);

    const admin = screen.getByText('common.admin-console');
    const settings = screen.getByText('settings.title');

    // 两者都在钉底菜单（第二个 nav）里，而不是滚动导航区
    const pinned = admin.closest('nav');
    expect(pinned).not.toBeNull();
    expect(settings.closest('nav')).toBe(pinned);
    const series = screen.getByText('works.list-series');
    expect(series.closest('nav')).not.toBe(pinned);

    // 管理后台在设置之上
    expect(
      admin.compareDocumentPosition(settings)
        & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('非管理员：钉底菜单只有设置，不出现管理后台', () => {
    useUserStore.setState({ auth: true, name: 'tester', group: 'user' });
    render(<NavDrawer />);

    expect(screen.queryByText('common.admin-console')).toBeNull();
    expect(screen.getByText('settings.title').closest('nav')).not.toBeNull();
  });
});

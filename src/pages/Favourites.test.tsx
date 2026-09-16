// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useUserStore } from '../stores/userStore';
import Favourites from './Favourites';

// ---- mock 状态（vi.hoisted 保证先于被提升的 vi.mock 工厂求值可用）----
const h = vi.hoisted(() => ({
  api: {
    getFavourites: vi.fn(),
  },
}));

// 只 mock api 层：useFavourites hook 保持真实，钉住「未登录 enabled=false
// 不发请求」与「登录后正常请求」两条语义
vi.mock('../api/favourite', () => ({
  getFavourites: h.api.getFavourites,
}));

vi.mock('@tanstack/react-router', () => ({
  Link: (props: { to: string; children?: ReactNode }) => (
    <a href={props.to}>{props.children}</a>
  ),
  useNavigate: () => async () => {},
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('i18next', () => ({
  default: { t: (key: string) => key },
}));

// @m3e/web 组件在 jsdom 无法注册 custom elements，全部 mock 成轻量转发组件
vi.mock('@m3e/react/tabs', () => ({
  M3eTabs: (props: { children?: ReactNode }) => <div>{props.children}</div>,
  M3eTab: (props: { children?: ReactNode; selected?: boolean }) => (
    <div data-selected={props.selected ?? false}>{props.children}</div>
  ),
}));

vi.mock('@m3e/react/list', () => ({
  M3eActionList: (props: { children?: ReactNode }) => (
    <div>{props.children}</div>
  ),
  M3eListAction: (props: { children?: ReactNode }) => (
    <div>{props.children}</div>
  ),
}));

vi.mock('@m3e/react/icon', () => ({
  M3eIcon: (props: { name?: string }) => <span data-icon={props.name} />,
}));

vi.mock('@m3e/react/progress-indicator', () => ({
  M3eCircularProgressIndicator: () => <div role='progressbar' />,
}));

// 图标 side-effect 导入（注册 custom element）在 jsdom 无法执行，置空
vi.mock('@m3e/icons/outlined/album', () => ({}));
vi.mock('@m3e/icons/outlined/group', () => ({}));
vi.mock('@m3e/icons/outlined/mic', () => ({}));
vi.mock('@m3e/icons/outlined/library_books', () => ({}));
vi.mock('@m3e/icons/outlined/chevron_right', () => ({}));

function makeClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function renderPage(qc: QueryClient) {
  return render(
    <QueryClientProvider client={qc}>
      <Favourites tab='works' />
    </QueryClientProvider>,
  );
}

/** 吸收仍在飞的异步更新。TanStack Query v5 的 observer 通知经
 * setTimeout(0) 宏任务调度（notifyManager defaultScheduler），只排微任务
 * 的 act() 等不到重渲染，必须在 act 内再排空一个定时器 */
async function flushAsync() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

beforeEach(() => {
  h.api.getFavourites.mockReset();
  // 复位真实 zustand store（store 是模块单例，页面与 query hook 读同一 auth）
  useUserStore.setState({ auth: false, name: '', group: '' });
});

afterEach(() => {
  cleanup();
});

describe('Favourites 未登录早退（P1-14）', () => {
  it('未登录：渲染登录提示与前往登录链接，不出 spinner，api 零调用', async () => {
    renderPage(makeClient());
    await flushAsync();

    expect(screen.getByText('works.favourites.login-required')).toBeDefined();
    expect(
      screen.getByRole('link', { name: 'works.favourites.go-login' }),
    ).toBeDefined();
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(h.api.getFavourites).not.toHaveBeenCalled();
  });

  it('已登录（空收藏）：不出登录提示与 spinner，走正常空态流程', async () => {
    useUserStore.setState({ auth: true, name: 'tester', group: 'user' });
    h.api.getFavourites.mockResolvedValue({ favourites: [] });
    renderPage(makeClient());

    expect(await screen.findByText('works.favourites.empty')).toBeDefined();
    expect(screen.queryByText('works.favourites.login-required')).toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(h.api.getFavourites).toHaveBeenCalledWith('work');
  });

  it('已登录（加载中）：出 spinner 且无登录提示', async () => {
    useUserStore.setState({ auth: true, name: 'tester', group: 'user' });
    h.api.getFavourites.mockImplementation(() => new Promise(() => {}));
    renderPage(makeClient());

    expect(await screen.findByRole('progressbar')).toBeDefined();
    expect(screen.queryByText('works.favourites.login-required')).toBeNull();
  });
});

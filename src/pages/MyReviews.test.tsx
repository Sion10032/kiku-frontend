// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useUserStore } from '../stores/userStore';
import MyReviews from './MyReviews';

// ---- mock 状态（vi.hoisted 保证先于被提升的 vi.mock 工厂求值可用）----
const h = vi.hoisted(() => ({
  api: {
    getReviewsByUser: vi.fn(),
    getWork: vi.fn(),
  },
}));

// 只 mock api 层：useReviewsByUser / useWorkMap hook 保持真实，钉住
// 「未登录 enabled=false 不发请求」与「登录后正常请求」两条语义
vi.mock('../api/review', () => ({
  getReviewsByUser: h.api.getReviewsByUser,
}));

vi.mock('../api/works', () => ({
  getWork: h.api.getWork,
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
// （M3eListItem 供子组件 ReviewListItem 的模块图引用）
vi.mock('@m3e/react/list', () => ({
  M3eList: (props: { children?: ReactNode }) => <ul>{props.children}</ul>,
  M3eListItem: (props: { children?: ReactNode }) => <li>{props.children}</li>,
}));

vi.mock('@m3e/react/icon', () => ({
  M3eIcon: (props: { name?: string }) => <span data-icon={props.name} />,
}));

vi.mock('@m3e/react/progress-indicator', () => ({
  M3eCircularProgressIndicator: () => <div role='progressbar' />,
}));

// 图标 side-effect 导入（注册 custom element）在 jsdom 无法执行，置空
vi.mock('@m3e/icons/outlined/star', () => ({}));

function makeClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function renderPage(qc: QueryClient) {
  return render(
    <QueryClientProvider client={qc}>
      <MyReviews />
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
  h.api.getReviewsByUser.mockReset();
  h.api.getWork.mockReset();
  // 复位真实 zustand store（store 是模块单例，页面与 query hook 读同一 auth）
  useUserStore.setState({ auth: false, name: '', group: '' });
});

afterEach(() => {
  cleanup();
});

describe('MyReviews 未登录早退（P1-14）', () => {
  it('未登录：渲染登录提示与前往登录链接，不出 spinner，api 零调用', async () => {
    renderPage(makeClient());
    await flushAsync();

    expect(screen.getByText('works.my-reviews.login-required')).toBeDefined();
    expect(
      screen.getByRole('link', { name: 'works.my-reviews.go-login' }),
    ).toBeDefined();
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(h.api.getReviewsByUser).not.toHaveBeenCalled();
  });

  it('已登录（无评价）：不出登录提示与 spinner，走正常空态流程', async () => {
    useUserStore.setState({ auth: true, name: 'tester', group: 'user' });
    h.api.getReviewsByUser.mockResolvedValue([]);
    renderPage(makeClient());

    expect(await screen.findByText('works.my-reviews.empty')).toBeDefined();
    expect(screen.queryByText('works.my-reviews.login-required')).toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(h.api.getReviewsByUser).toHaveBeenCalledWith('tester');
  });

  it('已登录（加载中）：出 spinner 且无登录提示', async () => {
    useUserStore.setState({ auth: true, name: 'tester', group: 'user' });
    h.api.getReviewsByUser.mockImplementation(() => new Promise(() => {}));
    renderPage(makeClient());

    expect(await screen.findByRole('progressbar')).toBeDefined();
    expect(screen.queryByText('works.my-reviews.login-required')).toBeNull();
  });
});

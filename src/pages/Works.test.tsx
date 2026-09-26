// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSettingsStore } from '../stores/settingsStore';
import { useUserStore } from '../stores/userStore';
import Works from './Works';

// ---- mock 状态（vi.hoisted 保证先于被提升的 vi.mock 工厂求值可用）----
const h = vi.hoisted(() => ({
  search: {} as Record<string, unknown>,
  navigate: vi.fn(),
  paged: {} as Record<string, unknown>,
  infinite: {} as Record<string, unknown>,
}));

// 路由 search/navigate 由测试直接驱动：只关心页面在越界时是否归 1
vi.mock('../routes/works', () => ({
  worksRoute: {
    useSearch: () => h.search,
    useNavigate: () => h.navigate,
  },
}));

// 只 mock query hook：分页回执由测试给定（真实 hook 的 keepPreviousData
// 时序由 useResetOutOfRangePage 的单测覆盖）
vi.mock('../queries/useWorksQuery', () => ({
  useWorksPage: () => h.paged,
  useWorksInfinite: () => h.infinite,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('i18next', () => ({ default: { t: (key: string) => key } }));

vi.mock('@tanstack/react-router', () => ({
  Link: (props: { children?: ReactNode }) => <a>{props.children}</a>,
}));

// @m3e/web 组件在 jsdom 无法注册 custom elements，全部 mock 成轻量转发组件
vi.mock('@m3e/react/form-field', () => ({
  M3eFormField: (props: { children?: ReactNode }) => (
    <div>{props.children}</div>
  ),
}));
vi.mock('@m3e/react/select', () => ({
  M3eSelect: (props: { children?: ReactNode }) => <div>{props.children}</div>,
}));
vi.mock('@m3e/react/option', () => ({
  M3eOption: (props: { children?: ReactNode }) => <div>{props.children}</div>,
}));
vi.mock('@m3e/react/icon-button', () => ({
  M3eIconButton: (props: { children?: ReactNode }) => (
    <button>{props.children}</button>
  ),
}));
vi.mock('@m3e/react/icon', () => ({ M3eIcon: () => <span /> }));
vi.mock('@m3e/react/progress-indicator', () => ({
  M3eCircularProgressIndicator: () => <div role='progressbar' />,
}));
vi.mock('@m3e/react/list', () => ({
  M3eList: (props: { children?: ReactNode }) => <div>{props.children}</div>,
}));
vi.mock('@m3e/icons/outlined/apps', () => ({}));
vi.mock('@m3e/icons/outlined/view_list', () => ({}));

vi.mock('../components/common/Paginator', () => ({ default: () => <div /> }));
vi.mock('../components/works/WorkCard', () => ({ default: () => <div /> }));
vi.mock('../components/works/WorkListItem', () => ({ default: () => <div /> }));
vi.mock('../components/works/HistoryStrip', () => ({ default: () => <div /> }));

function pagedData(page: number, pageSize: number, totalCount: number) {
  return {
    data: {
      works: [],
      pagination: { currentPage: page, pageSize, totalCount },
    },
    isLoading: false,
    isFetching: false,
  };
}

/** 吸收仍在飞的异步更新（Query observer 经 macro task 通知，见 Favourites.test.tsx） */
async function flushAsync() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

beforeEach(() => {
  h.search = { page: 5 };
  h.navigate.mockReset();
  h.paged = pagedData(5, 100, 250);
  h.infinite = {
    data: undefined,
    isLoading: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
  };
  useSettingsStore.setState({
    worksPageSize: 100,
    worksPaginationMode: 'paginate',
  });
  useUserStore.setState({ auth: false, name: '', group: '' });
});

afterEach(() => {
  cleanup();
});

describe('Works 越界页码归位', () => {
  it('挂载时残留越界页码（档位 100、page=5、共 250 条）→ URL 页码归 1', async () => {
    render(<Works />);
    await flushAsync();

    expect(h.navigate).toHaveBeenCalledTimes(1);
    const opts = h.navigate.mock.calls[0][0] as {
      search: (prev: Record<string, unknown>) => Record<string, unknown>;
    };
    expect(opts.search({ page: 5 })).toEqual({ page: undefined });
  });

  it('首屏页码合法 → 不导航', async () => {
    h.search = { page: 2 };
    h.paged = pagedData(2, 100, 1500);

    render(<Works />);
    await flushAsync();

    expect(h.navigate).not.toHaveBeenCalled();
  });

  it('挂载期间切档（20 → 100，page=5）→ URL 页码归 1', async () => {
    h.search = { page: 5 };
    h.paged = pagedData(5, 20, 1500);
    useSettingsStore.setState({ worksPageSize: 20 });

    render(<Works />);
    await flushAsync();
    expect(h.navigate).not.toHaveBeenCalled();

    act(() => {
      useSettingsStore.setState({ worksPageSize: 100 });
    });
    await flushAsync();

    expect(h.navigate).toHaveBeenCalledTimes(1);
    const opts = h.navigate.mock.calls[0][0] as {
      search: (prev: Record<string, unknown>) => Record<string, unknown>;
    };
    expect(opts.search({ page: 5 })).toEqual({ page: undefined });
  });
});

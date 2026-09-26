// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSettingsStore } from '../stores/settingsStore';
import { useUserStore } from '../stores/userStore';
import History from './History';

const h = vi.hoisted(() => ({
  search: {} as Record<string, unknown>,
  navigate: vi.fn(),
  result: {} as Record<string, unknown>,
}));

vi.mock('../routes/history', () => ({
  historyRoute: {
    useSearch: () => h.search,
    useNavigate: () => h.navigate,
  },
}));

vi.mock('../queries/useHistoryQuery', () => ({
  useHistoryPage: () => h.result,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('i18next', () => ({ default: { t: (key: string) => key } }));

vi.mock('@tanstack/react-router', () => ({
  Link: (props: { children?: ReactNode }) => <a>{props.children}</a>,
}));

vi.mock('@m3e/react/progress-indicator', () => ({
  M3eCircularProgressIndicator: () => <div role='progressbar' />,
}));

vi.mock('../components/common/Paginator', () => ({ default: () => <div /> }));
vi.mock('../components/works/WorkCard', () => ({ default: () => <div /> }));

function historyData(page: number, pageSize: number, totalCount: number) {
  return {
    data: {
      works: [],
      pagination: { currentPage: page, pageSize, totalCount },
    },
    isLoading: false,
  };
}

async function flushAsync() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

beforeEach(() => {
  h.search = { page: 5 };
  h.navigate.mockReset();
  h.result = historyData(5, 100, 250);
  useSettingsStore.setState({ worksPageSize: 100 });
  useUserStore.setState({ auth: true, name: 'tester', group: 'user' });
});

afterEach(() => {
  cleanup();
});

describe('History 越界页码归位', () => {
  it('挂载时残留越界页码（档位 100、page=5、共 250 条）→ URL 页码归 1', async () => {
    render(<History />);
    await flushAsync();

    expect(h.navigate).toHaveBeenCalledTimes(1);
    expect(h.navigate).toHaveBeenCalledWith({ search: { page: undefined } });
  });

  it('首屏页码合法 → 不导航', async () => {
    h.search = { page: 2 };
    h.result = historyData(2, 100, 1500);

    render(<History />);
    await flushAsync();

    expect(h.navigate).not.toHaveBeenCalled();
  });

  it('挂载期间切档（20 → 100，page=5）→ URL 页码归 1', async () => {
    h.search = { page: 5 };
    h.result = historyData(5, 20, 1500);
    useSettingsStore.setState({ worksPageSize: 20 });

    render(<History />);
    await flushAsync();
    expect(h.navigate).not.toHaveBeenCalled();

    act(() => {
      useSettingsStore.setState({ worksPageSize: 100 });
    });
    await flushAsync();

    expect(h.navigate).toHaveBeenCalledTimes(1);
    expect(h.navigate).toHaveBeenCalledWith({ search: { page: undefined } });
  });
});

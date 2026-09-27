// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AudioManage from './AudioManage';

// ---- mock 状态（vi.hoisted 保证先于被提升的 vi.mock 工厂求值可用）----
const h = vi.hoisted(() => ({
  scanner: {
    state: 'idle',
    tasks: [],
    failedTasks: [],
    mainLogs: [],
    completedCount: 0,
    resultMessage: null,
    start: vi.fn(),
    kill: vi.fn(),
  },
  analysis: {
    state: 'idle',
    snapshot: null,
    resultMessage: null,
    ffmpegMissing: false,
    start: vi.fn(),
    kill: vi.fn(),
  },
  works: [] as Array<{
    id: string;
    title: string;
    circle: { name: string };
    release: string | null;
    overriddenFields?: string[];
  }>,
}));

vi.mock('../../components/dashboard/useScannerEvents', () => ({
  useScannerEvents: () => h.scanner,
}));
vi.mock('../../components/dashboard/useAnalysisEvents', () => ({
  useAnalysisEvents: () => h.analysis,
}));

vi.mock('../../api/works', () => ({
  getWorksList: vi.fn(async () => ({
    works: h.works,
    pagination: { currentPage: 1, pageSize: 50, totalCount: h.works.length },
  })),
}));

// t 返回「key:count」便于断言插值分支；无插值返回 key 本身
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, vals?: { count?: number }) =>
      vals?.count !== undefined ? `${key}:${vals.count}` : key,
  }),
}));

// @m3e/web 组件在 jsdom 无法注册 custom elements，mock 成轻量转发组件
vi.mock('@m3e/react/button', () => ({
  M3eButton: (props: {
    children?: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button onClick={props.onClick} disabled={props.disabled}>
      {props.children}
    </button>
  ),
}));
vi.mock('@m3e/react/checkbox', () => ({
  M3eCheckbox: (props: { checked?: boolean; onChange?: () => void }) => (
    <input type='checkbox' checked={props.checked} onChange={props.onChange} />
  ),
}));
vi.mock('@m3e/react/form-field', () => ({
  M3eFormField: (props: { children?: ReactNode }) => (
    <div>{props.children}</div>
  ),
}));
vi.mock('@m3e/react/icon', () => ({ M3eIcon: () => <span /> }));
vi.mock('@m3e/react/divider', () => ({ M3eDivider: () => <hr /> }));
vi.mock('@m3e/icons/outlined/play_arrow', () => ({}));
vi.mock('@m3e/icons/outlined/sync', () => ({}));
vi.mock('@m3e/icons/outlined/stop', () => ({}));

vi.mock('../../components/dashboard/DashboardPage', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('../../components/dashboard/ScannerPanel', () => ({
  default: () => <div />,
}));
vi.mock('../../components/dashboard/AnalysisPanel', () => ({
  default: () => <div />,
}));
vi.mock('../../components/common/Paginator', () => ({
  default: () => <div />,
}));
vi.mock('../../components/work/MetadataEditDialog', () => ({
  default: () => <div />,
}));
vi.mock('../../components/work/TitleSanitizeDialog', () => ({
  default: () => <div />,
}));

// ConfirmDialog mock 成透出 props 的桩：断言 open/message/onConfirm 接线
vi.mock('../../components/ConfirmDialog', () => ({
  default: (props: {
    open: boolean;
    message: string;
    onConfirm: () => void;
  }) => (
    <div data-testid='confirm' data-open={String(props.open)}>
      <span data-testid='confirm-message'>{props.message}</span>
      <button data-testid='confirm-ok' onClick={props.onConfirm}>
        ok
      </button>
    </div>
  ),
}));

/** 吸收仍在飞的异步更新（见 Works.test.tsx flushAsync） */
async function flushAsync() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AudioManage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  h.scanner.start.mockReset();
  h.scanner.kill.mockReset();
  h.analysis.start.mockReset();
  h.analysis.kill.mockReset();
  h.works = [
    {
      id: 'RJ00000001',
      title: '作品1',
      circle: { name: '社团1' },
      release: null,
    },
    {
      id: 'RJ00000002',
      title: '作品2',
      circle: { name: '社团2' },
      release: null,
    },
  ];
});

afterEach(() => {
  cleanup();
});

/** 点击文本为 key 的按钮（react-i18next mock 后按钮文本即 key） */
function clickButton(container: HTMLElement, label: string) {
  const btn = [...container.querySelectorAll('button')].find(
    (b) => b.textContent === label,
  );
  if (!btn) throw new Error(`button not found: ${label}`);
  fireEvent.click(btn);
}

/** 勾选指定 RJ 行的 checkbox（waitFor 轮询：query 回执时机在全量跑下不稳定） */
async function checkRow(container: HTMLElement, rj: string) {
  await waitFor(() => {
    const row = [...container.querySelectorAll('tr')].find((tr) =>
      tr.textContent?.includes(rj),
    );
    const box = row?.querySelector('input[type="checkbox"]');
    if (!box) throw new Error(`checkbox not found for ${rj}`);
    fireEvent.click(box);
  });
}

describe('AudioManage 执行前确认弹窗', () => {
  it('无选中：点「刷新音声库信息」先弹全局文案弹窗，确认后才 start(update, 无 workIds)', async () => {
    const { container, getByTestId } = renderPage();
    await flushAsync();

    clickButton(container, 'dashboard.scan.start-update');
    expect(h.scanner.start).not.toHaveBeenCalled();

    const dialog = getByTestId('confirm');
    expect(dialog.getAttribute('data-open')).toBe('true');
    expect(getByTestId('confirm-message').textContent).toBe(
      'dashboard.audio.update-confirm-all',
    );

    await act(async () => {
      fireEvent.click(getByTestId('confirm-ok'));
    });
    expect(h.scanner.start).toHaveBeenCalledTimes(1);
    expect(h.scanner.start).toHaveBeenCalledWith('update', undefined);
  });

  it('有选中：点「刷新音声库信息」弹选中文案，确认后 start(update, 选中 IDs)', async () => {
    const { container, getByTestId } = renderPage();
    await flushAsync();

    await checkRow(container, 'RJ00000001');
    await checkRow(container, 'RJ00000002');
    clickButton(container, 'dashboard.scan.start-update');

    expect(getByTestId('confirm-message').textContent).toBe(
      'dashboard.audio.update-confirm-selected:2',
    );

    await act(async () => {
      fireEvent.click(getByTestId('confirm-ok'));
    });
    expect(h.scanner.start).toHaveBeenCalledWith('update', [
      'RJ00000001',
      'RJ00000002',
    ]);
  });

  it('无选中：点「开始响度分析」弹全局文案，确认后 start(无 workIds)', async () => {
    const { container, getByTestId } = renderPage();
    await flushAsync();

    clickButton(container, 'dashboard.analysis.start');
    expect(h.analysis.start).not.toHaveBeenCalled();
    expect(getByTestId('confirm-message').textContent).toBe(
      'dashboard.audio.analysis-confirm-all',
    );

    await act(async () => {
      fireEvent.click(getByTestId('confirm-ok'));
    });
    expect(h.analysis.start).toHaveBeenCalledTimes(1);
    expect(h.analysis.start).toHaveBeenCalledWith(undefined);
  });

  it('有选中：点「开始响度分析」弹选中文案，确认后 start(选中 IDs)', async () => {
    const { container, getByTestId } = renderPage();
    await flushAsync();

    await checkRow(container, 'RJ00000001');
    clickButton(container, 'dashboard.analysis.start');

    expect(getByTestId('confirm-message').textContent).toBe(
      'dashboard.audio.analysis-confirm-selected:1',
    );

    await act(async () => {
      fireEvent.click(getByTestId('confirm-ok'));
    });
    expect(h.analysis.start).toHaveBeenCalledWith(['RJ00000001']);
  });
});

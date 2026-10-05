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
  scannerApi: {
    startScan: vi.fn(),
    killScan: vi.fn(),
  },
  analysisApi: {
    startAnalysis: vi.fn(),
    killAnalysis: vi.fn(),
  },
  batchDelete: {
    mutate: vi.fn(),
  },
  works: [] as Array<{
    id: string;
    title: string;
    circle: { name: string };
    release: string | null;
    overriddenFields?: string[];
  }>,
}));

vi.mock('../../api/tasks', () => ({
  startScan: h.scannerApi.startScan,
  killScan: h.scannerApi.killScan,
  startAnalysis: h.analysisApi.startAnalysis,
  killAnalysis: h.analysisApi.killAnalysis,
}));

// 批量软删除 mutation：只用到 mutate，mock 记录调用供断言
vi.mock('../../queries/useWorkAdminMutation', () => ({
  useBatchSoftDeleteWorksMutation: () => h.batchDelete,
}));

vi.mock('../../api/works', () => ({
  getWorksList: vi.fn(async () => ({
    works: h.works,
    pagination: { currentPage: 1, pageSize: 50, totalCount: h.works.length },
  })),
  softDeleteWorks: vi.fn(async () => ({ success: true, deleted: 0 })),
}));

// t 返回「key:count」便于断言插值分支；无插值返回 key 本身
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, vals?: { count?: number }) =>
      vals?.count !== undefined ? `${key}:${vals.count}` : key,
  }),
}));

// M3eSnackbar Web Component 在 jsdom 无法注册（import 时炸）
vi.mock('@m3e/react/snackbar', () => ({
  M3eSnackbar: { open: vi.fn() },
}));

// 任务中心面板与弹窗：既有测试钉住页面按钮行为，任务展示由 B3 组件测试覆盖
vi.mock('../../components/tasks/TaskPanel', () => ({ default: () => <div /> }));
vi.mock('../../components/tasks/TaskCenterDialog', () => ({
  default: () => <div />,
}));
vi.mock('../../hooks/useTasks', () => ({
  useBatches: () => [],
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
vi.mock('@m3e/react/icon-button', () => ({
  M3eIconButton: (props: {
    children?: ReactNode;
    onClick?: (e: { currentTarget: unknown }) => void;
    'aria-label'?: string;
  }) => (
    <button aria-label={props['aria-label']} onClick={props.onClick}>
      {props.children}
    </button>
  ),
}));
vi.mock('@m3e/react/menu', () => ({
  // jsdom 无法 show()：mock 成常显容器，测试直接点菜单项
  M3eMenu: (props: { children?: ReactNode }) => <div>{props.children}</div>,
  M3eMenuItem: (props: { children?: ReactNode; onClick?: () => void }) => (
    <button onClick={props.onClick}>{props.children}</button>
  ),
}));
vi.mock('@m3e/icons/outlined/play_arrow', () => ({}));
vi.mock('@m3e/icons/outlined/sync', () => ({}));
vi.mock('@m3e/icons/outlined/stop', () => ({}));
vi.mock('@m3e/icons/outlined/cleaning_services', () => ({}));
vi.mock('@m3e/icons/outlined/filter_list', () => ({}));
vi.mock('@m3e/icons/outlined/check', () => ({}));
vi.mock('@m3e/icons/outlined/edit_note', () => ({}));
vi.mock('@m3e/icons/outlined/help_center', () => ({}));
vi.mock('@m3e/icons/outlined/explicit', () => ({}));
vi.mock('@m3e/icons/outlined/title', () => ({}));
vi.mock('@m3e/icons/outlined/warning', () => ({}));
vi.mock('@m3e/icons/outlined/family_restroom', () => ({}));
vi.mock('@m3e/icons/outlined/close', () => ({}));
vi.mock('@m3e/icons/outlined/delete', () => ({}));

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
  h.scannerApi.startScan.mockReset();
  h.scannerApi.killScan.mockReset();
  h.analysisApi.startAnalysis.mockReset();
  h.analysisApi.killAnalysis.mockReset();
  h.batchDelete.mutate.mockReset();
  // 模拟真实 mutation：mutate 成功后触发组件层 onSuccess（清空选中）
  h.batchDelete.mutate.mockImplementation(
    (_ids: string[], opts?: { onSuccess?: () => void }) => opts?.onSuccess?.(),
  );
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
    expect(h.scannerApi.startScan).not.toHaveBeenCalled();

    const dialog = getByTestId('confirm');
    expect(dialog.getAttribute('data-open')).toBe('true');
    expect(getByTestId('confirm-message').textContent).toBe(
      'dashboard.audio.update-confirm-all',
    );

    await act(async () => {
      fireEvent.click(getByTestId('confirm-ok'));
    });
    expect(h.scannerApi.startScan).toHaveBeenCalledTimes(1);
    expect(h.scannerApi.startScan).toHaveBeenCalledWith('update', undefined);
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
    expect(h.scannerApi.startScan).toHaveBeenCalledWith('update', [
      'RJ00000001',
      'RJ00000002',
    ]);
  });

  it('无选中：点「开始响度分析」弹全局文案，确认后 start(无 workIds)', async () => {
    const { container, getByTestId } = renderPage();
    await flushAsync();

    clickButton(container, 'dashboard.analysis.start');
    expect(h.analysisApi.startAnalysis).not.toHaveBeenCalled();
    expect(getByTestId('confirm-message').textContent).toBe(
      'dashboard.audio.analysis-confirm-all',
    );

    await act(async () => {
      fireEvent.click(getByTestId('confirm-ok'));
    });
    expect(h.analysisApi.startAnalysis).toHaveBeenCalledTimes(1);
    expect(h.analysisApi.startAnalysis).toHaveBeenCalledWith(undefined, 'low');
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
    expect(h.analysisApi.startAnalysis).toHaveBeenCalledWith(
      ['RJ00000001'],
      'low',
    );
  });
});

/** 快捷筛选菜单（mock 后常显）：按 i18n key 点菜单项 */
function clickQuickFilter(container: HTMLElement, key: string) {
  const item = [...container.querySelectorAll('button')].find(
    (b) => b.textContent === key,
  );
  if (!item) throw new Error(`quick filter not found: ${key}`);
  fireEvent.click(item);
}

function searchInput(container: HTMLElement) {
  const input = container.querySelector<HTMLInputElement>(
    '#audio-admin-search',
  );
  if (!input) throw new Error('search input not found');
  return input;
}

describe('AudioManage 快捷筛选下拉', () => {
  /** 点菜单项后先断言搜索框立即更新，再断言请求同步提交（无需回车） */
  it('点击「已修改的信息」追加 overridden:any 到搜索框并触发请求', async () => {
    const { container } = renderPage();
    await act(async () => {});
    expect(searchInput(container).value).toBe('');

    fireEvent.click(
      container.querySelector<HTMLButtonElement>(
        'button[aria-label="dashboard.audio.quick-filter"]',
      )
        ?? (() => {
          throw new Error('quick filter button not found');
        })(),
    );
    clickQuickFilter(container, 'dashboard.audio.quick-filter-overridden');

    expect(searchInput(container).value).toBe('overridden:any');
    await act(async () => {});
    const { getWorksList } = await import('../../api/works');
    expect(getWorksList).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: 'overridden:any' }),
    );
  });

  it('再点同一菜单项：从搜索框移除片段，请求 q 回到 undefined', async () => {
    const { container } = renderPage();
    await act(async () => {});

    clickQuickFilter(container, 'dashboard.audio.quick-filter-overridden');
    await act(async () => {});

    clickQuickFilter(container, 'dashboard.audio.quick-filter-overridden');
    expect(searchInput(container).value).toBe('');
    await act(async () => {});
    const { getWorksList } = await import('../../api/works');
    expect(getWorksList).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: undefined }),
    );
  });

  it('与手输词共存：先输「催眠」再点「unknown 社团」拼接为「催眠 circle:unknown」', async () => {
    const { container } = renderPage();
    await act(async () => {});

    fireEvent.change(searchInput(container), {
      target: { value: '催眠' },
    });
    clickQuickFilter(container, 'dashboard.audio.quick-filter-unknown-circle');

    expect(searchInput(container).value).toBe('催眠 circle:unknown');
    await act(async () => {});
    const { getWorksList } = await import('../../api/works');
    expect(getWorksList).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: '催眠 circle:unknown' }),
    );
  });

  it('分级互斥：R18 选中后点 R15，替换为 age:r15 而非累积', async () => {
    const { container } = renderPage();
    await act(async () => {});

    clickQuickFilter(container, 'dashboard.audio.quick-filter-r18');
    await act(async () => {});

    clickQuickFilter(container, 'dashboard.audio.quick-filter-r15');
    expect(searchInput(container).value).toBe('age:r15');
    await act(async () => {});
    const { getWorksList } = await import('../../api/works');
    expect(getWorksList).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: 'age:r15' }),
    );
  });

  it('分级与其它筛选共存：R15→R18 替换，再点 R18 只移除分级', async () => {
    const { container } = renderPage();
    await act(async () => {});

    fireEvent.change(searchInput(container), {
      target: { value: '催眠' },
    });
    clickQuickFilter(container, 'dashboard.audio.quick-filter-overridden');
    await act(async () => {});
    clickQuickFilter(container, 'dashboard.audio.quick-filter-r15');
    expect(searchInput(container).value).toBe('催眠 overridden:any age:r15');
    await act(async () => {});

    clickQuickFilter(container, 'dashboard.audio.quick-filter-r18');
    expect(searchInput(container).value).toBe('催眠 overridden:any age:r18');
    await act(async () => {});

    clickQuickFilter(container, 'dashboard.audio.quick-filter-r18');
    expect(searchInput(container).value).toBe('催眠 overridden:any');
    await act(async () => {});
    const { getWorksList } = await import('../../api/works');
    expect(getWorksList).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: '催眠 overridden:any' }),
    );
  });

  it('清空按钮：q 空时不存在；输入词后点击清空并回到全量请求', async () => {
    const { container } = renderPage();
    await act(async () => {});
    expect(
      container.querySelector(
        'button[aria-label="dashboard.audio.clear-search"]',
      ),
    ).toBeNull();

    fireEvent.change(searchInput(container), {
      target: { value: '催眠 overridden:any' },
    });
    await act(async () => {});

    fireEvent.click(
      container.querySelector<HTMLButtonElement>(
        'button[aria-label="dashboard.audio.clear-search"]',
      )
        ?? (() => {
          throw new Error('clear button not found');
        })(),
    );
    expect(searchInput(container).value).toBe('');
    await act(async () => {});
    const { getWorksList } = await import('../../api/works');
    expect(getWorksList).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: undefined }),
    );
  });
});

describe('AudioManage 搜索提交（回车触发）', () => {
  it('输入词不回车不触发请求；回车后才提交', async () => {
    const { container } = renderPage();
    await flushAsync();
    const { getWorksList } = await import('../../api/works');
    const callsBefore = vi.mocked(getWorksList).mock.calls.length;

    const input = searchInput(container);
    fireEvent.change(input, { target: { value: '催眠' } });
    await flushAsync();
    expect(input.value).toBe('催眠');
    expect(vi.mocked(getWorksList).mock.calls.length).toBe(callsBefore);

    fireEvent.keyDown(input, { key: 'Enter' });
    await flushAsync();
    expect(vi.mocked(getWorksList).mock.calls.length).toBe(callsBefore + 1);
    expect(getWorksList).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: '催眠' }),
    );
  });

  it('IME 组合中的回车（选词确认）不触发提交', async () => {
    const { container } = renderPage();
    await flushAsync();
    const { getWorksList } = await import('../../api/works');
    const callsBefore = vi.mocked(getWorksList).mock.calls.length;

    const input = searchInput(container);
    fireEvent.change(input, { target: { value: '催眠' } });
    fireEvent(
      input,
      new KeyboardEvent('keydown', { key: 'Enter', isComposing: true }),
    );
    await flushAsync();
    expect(vi.mocked(getWorksList).mock.calls.length).toBe(callsBefore);
  });
});

describe('AudioManage 批量软删除', () => {
  /** 取「删除选中」按钮（文本 = i18n key） */
  function deleteButton(container: HTMLElement) {
    const btn = [...container.querySelectorAll('button')].find(
      (b) => b.textContent === 'dashboard.audio.delete-selected',
    );
    if (!btn) throw new Error('delete button not found');
    return btn;
  }

  it('未选中：删除按钮禁用', async () => {
    const { container } = renderPage();
    await flushAsync();
    expect(deleteButton(container).disabled).toBe(true);
  });

  it('选中 → 点删除 → 确认：以选中 ids 调用批量删除并清空选中', async () => {
    const { container, getByTestId } = renderPage();
    await flushAsync();

    await checkRow(container, 'RJ00000001');
    await checkRow(container, 'RJ00000002');
    expect(deleteButton(container).disabled).toBe(false);

    fireEvent.click(deleteButton(container));
    expect(getByTestId('confirm-message').textContent).toBe(
      'dashboard.audio.delete-confirm-selected:2',
    );

    await act(async () => {
      fireEvent.click(getByTestId('confirm-ok'));
    });
    expect(h.batchDelete.mutate).toHaveBeenCalledTimes(1);
    expect(h.batchDelete.mutate).toHaveBeenCalledWith(
      ['RJ00000001', 'RJ00000002'],
      expect.anything(),
    );
    // onSuccess 清空选中：已选计数不再显示
    expect(container.textContent).not.toContain(
      'dashboard.audio.selected-count',
    );
  });
});

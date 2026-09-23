// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode, Ref } from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { metadataOverrideKey } from '../../queries/useMetadataOverrideQuery';
import type { MetadataOverrideDetail } from '../../types';
import MetadataEditDialog from './MetadataEditDialog';

// ---- mock 状态（vi.hoisted 保证先于被提升的 vi.mock 工厂求值可用）----
const h = vi.hoisted(() => ({
  api: {
    getMetadataOverride: vi.fn(),
    saveMetadataOverride: vi.fn(),
  },
  snackbarOpen: vi.fn(),
  /** ChipSetSync mock 的 appendChild 记录（chip 文本），用于断言重建时机 */
  appendedChips: [] as string[],
  /** ChipSetSync mock 捕获的 change 监听器（按 aria-label 分实例），
   *  供测试命令式派发 chip 增删（jsdom 无 custom elements 事件通路） */
  chipChangeListeners: {} as Record<string, EventListener>,
}));

vi.mock('../../api/metadata', () => ({
  getMetadataOverride: h.api.getMetadataOverride,
  saveMetadataOverride: h.api.saveMetadataOverride,
}));

vi.mock('../../api/works', () => ({
  getTags: () => Promise.resolve([]),
  getVas: () => Promise.resolve([]),
  getCircles: () => Promise.resolve([]),
  getSeries: () => Promise.resolve([]),
}));

vi.mock('@m3e/react/snackbar', () => ({
  M3eSnackbar: { open: h.snackbarOpen },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('i18next', () => ({
  default: { t: (key: string) => key },
}));

// @m3e/web 组件在 jsdom 无法注册 custom elements，全部 mock 成轻量转发组件：
// 只保留被测逻辑依赖的行为（children 渲染、onClick 透传、ref 可挂方法）。
vi.mock('@m3e/react/dialog', () => ({
  M3eDialog: (props: { open?: boolean; children?: ReactNode }) =>
    props.open ? <div>{props.children}</div> : null,
}));

vi.mock('@m3e/react/form-field', () => ({
  M3eFormField: (props: { children?: ReactNode }) => (
    <div>{props.children}</div>
  ),
}));

vi.mock('@m3e/react/button', () => ({
  M3eButton: (props: {
    children?: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button type='button' disabled={props.disabled} onClick={props.onClick}>
      {props.children}
    </button>
  ),
}));

vi.mock('@m3e/react/option', () => ({
  M3eOption: (props: { children?: ReactNode }) => <div>{props.children}</div>,
}));

vi.mock('@m3e/react/segmented-button', () => ({
  M3eSegmentedButton: (props: { children?: ReactNode }) => (
    <div role='group'>{props.children}</div>
  ),
  M3eButtonSegment: (props: { children?: ReactNode; checked?: boolean }) => (
    <button type='button' aria-checked={props.checked}>
      {props.children}
    </button>
  ),
}));

// autocomplete：ChipSetSync / SingleAutocomplete 会往 ref 上挂事件监听，
// 必须转发到真实 DOM 节点。
vi.mock('@m3e/react/autocomplete', async () => {
  const { forwardRef } = await import('react');
  return {
    M3eAutocomplete: forwardRef(function AutocompleteMock(
      props: { children?: ReactNode; htmlFor?: string },
      ref: Ref<HTMLDivElement>,
    ) {
      return (
        <div ref={ref} data-autocomplete={props.htmlFor}>
          {props.children}
        </div>
      );
    }),
  };
});

// chip-set：ref 必须提供重建 effect 用到的 updateComplete / chips /
// appendChild，以及 change 监听 effect 用到的 addEventListener /
// removeEventListener（jsdom 无 custom elements，只能以命令式 handle 模拟）；
// appendChild 顺带记录 chip 文本供「重建时机」断言，change 监听器按
// aria-label 捕获，供测试派发 chip 增删。
vi.mock('@m3e/react/chips', async () => {
  const { forwardRef, useImperativeHandle } = await import('react');
  return {
    M3eInputChipSet: forwardRef(function ChipSetMock(
      props: { 'aria-label'?: string },
      ref: Ref<{
        updateComplete: Promise<unknown>;
        chips: unknown[];
        appendChild: (chip: Element) => void;
        addEventListener: (type: string, listener: EventListener) => void;
        removeEventListener: (type: string, listener: EventListener) => void;
      }>,
    ) {
      useImperativeHandle(ref, () => ({
        updateComplete: Promise.resolve(),
        chips: [],
        appendChild: (chip: Element) => {
          h.appendedChips.push(chip.textContent ?? '');
        },
        addEventListener: (type: string, listener: EventListener) => {
          if (type === 'change') {
            h.chipChangeListeners[props['aria-label'] ?? ''] = listener;
          }
        },
        removeEventListener: (type: string, listener: EventListener) => {
          const key = props['aria-label'] ?? '';
          if (type === 'change' && h.chipChangeListeners[key] === listener) {
            delete h.chipChangeListeners[key];
          }
        },
      }));
      return <div data-testid='chip-set' />;
    }),
  };
});

// ---- 测试数据 ----

let current: MetadataOverrideDetail;

function makeDetail(
  overrides?: Partial<MetadataOverrideDetail>,
): MetadataOverrideDetail {
  return {
    original: {
      title: '原始标题',
      circle: null,
      series: null,
      ageRating: 'all',
      tags: [{ id: 12, name: '原始标签' }],
      vas: [],
    },
    effective: {
      title: '覆盖标题',
      circle: { id: 'RG10001', name: '社团A' },
      series: null,
      ageRating: 'all',
      tags: [{ id: 11, name: '覆盖标签' }],
      vas: [],
    },
    override: {
      title: '覆盖标题',
      circle: { id: 'RG10001', name: '社团A' },
      series: null,
      ageRating: null,
      tagsCleared: false,
      vasCleared: false,
      tagActions: [],
      vaActions: [],
      updatedBy: 'admin',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    overriddenFields: ['title', 'circle', 'tags'],
    ...overrides,
  };
}

/** 模拟 refetch 返回：同内容但「新对象身份」。深改 updatedAt，防止
 * TanStack structural sharing 把深相等的新数据折叠回旧引用。 */
function refetched(detail: MetadataOverrideDetail): MetadataOverrideDetail {
  return {
    ...detail,
    override: { ...detail.override, updatedAt: '2026-09-12T00:00:00Z' },
  };
}

function makeClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function renderDialog(qc: QueryClient, open = true) {
  return render(
    <QueryClientProvider client={qc}>
      <MetadataEditDialog workId='w1' open={open} onClose={() => {}} />
    </QueryClientProvider>,
  );
}

function inputByLabel(label: string): HTMLInputElement {
  return screen.getByLabelText(label) as HTMLInputElement;
}

/** 恢复按钮的 DOM 顺序 = FieldRow 顺序（title/circle/series/ageRating/tags/vas），
 *  仅被覆盖字段渲染按钮；用函数取实时列表，避免快照失效。 */
function resetButtons(): HTMLElement[] {
  return screen.getAllByRole('button', { name: 'works.meta.reset' });
}

function saveButton(): HTMLButtonElement {
  return screen.getByRole('button', {
    name: 'works.meta.save',
  }) as HTMLButtonElement;
}

/** 向指定 chip-set 实例派发 change 事件（模拟组件自治的 chip 增删回传） */
function chipChange(label: string, type: 'add' | 'remove', value: string) {
  const listener = h.chipChangeListeners[label];
  if (!listener) throw new Error(`no chip change listener: ${label}`);
  act(() => {
    listener(
      new CustomEvent('change', {
        detail: { type, value, chip: { value: '' } },
      }),
    );
  });
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
  h.api.getMetadataOverride.mockReset();
  h.api.saveMetadataOverride.mockReset();
  h.snackbarOpen.mockClear();
  h.appendedChips.length = 0;
  h.chipChangeListeners = {};
  current = makeDetail();
  h.api.getMetadataOverride.mockImplementation(() => Promise.resolve(current));
});

afterEach(() => {
  cleanup();
});

describe('MetadataEditDialog 草稿生命周期（P1-13）', () => {
  it('核心 bug：后台 refetch（detail 新对象身份）不得重置未保存的标题草稿', async () => {
    const qc = makeClient();
    renderDialog(qc);
    const input = await screen.findByLabelText('works.meta.field-title');
    expect((input as HTMLInputElement).value).toBe('覆盖标题');

    fireEvent.change(input, { target: { value: '我的标题' } });
    expect(inputByLabel('works.meta.field-title').value).toBe('我的标题');

    // 模拟 refetchOnWindowFocus / invalidate 后的重拉：同内容、新对象身份。
    // TanStack Query v5 的 observer 通知走微任务，先 flush 再断言
    act(() => {
      qc.setQueryData(metadataOverrideKey('w1'), refetched(current));
    });
    await flushAsync();

    expect(inputByLabel('works.meta.field-title').value).toBe('我的标题');
    // refetch 也不得重建 chip DOM（chipEpochs 号未变，items 基准未切换）
    expect(h.appendedChips).toEqual(['覆盖标签']);
  });

  it('关闭后重新打开：草稿重新播种为服务器生效值', async () => {
    const qc = makeClient();
    const view = renderDialog(qc);
    await screen.findByLabelText('works.meta.field-title');
    fireEvent.change(inputByLabel('works.meta.field-title'), {
      target: { value: '我的标题' },
    });

    view.rerender(
      <QueryClientProvider client={qc}>
        <MetadataEditDialog workId='w1' open={false} onClose={() => {}} />
      </QueryClientProvider>,
    );
    view.rerender(
      <QueryClientProvider client={qc}>
        <MetadataEditDialog workId='w1' open={true} onClose={() => {}} />
      </QueryClientProvider>,
    );

    // 重开即回到服务器值（不等异步 refetch：旧实现只能靠 refetch「碰巧」重置）
    expect(inputByLabel('works.meta.field-title').value).toBe('覆盖标题');
    await flushAsync();
  });
});

describe('恢复原始 → 本地草稿 + PATCH resetFields', () => {
  it('点「恢复原始」（title）：输入框立即变 original、零网络请求、徽标/按钮消失、保存可用', async () => {
    const qc = makeClient();
    renderDialog(qc);
    await screen.findByLabelText('works.meta.field-title');
    await waitFor(() => expect(h.appendedChips).toEqual(['覆盖标签']));
    expect(resetButtons()).toHaveLength(3); // title/circle/tags
    expect(screen.getAllByText('works.meta.overridden')).toHaveLength(3);
    expect(saveButton().disabled).toBe(true); // 未编辑未 reset → 空 payload
    const readCalls = h.api.getMetadataOverride.mock.calls.length;
    const saveCalls = h.api.saveMetadataOverride.mock.calls.length;

    fireEvent.click(resetButtons()[0]); // DOM 顺序第一个被覆盖字段 = title

    // 立即本地生效：草稿值切换为 original
    expect(inputByLabel('works.meta.field-title').value).toBe('原始标题');
    // 零网络请求：不触发保存，也不触发 refetch（纯本地草稿操作）
    expect(h.api.saveMetadataOverride.mock.calls).toHaveLength(saveCalls);
    expect(h.api.getMetadataOverride.mock.calls).toHaveLength(readCalls);
    // 徽标与恢复按钮即时消失
    expect(resetButtons()).toHaveLength(2);
    expect(screen.getAllByText('works.meta.overridden')).toHaveLength(2);
    // 保存按钮变可用（hasAny 计入 resetFields）
    expect(saveButton().disabled).toBe(false);
    await flushAsync();
  });

  it('reset title 后保存：PATCH 含 resetFields:["title"] 且 title=null（非 original 值重钉）', async () => {
    h.api.saveMetadataOverride.mockResolvedValue({ success: true });
    const qc = makeClient();
    renderDialog(qc);
    await screen.findByLabelText('works.meta.field-title');
    fireEvent.click(resetButtons()[0]);
    fireEvent.click(saveButton());
    await waitFor(() =>
      expect(h.api.saveMetadataOverride).toHaveBeenCalledTimes(1),
    );
    const payload = h.api.saveMetadataOverride.mock.calls[0][1];
    expect(payload.resetFields).toEqual(['title']);
    expect(payload.title).toBeNull();
  });

  it('reset tags：chips 以 original 集合重建；保存 payload 含 tags 标记且动作列表为空', async () => {
    const qc = makeClient();
    renderDialog(qc);
    await screen.findByLabelText('works.meta.field-title');
    await waitFor(() => expect(h.appendedChips).toEqual(['覆盖标签']));
    h.api.saveMetadataOverride.mockResolvedValue({ success: true });

    fireEvent.click(resetButtons()[resetButtons().length - 1]); // tags 行在最后

    // chip epoch bump → 以 original 集合重建 DOM
    await waitFor(() =>
      expect(h.appendedChips).toEqual(['覆盖标签', '原始标签']),
    );
    fireEvent.click(saveButton());
    await waitFor(() =>
      expect(h.api.saveMetadataOverride).toHaveBeenCalledTimes(1),
    );
    const payload = h.api.saveMetadataOverride.mock.calls[0][1];
    expect(payload.resetFields).toEqual(['tags']);
    expect(payload.addTags).toBeUndefined();
    expect(payload.removeTagIds).toBeUndefined();
  });

  it('reset title 后再编辑：标记撤销，payload title 为编辑值（普通覆盖）', async () => {
    h.api.saveMetadataOverride.mockResolvedValue({ success: true });
    const qc = makeClient();
    renderDialog(qc);
    await screen.findByLabelText('works.meta.field-title');
    fireEvent.click(resetButtons()[0]);
    expect(inputByLabel('works.meta.field-title').value).toBe('原始标题');

    fireEvent.change(inputByLabel('works.meta.field-title'), {
      target: { value: '编辑标题' },
    });
    fireEvent.click(saveButton());
    await waitFor(() =>
      expect(h.api.saveMetadataOverride).toHaveBeenCalledTimes(1),
    );
    const payload = h.api.saveMetadataOverride.mock.calls[0][1];
    expect(payload.title).toBe('编辑标题');
    expect(payload.resetFields ?? []).not.toContain('title');
  });

  it('reset tags 后再添加标签：标记保留，addTags 相对 original 叠加', async () => {
    h.api.saveMetadataOverride.mockResolvedValue({ success: true });
    const qc = makeClient();
    renderDialog(qc);
    await screen.findByLabelText('works.meta.field-title');

    fireEvent.click(resetButtons()[resetButtons().length - 1]); // tags
    chipChange('works.meta.field-tags', 'add', '新标签');

    fireEvent.click(saveButton());
    await waitFor(() =>
      expect(h.api.saveMetadataOverride).toHaveBeenCalledTimes(1),
    );
    const payload = h.api.saveMetadataOverride.mock.calls[0][1];
    expect(payload.resetFields).toEqual(['tags']);
    expect(payload.addTags).toEqual(['新标签']);
  });

  it('仅 reset 不编辑：payload 只有 resetFields（非空请求）', async () => {
    h.api.saveMetadataOverride.mockResolvedValue({ success: true });
    const qc = makeClient();
    renderDialog(qc);
    await screen.findByLabelText('works.meta.field-title');
    fireEvent.click(resetButtons()[resetButtons().length - 1]); // tags reset
    expect(saveButton().disabled).toBe(false);
    fireEvent.click(saveButton());
    await waitFor(() =>
      expect(h.api.saveMetadataOverride).toHaveBeenCalledTimes(1),
    );
    const payload = h.api.saveMetadataOverride.mock.calls[0][1];
    const definedEntries = Object.entries(payload).filter(
      ([, v]) => v !== undefined,
    );
    expect(definedEntries).toEqual([['resetFields', ['tags']]]);
  });

  it('取消/关闭：草稿丢弃，无任何网络写请求', async () => {
    const qc = makeClient();
    const view = renderDialog(qc);
    await screen.findByLabelText('works.meta.field-title');
    fireEvent.click(resetButtons()[0]);
    fireEvent.change(inputByLabel('works.meta.field-title'), {
      target: { value: '不会保存的标题' },
    });
    // M3eDialog mock 未接 onClosed 通路，与现状一致直接以 open=false 关闭
    view.rerender(
      <QueryClientProvider client={qc}>
        <MetadataEditDialog workId='w1' open={false} onClose={() => {}} />
      </QueryClientProvider>,
    );
    await flushAsync();
    expect(h.api.saveMetadataOverride).not.toHaveBeenCalled();
  });
});

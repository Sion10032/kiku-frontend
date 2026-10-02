// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import List from './List';
import { MainScrollProvider } from '../contexts/mainScroll';
import { useUserStore } from '../stores/userStore';
import type { Tag } from '../types';

const h = vi.hoisted(() => ({
  result: {} as Record<string, unknown>,
  navigate: vi.fn(),
}));

vi.mock('../queries/useListQuery', () => ({
  useEntityListQuery: () => h.result,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('i18next', () => ({ default: { t: (key: string) => key } }));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => h.navigate,
}));

vi.mock('@m3e/react/search', () => ({
  M3eSearchBar: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
}));
vi.mock('@m3e/react/icon', () => ({
  M3eIcon: () => <i />,
}));
vi.mock('@m3e/react/list', () => ({
  M3eListAction: ({
    children,
    onClick,
  }: {
    children?: ReactNode;
    onClick?: (e: unknown) => void;
  }) => (
    <div role='listitem' onClick={onClick}>
      {children}
    </div>
  ),
}));
vi.mock('@m3e/react/progress-indicator', () => ({
  M3eCircularProgressIndicator: () => <div role='progressbar' />,
}));
vi.mock('../components/favourites/FavButton', () => ({
  default: () => <div data-testid='fav' />,
}));

// react-virtual 依赖 ResizeObserver 与布局测量；jsdom 均未提供，统一 stub：
// virtual-core 的 getRect / measureElement 读 offsetWidth/offsetHeight（非 gBCR），
// 滚动容器（main）视口高 600、行高 48 → 可视区约 13 行 + overscan
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub);
const offsetHeightSpy = vi
  .spyOn(HTMLElement.prototype, 'offsetHeight', 'get')
  .mockImplementation(function (this: HTMLElement) {
    return this.tagName === 'MAIN' ? 600 : 48;
  });

function tagsData(n: number): Tag[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    name: `Tag ${i + 1}`,
    workCount: i,
  }));
}

function renderList(ui: ReactNode, initialScrollTop = 0) {
  const scrollEl = document.createElement('main');
  scrollEl.scrollTop = initialScrollTop;
  document.body.appendChild(scrollEl);
  const view = render(
    <MainScrollProvider scrollRef={{ current: scrollEl }}>
      {ui}
    </MainScrollProvider>,
  );
  return { ...view, scrollEl };
}

const rows = (container: HTMLElement) =>
  container.querySelectorAll<HTMLElement>('[role="listitem"]');

beforeEach(() => {
  h.navigate.mockReset();
  h.result = { data: tagsData(500), isLoading: false, isError: false };
  useUserStore.setState({ auth: true, name: 'tester', group: 'user' });
});

afterEach(() => {
  cleanup();
  offsetHeightSpy.mockClear();
  document.body.innerHTML = '';
});

describe('List 虚拟滚动', () => {
  it('500 条数据只挂载可视区附近的行（远小于总量）', () => {
    const { container } = renderList(<List type='tags' />);
    const n = rows(container).length;
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(100);
  });

  it('首个可见行是数据首项', () => {
    const { container } = renderList(<List type='tags' />);
    expect(rows(container)[0]?.textContent).toContain('Tag 1');
  });

  it('搜索过滤后只渲染命中行，且行数仍受虚拟窗口约束', () => {
    const { container } = renderList(<List type='tags' />);
    const input = container.querySelector('input');
    expect(input).not.toBeNull();
    fireEvent.input(input!, { target: { value: 'Tag 499' } });
    const matched = rows(container);
    expect(matched.length).toBe(1);
    expect(matched[0].textContent).toContain('Tag 499');
  });

  it('挂载时残留的滚动位置被归零（缓存命中列表瞬间撑高，残留 scrollTop 会被钳到底部）', () => {
    const { scrollEl } = renderList(<List type='tags' />, 12345);
    expect(scrollEl.scrollTop).toBe(0);
  });
});

describe('List 加载与空状态', () => {
  it('加载中显示进度条、不渲染列表', () => {
    h.result = { data: undefined, isLoading: true, isError: false };
    const { container } = renderList(<List type='tags' />);
    expect(container.querySelector('[role="progressbar"]')).not.toBeNull();
    expect(rows(container).length).toBe(0);
  });

  it('空数据显示空态文案', () => {
    h.result = { data: [], isLoading: false, isError: false };
    const { container } = renderList(<List type='tags' />);
    expect(container.textContent).toContain('works.list-empty');
  });

  it('加载失败显示错误文案', () => {
    h.result = { data: undefined, isLoading: false, isError: true };
    const { container } = renderList(<List type='tags' />);
    expect(container.textContent).toContain('works.load-failed-retry');
  });
});

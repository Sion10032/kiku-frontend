// @vitest-environment jsdom
import type { Ref, ReactNode } from 'react';
import { forwardRef, useImperativeHandle, useRef } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import GlobalSearchBar from './GlobalSearchBar';

// ---- mock 状态（vi.hoisted 保证先于被提升的 vi.mock 工厂求值可用）----
const h = vi.hoisted(() => ({
  // /works 路由当前 URL q（模拟「已搜索」状态）
  urlQ: undefined as string | undefined,
  navigate: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  useRouterState: (opts: {
    select: (s: {
      location: { pathname: string; search: { q?: string } };
    }) => unknown;
  }) =>
    opts.select({
      location: { pathname: '/works', search: { q: h.urlQ } },
    }),
  useNavigate: () => h.navigate,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../../queries/useListQuery', () => ({
  useCirclesQuery: () => ({ data: undefined }),
  useTagsQuery: () => ({ data: undefined }),
  useVasQuery: () => ({ data: undefined }),
}));

interface MockViewApi {
  open: boolean;
  clear: () => void;
}

interface MockViewProps {
  children?: ReactNode;
  onQuery?: (e: { detail: { term: string } }) => void;
  onClear?: () => void;
}

// 模拟 m3e-search-view 的关键行为：X（class="clear"）与「← 返回」
// （class="close"）两个按钮都在点击的同一事件循环内同步调用实例方法
// clear()（真实组件 #handleClearClick/#handleCloseClick 的语义），
// clear() 置空输入并同步派发 query('') 与 clear 事件。
// api 对象一次创建、终身复用：宿主的 patch（view.clear = ...）才能像
// patch 真实元素实例方法一样生效。
vi.mock('@m3e/react/search', async () => {
  const M3eSearchView = forwardRef(
    (props: MockViewProps, ref: Ref<MockViewApi>) => {
      const hostRef = useRef<HTMLDivElement | null>(null);
      const propsRef = useRef<MockViewProps>(props);
      propsRef.current = props;
      const apiRef = useRef<MockViewApi>({
        open: false,
        clear() {
          const input = hostRef.current?.querySelector('input');
          if (input) input.value = '';
          propsRef.current.onQuery?.({ detail: { term: '' } });
          propsRef.current.onClear?.();
        },
      });
      useImperativeHandle(ref, () => apiRef.current);
      return (
        <div ref={hostRef} data-testid='search-view'>
          {/* 真实组件中为 shadow DOM 内 class="clear" 的清除按钮 */}
          <button
            type='button'
            data-testid='mock-clear'
            className='clear'
            onClick={() => apiRef.current.clear()}
          />
          {/* 真实组件中为 shadow DOM 内 class="close" 的返回按钮 */}
          <button
            type='button'
            data-testid='mock-back'
            className='close'
            onClick={() => apiRef.current.clear()}
          />
          {props.children}
        </div>
      );
    },
  );
  return { M3eSearchView };
});

vi.mock('@m3e/react/list', () => ({
  M3eList: (props: { children?: ReactNode }) => <div>{props.children}</div>,
  M3eListItem: (props: { children?: ReactNode }) => <div>{props.children}</div>,
}));
vi.mock('@m3e/react/icon-button', () => ({
  M3eIconButton: (props: { children?: ReactNode }) => (
    <button type='button'>{props.children}</button>
  ),
}));
vi.mock('@m3e/react/icon', () => ({ M3eIcon: () => <span /> }));
vi.mock('@m3e/icons/outlined/close', () => ({}));
vi.mock('@m3e/icons/outlined/history', () => ({}));

function renderBar() {
  render(<GlobalSearchBar />);
  return screen.getByPlaceholderText('search.placeholder') as HTMLInputElement;
}

beforeEach(() => {
  h.navigate.mockClear();
  h.urlQ = undefined;
  localStorage.clear();
});

afterEach(cleanup);

describe('GlobalSearchBar 面板内按钮点击判别', () => {
  it('点击「← 返回」：保留输入与 URL q，不触发导航', () => {
    h.urlQ = 'foo';
    const input = renderBar();
    expect(input.value).toBe('foo');

    fireEvent.click(screen.getByTestId('mock-back'));

    expect(h.navigate).not.toHaveBeenCalled();
    expect(input.value).toBe('foo');
  });

  it('点击「X 清除」：清空输入并移除 URL q（保留其余参数）', () => {
    h.urlQ = 'foo';
    const input = renderBar();
    expect(input.value).toBe('foo');

    fireEvent.click(screen.getByTestId('mock-clear'));

    expect(h.navigate).toHaveBeenCalledTimes(1);
    const opts = h.navigate.mock.calls[0][0] as {
      to: string;
      search: (prev: Record<string, unknown>) => Record<string, unknown>;
    };
    expect(opts.to).toBe('/works');
    expect(opts.search({ q: 'foo', order: 'name' })).toEqual({
      q: undefined,
      order: 'name',
    });
    expect(input.value).toBe('');
  });
});

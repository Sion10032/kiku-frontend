// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useSettingsStore } from '../../stores/settingsStore';
import DashboardPage from './DashboardPage';

afterEach(() => {
  cleanup();
  useSettingsStore.setState({ contentWidth: 'standard' });
});

interface Props {
  className?: string;
  outerClassName?: string;
  base?: 'narrow' | 'form' | 'wide';
  scroll?: boolean;
}

/** 渲染并返回两层 class：外层全宽滚动容器 / 内层限宽列 */
function renderPage(props: Props = {}): { outer: string; inner: string } {
  const { container } = render(<DashboardPage {...props}>x</DashboardPage>);
  const outer = container.firstElementChild as HTMLElement;
  const inner = outer.firstElementChild as HTMLElement;
  return { outer: outer.className, inner: inner.className };
}

describe('DashboardPage 页壳', () => {
  it('外层全宽容器负责内边距与滚动，限宽列按内容自然高度', () => {
    useSettingsStore.setState({ contentWidth: 'standard' });
    const { outer, inner } = renderPage();
    expect(outer).toContain('h-full');
    expect(outer).toContain('p-6');
    expect(outer).toContain('overflow-y-auto');
    expect(inner).toContain('mx-auto');
    expect(inner).toContain('max-w-2xl');
    // 限宽列不设高度：由内容撑开，滚动发生在外层（滚动条贴视口右缘）
    expect(inner).not.toContain('h-full');
  });

  it('scroll=false：外层不滚动，限宽列撑满高度交给页面分区', () => {
    const { outer, inner } = renderPage({ scroll: false });
    expect(outer).toContain('overflow-hidden');
    expect(outer).not.toContain('overflow-y-auto');
    expect(inner).toContain('h-full');
  });

  it('outerClassName 附加到外层容器，className 仍在限宽列', () => {
    const { outer, inner } = renderPage({
      outerClassName: 'pb-0',
      className: 'flex flex-col gap-4',
    });
    expect(outer).toContain('pb-0');
    expect(inner).toContain('flex flex-col gap-4');
    expect(inner).not.toContain('pb-0');
  });

  it('不预设块间布局：gap / flex / 滚动类都不含', () => {
    const { outer, inner } = renderPage();
    expect(inner).not.toContain('gap-');
    expect(inner).not.toContain('flex');
    expect(inner).not.toContain('overflow');
    expect(outer).not.toContain('gap-');
    expect(outer).not.toContain('flex');
  });

  it('页面 className 追加在限宽列末尾', () => {
    const { inner } = renderPage({ className: 'flex flex-col gap-4' });
    expect(inner.trim().endsWith('flex flex-col gap-4')).toBe(true);
  });

  it('base 可覆盖默认档位', () => {
    useSettingsStore.setState({ contentWidth: 'standard' });
    expect(renderPage({ base: 'wide' }).inner).toContain('max-w-[1680px]');
  });
});

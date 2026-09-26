// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useSettingsStore } from '../../stores/settingsStore';
import PageContainer, { type PageWidthBase } from './PageContainer';

afterEach(() => {
  cleanup();
  useSettingsStore.setState({ contentWidth: 'standard' });
});

/** 渲染并返回根容器 class（PageContainer 的直接输出 div） */
function renderClass(base?: PageWidthBase, className?: string): string {
  const { container } = render(
    <PageContainer base={base} className={className}>
      x
    </PageContainer>,
  );
  return (container.firstChild as HTMLElement).className;
}

describe('PageContainer 档位映射', () => {
  it('standard：各 base 维持自身上限', () => {
    expect(renderClass('narrow')).toContain('max-w-3xl');
    expect(renderClass('form')).toContain('max-w-2xl');
    expect(renderClass('detail')).toContain('max-w-350');
    expect(renderClass('wide')).toContain('max-w-[1680px]');
  });

  it('wide：768/672 放宽到 1280，1400/1680 维持自身', () => {
    useSettingsStore.setState({ contentWidth: 'wide' });
    expect(renderClass('narrow')).toContain('max-w-[1280px]');
    expect(renderClass('form')).toContain('max-w-[1280px]');
    expect(renderClass('detail')).toContain('max-w-350');
    expect(renderClass('wide')).toContain('max-w-[1680px]');
  });

  it('ultra：全部放宽到 1680', () => {
    useSettingsStore.setState({ contentWidth: 'ultra' });
    expect(renderClass('narrow')).toContain('max-w-[1680px]');
    expect(renderClass('form')).toContain('max-w-[1680px]');
    expect(renderClass('detail')).toContain('max-w-[1680px]');
    expect(renderClass('wide')).toContain('max-w-[1680px]');
  });

  it('full：不含任何 max-w 类', () => {
    useSettingsStore.setState({ contentWidth: 'full' });
    expect(renderClass('narrow')).not.toContain('max-w');
    expect(renderClass('detail')).not.toContain('max-w');
  });

  it('base 缺省为 narrow，className 追加在末尾', () => {
    expect(renderClass(undefined)).toContain('max-w-3xl');
    const cls = renderClass('narrow', 'py-16 text-center');
    expect(cls).toContain('mx-auto w-full');
    expect(cls.trim().endsWith('py-16 text-center')).toBe(true);
  });
});

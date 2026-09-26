// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useResetPageOnPageSizeChange } from './useResetPageOnPageSizeChange';

describe('useResetPageOnPageSizeChange', () => {
  it('挂载不触发；档位变更触发一次；同值重渲染不重复触发', () => {
    const onReset = vi.fn();
    const { rerender } = renderHook(
      ({ pageSize }) => useResetPageOnPageSizeChange(pageSize, onReset),
      { initialProps: { pageSize: 20 } },
    );
    expect(onReset).not.toHaveBeenCalled();

    rerender({ pageSize: 50 });
    expect(onReset).toHaveBeenCalledTimes(1);

    rerender({ pageSize: 50 });
    expect(onReset).toHaveBeenCalledTimes(1);

    rerender({ pageSize: 100 });
    expect(onReset).toHaveBeenCalledTimes(2);
  });

  it('onReset 每次渲染换新引用也不重复触发（页面传内联箭头）', () => {
    const calls: number[] = [];
    const { rerender } = renderHook(
      ({ pageSize }) =>
        useResetPageOnPageSizeChange(pageSize, () => calls.push(pageSize)),
      { initialProps: { pageSize: 20 } },
    );
    expect(calls).toEqual([]);

    // 同值 + 全新回调引用：不得触发
    rerender({ pageSize: 20 });
    rerender({ pageSize: 20 });
    expect(calls).toEqual([]);

    // 变档：只触发一次，且用的是最新回调
    rerender({ pageSize: 50 });
    expect(calls).toEqual([50]);
  });
});

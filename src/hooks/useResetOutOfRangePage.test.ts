// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useResetOutOfRangePage } from './useResetOutOfRangePage';
import type { Pagination } from '../types';

function makeProps(pagination: Pagination | undefined) {
  return { page: 5, pageSize: 100, pagination };
}

describe('useResetOutOfRangePage', () => {
  it('页码在范围内：不触发（含首次挂载的合法书签）', () => {
    const onReset = vi.fn();
    renderHook(
      ({ page, pageSize, pagination }) =>
        useResetOutOfRangePage(page, pageSize, pagination, onReset),
      {
        initialProps: makeProps({
          currentPage: 5,
          pageSize: 100,
          totalCount: 1500,
        }),
      },
    );
    expect(onReset).not.toHaveBeenCalled();
  });

  it('页码越界（切档后残留）：触发一次', () => {
    const onReset = vi.fn();
    renderHook(
      ({ page, pageSize, pagination }) =>
        useResetOutOfRangePage(page, pageSize, pagination, onReset),
      {
        initialProps: makeProps({
          currentPage: 5,
          pageSize: 100,
          totalCount: 250,
        }),
      },
    );
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('keepPreviousData 旧请求（pageSize 不符）：不判定、不触发', () => {
    const onReset = vi.fn();
    renderHook(
      ({ page, pageSize, pagination }) =>
        useResetOutOfRangePage(page, pageSize, pagination, onReset),
      {
        initialProps: makeProps({
          // 旧档（20 条/页）的回执：page=5 在该档下越界
          currentPage: 5,
          pageSize: 20,
          totalCount: 250,
        }),
      },
    );
    expect(onReset).not.toHaveBeenCalled();
  });

  it('keepPreviousData 旧请求（currentPage 不符）：不判定、不触发', () => {
    const onReset = vi.fn();
    renderHook(
      ({ page, pageSize, pagination }) =>
        useResetOutOfRangePage(page, pageSize, pagination, onReset),
      {
        initialProps: {
          // 已归位到 page=1，但 placeholderData 仍是旧页 5 的回执（越界）
          page: 1,
          pageSize: 100,
          pagination: {
            currentPage: 5,
            pageSize: 100,
            totalCount: 250,
          } satisfies Pagination,
        },
      },
    );
    expect(onReset).not.toHaveBeenCalled();
  });

  it('无分页数据：不触发', () => {
    const onReset = vi.fn();
    renderHook(
      ({ page, pageSize, pagination }) =>
        useResetOutOfRangePage(page, pageSize, pagination, onReset),
      { initialProps: makeProps(undefined) },
    );
    expect(onReset).not.toHaveBeenCalled();
  });

  it('onReset 换新引用不重复触发（页面传内联箭头）', () => {
    const calls: number[] = [];
    const pagination: Pagination = {
      currentPage: 5,
      pageSize: 100,
      totalCount: 250,
    };
    const { rerender } = renderHook(
      ({
        page,
        pageSize,
        pag,
      }: {
        page: number;
        pageSize: number;
        pag: Pagination;
      }) => useResetOutOfRangePage(page, pageSize, pag, () => calls.push(page)),
      { initialProps: { page: 5, pageSize: 100, pag: pagination } },
    );
    expect(calls).toEqual([5]);

    // 同值 + 全新回调引用、同一分页对象：不得再次触发
    rerender({ page: 5, pageSize: 100, pag: pagination });
    expect(calls).toEqual([5]);
  });
});

import { useEffect, useRef } from 'react';
import type { Pagination } from '../types';

/**
 * 页码越界回收：数据回来后若 URL 页码已超过总页数（如切档后残留的
 * `?page=5`，在新档位下总共只有 3 页），把页码归 1。
 *
 * 与 `useResetPageOnPageSizeChange` 互补：后者只负责「列表页挂载期间」观察到的
 * 档位变化；档位是在 `/settings` 改的（列表页当时未挂载），或越界页码是浏览器
 * Back / 书签 / 全量刷新带进来的，都由本 hook 依据分页回执兜底。
 *
 * 合法页码不触发，所以正常首屏与合法书签不导航。keepPreviousData 会让 data
 * 暂时属于上一次请求：只有回执的 currentPage/pageSize 与当前请求一致时才
 * 判定，既避免用旧数据误判，也避免归位后 placeholderData 再次触发形成循环。
 */
export function useResetOutOfRangePage(
  page: number,
  pageSize: number,
  pagination: Pagination | undefined,
  onReset: () => void,
): void {
  const onResetRef = useRef(onReset);

  // 每次提交同步最新回调（写 ref 放在 effect 而非渲染期，避免并发渲染下写 ref）
  useEffect(() => {
    onResetRef.current = onReset;
  });

  useEffect(() => {
    if (!pagination) return;
    // 回执与当前请求不一致 = 旧请求（keepPreviousData）或无限滚动模式，不判定
    if (pagination.currentPage !== page || pagination.pageSize !== pageSize) {
      return;
    }
    const totalPages = Math.max(
      1,
      Math.ceil(pagination.totalCount / pagination.pageSize),
    );
    if (page > totalPages) onResetRef.current();
  }, [page, pageSize, pagination]);
}

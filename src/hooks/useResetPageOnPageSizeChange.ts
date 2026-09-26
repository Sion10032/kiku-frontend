import { useEffect, useRef } from 'react';

/**
 * 每页数量变更时执行一次 onReset（把 URL 页码归 1）。
 * pageSize 已进 query key、数据会重取，但 URL 里的 page 可能已越界
 * （page=5 × 20 条 → 切到 100 条/页）。挂载时不触发（ref 初值即当前值）；
 * onReset 每次渲染换新引用也不会重复触发（ref 守卫先于回调比较）。
 */
export function useResetPageOnPageSizeChange(
  pageSize: number,
  onReset: () => void,
): void {
  const prev = useRef(pageSize);
  useEffect(() => {
    if (prev.current === pageSize) return;
    prev.current = pageSize;
    onReset();
  }, [pageSize, onReset]);
}

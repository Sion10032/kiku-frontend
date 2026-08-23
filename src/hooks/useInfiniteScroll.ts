import { useEffect, useRef } from 'react';

/**
 * 无限滚动：当 `sentinelRef` 指向的元素进入视口时触发 `onLoadMore`。
 *
 * 用 IntersectionObserver 监听哨兵元素，配合 `hasMore` 与 `loading` 控制触发。
 * 适用于 Works 页面等需要分页加载的列表。
 *
 * @returns 绑定到哨兵元素的 ref（放在列表末尾的空 div 上）。
 */
export function useInfiniteScroll(options: {
  onLoadMore: () => void;
  hasMore: boolean;
  loading: boolean;
  /** 触发预加载的距离（px），默认 250 */
  rootMargin?: number;
}) {
  const { onLoadMore, hasMore, loading, rootMargin = 250 } = options;
  // 用 ref 持有最新回调，避免 observer 因回调变化重建
  const cbRef = useRef(onLoadMore);
  cbRef.current = onLoadMore;

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loading) {
          cbRef.current();
        }
      },
      { rootMargin: `${rootMargin}px` },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [ hasMore, loading, rootMargin ]);

  return sentinelRef;
}

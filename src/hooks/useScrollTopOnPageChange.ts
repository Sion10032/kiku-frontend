import { useEffect, useRef } from 'react';
import { useMainScrollRef } from '../contexts/mainScroll';

/**
 * 翻页回顶：分页页（Works/History 等）页码变化时把主布局滚动容器滚回顶部。
 *
 * 页面滚动发生在 MainLayout 的 <main> 上（非 window），客户端路由的同页
 * search 导航不会重置滚动，这里手动归零。仅响应挂载后的 page 变化；
 * 初次挂载不动（如从详情页返回保持原位）。滚动容器 ref 由
 * MainScrollProvider 下发，缺省（树外/单测）时跳过。
 */
export function useScrollTopOnPageChange(page: number) {
  const scrollRef = useMainScrollRef();
  const lastPageRef = useRef(page);
  useEffect(() => {
    if (lastPageRef.current === page) return;
    lastPageRef.current = page;
    const el = scrollRef.current;
    if (el) el.scrollTop = 0;
  }, [page, scrollRef]);
}

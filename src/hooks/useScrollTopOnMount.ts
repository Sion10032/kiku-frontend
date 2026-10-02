import { useLayoutEffect } from 'react';
import { useMainScrollRef } from '../contexts/mainScroll';

/**
 * 挂载回顶：页面挂载（或 resetKey 变化）时把主布局滚动容器滚回顶部。
 *
 * 背景：客户端路由切换不会重置 <main> 的 scrollTop，上一页滚动位置残留。
 * 数据无缓存的页面因 loading 短内容被浏览器 clamp 回 0；而有缓存页面
 * （如 List，数据秒出、虚拟列表瞬间撑高）残留值原样保留，超出新内容
 * 可滚范围时被钳到底部。useLayoutEffect 在首帧绘制前归零，无闪跳；
 * 须声明在读取滚动位置的逻辑（如 useVirtualizer）之前，让后者初始化
 * 读到归零后的 offset。
 *
 * 与 useScrollTopOnPageChange（分页翻页回顶，挂载不动以保留返回时的
 * 位置）互补。
 */
export function useScrollTopOnMount(resetKey?: string) {
  const scrollRef = useMainScrollRef();
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = 0;
  }, [scrollRef, resetKey]);
}

import {
  createContext,
  useContext,
  type ReactNode,
  type RefObject,
} from 'react';

/**
 * 主布局滚动容器（MainLayout 的 <main>）引用。
 *
 * 页面滚动发生在该容器上而非 window；分页页翻页后需要把它滚回顶部，
 * 通过 context 下发 ref，避免页面侧用 id / querySelector 查 DOM。
 * 默认值 current: null：组件树外（单测直接渲染页面）时回顶操作安全跳过。
 */
const MainScrollContext = createContext<RefObject<HTMLElement | null>>({
  current: null,
});

interface MainScrollProviderProps {
  /** MainLayout 挂在 <main> 上的 ref */
  scrollRef: RefObject<HTMLElement | null>;
  children: ReactNode;
}

/** 包住 <Outlet/>，向路由页面提供滚动容器 ref。 */
export function MainScrollProvider({
  scrollRef,
  children,
}: MainScrollProviderProps) {
  return (
    <MainScrollContext.Provider value={scrollRef}>
      {children}
    </MainScrollContext.Provider>
  );
}

/** 取主布局滚动容器 ref（未在 MainLayout 内渲染时 current 为 null）。 */
export function useMainScrollRef() {
  return useContext(MainScrollContext);
}

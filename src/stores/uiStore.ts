import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UiState {
  /** 侧栏是否隐藏（true = 列宽收为 0，内容区占满全宽） */
  navHidden: boolean;
  toggleNavHidden: () => void;
}

/** UI 偏好（localStorage 持久化，与业务 store 分离）。 */
export const useUiStore = create<UiState>()(
  persist(
    set => ({
      navHidden: false,
      toggleNavHidden: () => set(s => ({ navHidden: !s.navHidden })),
    }),
    { name: 'kiku-ui' },
  ),
);

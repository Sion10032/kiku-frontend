import { create } from 'zustand';

/** 默认种子色（M3 基准紫），动态取色关闭/失败时回归此色。 */
export const DEFAULT_SEED = '#6750A4';

interface ThemeState {
  /** 动态色板种子色 (#RRGGBB)，由封面图提取 */
  seed: string;
  setSeed: (seed: string) => void;
}

export const useThemeStore = create<ThemeState>(set => ({
  seed: DEFAULT_SEED,
  setSeed: seed => set({ seed }),
}));

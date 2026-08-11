import { create } from 'zustand';

interface ThemeState {
  /** 动态色板种子色 (#RRGGBB)，由封面图提取 */
  seed: string;
  setSeed: (seed: string) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  seed: '#6750A4',
  setSeed: (seed) => set({ seed }),
}));

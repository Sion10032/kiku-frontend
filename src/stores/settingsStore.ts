import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ColorMode = 'light' | 'dark' | 'auto';

interface SettingsState {
  /** 动态取色：开启后进入作品详情时从封面提取主题种子色 */
  dynamicColor: boolean;
  /** 颜色模式：auto 跟随系统 */
  colorMode: ColorMode;
  setDynamicColor: (on: boolean) => void;
  setColorMode: (mode: ColorMode) => void;
}

/** 本地设置（纯用户偏好，localStorage 持久化，不依赖登录态）。 */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      dynamicColor: true,
      colorMode: 'auto',
      setDynamicColor: (on) => set({ dynamicColor: on }),
      setColorMode: (mode) => set({ colorMode: mode }),
    }),
    {
      name: 'kiku-settings',
      partialize: (s) => ({ dynamicColor: s.dynamicColor, colorMode: s.colorMode }),
    },
  ),
);

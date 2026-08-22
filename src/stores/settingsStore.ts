import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ColorMode = 'light' | 'dark' | 'auto';

interface SettingsState {
  /** 动态取色：开启后进入作品详情时从封面提取主题种子色 */
  dynamicColor: boolean;
  /** 颜色模式：auto 跟随系统 */
  colorMode: ColorMode;
  /** 媒体通知：锁屏/系统媒体面板显示播放控制（MediaSession） */
  mediaNotification: boolean;
  setDynamicColor: (on: boolean) => void;
  setColorMode: (mode: ColorMode) => void;
  setMediaNotification: (on: boolean) => void;
}

/** 本地设置（纯用户偏好，localStorage 持久化，不依赖登录态）。 */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      dynamicColor: true,
      colorMode: 'auto',
      setDynamicColor: (on) => set({ dynamicColor: on }),
      setColorMode: (mode) => set({ colorMode: mode }),
      mediaNotification: true,
      setMediaNotification: (on) => set({ mediaNotification: on }),
    }),
    {
      name: 'kiku-settings',
      partialize: (s) => ({
        dynamicColor: s.dynamicColor,
        colorMode: s.colorMode,
        mediaNotification: s.mediaNotification,
      }),
    },
  ),
);

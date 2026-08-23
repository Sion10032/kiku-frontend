import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ColorMode = 'light' | 'dark' | 'auto';

/** 悬浮歌词（LyricsBar）设置。 */
export interface FloatingLyricsSettings {
  /** 是否显示悬浮歌词 */
  enabled: boolean;
  /** 字体大小（px），默认 14（≈text-sm） */
  fontSize: number;
  /** 歌词过长时最多显示的行数（超出省略），1 为单行 */
  lines: number;
  /** 背景不透明度（0.2–1，仅作用背景，文字保持清晰） */
  opacity: number;
}

interface SettingsState {
  /** 动态取色：开启后进入作品详情时从封面提取主题种子色 */
  dynamicColor: boolean;
  /** 颜色模式：auto 跟随系统 */
  colorMode: ColorMode;
  /** 媒体通知：锁屏/系统媒体面板显示播放控制（MediaSession） */
  mediaNotification: boolean;
  /** 悬浮歌词（LyricsBar）设置 */
  floatingLyrics: FloatingLyricsSettings;
  setDynamicColor: (on: boolean) => void;
  setColorMode: (mode: ColorMode) => void;
  setMediaNotification: (on: boolean) => void;
  setFloatingLyrics: (patch: Partial<FloatingLyricsSettings>) => void;
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
      floatingLyrics: { enabled: false, fontSize: 14, lines: 2, opacity: 0.8 },
      setFloatingLyrics: (patch) =>
        set((s) => ({ floatingLyrics: { ...s.floatingLyrics, ...patch } })),
    }),
    {
      name: 'kiku-settings',
      partialize: (s) => ({
        dynamicColor: s.dynamicColor,
        colorMode: s.colorMode,
        mediaNotification: s.mediaNotification,
        floatingLyrics: s.floatingLyrics,
      }),
    },
  ),
);

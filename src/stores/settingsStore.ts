import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ColorMode = 'light' | 'dark' | 'auto';

/** NSFW 封面显示模式。 */
export type CoverBlurMode = 'always' | 'hover' | 'never';

/** 播放器时间显示模式：total 总时长 / remaining 剩余时间（-mm:ss）。 */
export type TimeDisplayMode = 'total' | 'remaining';

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

/** 文件预览设置。 */
export interface PreviewSettings {
  /** 文本预览字号（px），12–32 */
  textFontSize: number;
  /** 文本自动换行（false 时横向滚动） */
  textWordWrap: boolean;
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
  /** 文件预览设置 */
  preview: PreviewSettings;
  /** NSFW 封面显示模式：always 始终模糊 / hover 悬浮显示 / never 始终显示 */
  coverBlurMode: CoverBlurMode;
  /** 播放器时间显示：total 总时长 / remaining 剩余时间 */
  timeDisplayMode: TimeDisplayMode;
  setDynamicColor: (on: boolean) => void;
  setColorMode: (mode: ColorMode) => void;
  setMediaNotification: (on: boolean) => void;
  setFloatingLyrics: (patch: Partial<FloatingLyricsSettings>) => void;
  setPreview: (patch: Partial<PreviewSettings>) => void;
  setCoverBlurMode: (mode: CoverBlurMode) => void;
  setTimeDisplayMode: (mode: TimeDisplayMode) => void;
}

/** 本地设置（纯用户偏好，localStorage 持久化，不依赖登录态）。 */
export const useSettingsStore = create<SettingsState>()(
  persist(
    set => ({
      dynamicColor: true,
      colorMode: 'auto',
      setDynamicColor: on => set({ dynamicColor: on }),
      setColorMode: mode => set({ colorMode: mode }),
      mediaNotification: true,
      setMediaNotification: on => set({ mediaNotification: on }),
      floatingLyrics: { enabled: false, fontSize: 14, lines: 2, opacity: 0.8 },
      preview: { textFontSize: 14, textWordWrap: true },
      coverBlurMode: 'hover',
      timeDisplayMode: 'total',
      setFloatingLyrics: patch =>
        set(s => ({ floatingLyrics: { ...s.floatingLyrics, ...patch } })),
      setPreview: patch => set(s => ({ preview: { ...s.preview, ...patch } })),
      setCoverBlurMode: mode => set({ coverBlurMode: mode }),
      setTimeDisplayMode: mode => set({ timeDisplayMode: mode }),
    }),
    {
      name: 'kiku-settings',
      partialize: s => ({
        dynamicColor: s.dynamicColor,
        colorMode: s.colorMode,
        mediaNotification: s.mediaNotification,
        floatingLyrics: s.floatingLyrics,
        preview: s.preview,
        coverBlurMode: s.coverBlurMode,
        timeDisplayMode: s.timeDisplayMode,
      }),
    },
  ),
);

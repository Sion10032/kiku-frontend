import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ColorMode = 'light' | 'dark' | 'auto';

/** R18 封面显示模式（模糊仅对 R18 生效）。 */
export type CoverBlurMode = 'always' | 'hover' | 'never';

/** 播放器时间显示模式：total 总时长 / remaining 剩余时间（-mm:ss）。 */
export type TimeDisplayMode = 'total' | 'remaining';

/** 作品库翻页方式：paginate 分页 / infinite 无限滚动。 */
export type WorksPaginationMode = 'paginate' | 'infinite';

/** 作品库分页控件显示位置：top 顶部 / bottom 底部 / both 两处都显示。 */
export type WorksPaginatorPosition = 'top' | 'bottom' | 'both';

/**
 * 根据屏幕像素密度（devicePixelRatio）推断界面缩放档位（%）。<br />
 * dpr=1 → 100%；dpr 每高 1 放大约 12%，dpr<1 反向缩小；按 5% 取整并夹在 80–130。
 * 例：dpr=2 → 110%，dpr=1.25 → 105%，dpr=0.75 → 95%。
 */
export function detectUiScale(): number {
  const dpr = window.devicePixelRatio;
  return clamp(Math.round((100 + (dpr - 1) * 12) / 5) * 5, 80, 130);
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

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
  /** R18 封面显示模式：always 始终模糊 / hover 悬浮显示 / never 始终显示 */
  coverBlurMode: CoverBlurMode;
  /** 播放器时间显示：total 总时长 / remaining 剩余时间 */
  timeDisplayMode: TimeDisplayMode;
  /** 作品库翻页方式（默认分页） */
  worksPaginationMode: WorksPaginationMode;
  /** 作品库分页控件显示位置（默认两处都显示） */
  worksPaginatorPosition: WorksPaginatorPosition;
  /** 作品库是否显示「最近收听」条（默认显示） */
  worksHistoryStrip: boolean;
  /** 界面整体缩放（%，80–130 步进 5），改 html font-size 全局等比缩放 */
  uiScale: number;
  /** 是否在首次加载时按屏幕像素密度自动推断 uiScale（推断一次后置 false，内部标记不对外暴露） */
  uiScaleAuto: boolean;
  setDynamicColor: (on: boolean) => void;
  setColorMode: (mode: ColorMode) => void;
  setMediaNotification: (on: boolean) => void;
  setFloatingLyrics: (patch: Partial<FloatingLyricsSettings>) => void;
  setPreview: (patch: Partial<PreviewSettings>) => void;
  setCoverBlurMode: (mode: CoverBlurMode) => void;
  setTimeDisplayMode: (mode: TimeDisplayMode) => void;
  setWorksPaginationMode: (mode: WorksPaginationMode) => void;
  setWorksPaginatorPosition: (position: WorksPaginatorPosition) => void;
  setShowHistoryStrip: (on: boolean) => void;
  setUiScale: (scale: number) => void;
}

/**
 * 快照白名单：persist 落盘字段与云端备份快照共用同一份来源（见 pickSettings），
 * 避免两处白名单漂移。uiScaleAuto 是内部标记（首次加载自动推断 uiScale 用），
 * 需随 persist 持久化，但**不属于**快照白名单。
 *
 * 后端 kiku-backend/src/routes/settingsBackup.ts 的 payloadSchema 严格镜像此白名单与类型，
 * 新增/修改字段（含枚举值）时必须同步后端 schema，否则备份时该字段会被 trim/拒绝，还原丢失。
 */
const SNAPSHOT_KEYS = [
  'dynamicColor',
  'colorMode',
  'mediaNotification',
  'floatingLyrics',
  'preview',
  'coverBlurMode',
  'timeDisplayMode',
  'worksPaginationMode',
  'worksPaginatorPosition',
  'worksHistoryStrip',
  'uiScale',
] as const;

type SnapshotKey = (typeof SNAPSHOT_KEYS)[number];

/** 按 SNAPSHOT_KEYS 白名单从 state 收集字段值（键序与白名单一致）。 */
function pickSettings(state: SettingsState): Record<SnapshotKey, unknown> {
  return Object.fromEntries(
    SNAPSHOT_KEYS.map((key) => [key, state[key]] as const),
  ) as Record<SnapshotKey, unknown>;
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
      preview: { textFontSize: 14, textWordWrap: true },
      coverBlurMode: 'hover',
      timeDisplayMode: 'total',
      worksPaginationMode: 'paginate',
      worksPaginatorPosition: 'both',
      worksHistoryStrip: true,
      uiScale: 100,
      uiScaleAuto: true,
      setFloatingLyrics: (patch) =>
        set((s) => ({ floatingLyrics: { ...s.floatingLyrics, ...patch } })),
      setPreview: (patch) =>
        set((s) => ({ preview: { ...s.preview, ...patch } })),
      setCoverBlurMode: (mode) => set({ coverBlurMode: mode }),
      setTimeDisplayMode: (mode) => set({ timeDisplayMode: mode }),
      setWorksPaginationMode: (mode) => set({ worksPaginationMode: mode }),
      setWorksPaginatorPosition: (position) =>
        set({ worksPaginatorPosition: position }),
      setShowHistoryStrip: (on) => set({ worksHistoryStrip: on }),
      setUiScale: (scale) => set({ uiScale: scale }),
    }),
    {
      name: 'kiku-settings',
      partialize: (s) => ({
        ...pickSettings(s),
        // uiScaleAuto 为内部标记：持久化以支持「首次加载推断一次 uiScale」，但不进快照
        uiScaleAuto: s.uiScaleAuto,
      }),
      // 首次使用时按屏幕像素密度推断一次界面缩放档位，之后沿用持久化值
      onRehydrateStorage: () => (state) => {
        if (state?.uiScaleAuto) {
          useSettingsStore.setState({ uiScaleAuto: false });
          state.setUiScale(detectUiScale());
        }
      },
    },
  ),
);

/** 收集当前持久化设置为可 JSON 化快照（白名单 = SNAPSHOT_KEYS，不含 uiScaleAuto）。 */
export function getSettingsSnapshot(): Record<string, unknown> {
  return pickSettings(useSettingsStore.getState());
}

/** 应用备份快照：仅接受白名单字段，未知/缺失字段忽略（保留当前值），uiScale 夹取 80–130。 */
export function applySettingsSnapshot(snapshot: Record<string, unknown>): void {
  const patch: Partial<Record<SnapshotKey, unknown>> = {};
  for (const key of SNAPSHOT_KEYS) {
    if (key in snapshot) {
      patch[key] = snapshot[key];
    }
  }
  // uiScale 夹取 80–130 并取整，防止备份中的越界值破坏界面缩放
  if ('uiScale' in patch) {
    patch.uiScale = clamp(Math.round(Number(patch.uiScale)), 80, 130);
  }
  // 快照来自同结构 store（写入方同源），字段类型整体信任；嵌套对象整体替换不深合并。
  // setState 走 persist 中间件自动落盘；uiScale 变化由 ThemeRoot 现有 effect 即时生效。
  useSettingsStore.setState(patch as Partial<SettingsState>);
}

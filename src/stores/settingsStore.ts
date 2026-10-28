import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  BUILTIN_PRESETS,
  EQ_BANDS,
  EQ_CUSTOM_PRESET_LIMIT,
  EQ_PRESET_NAME_MAX,
  type EqualizerPreset,
  defaultQs,
  findPreset,
  flatGains,
  quantizeGainDb,
  quantizeQ,
  sanitizeEqualizerSettings,
} from '../utils/equalizer';

export type ColorMode = 'light' | 'dark' | 'auto';

/** R18 封面显示模式（模糊仅对 R18 生效）。 */
export type CoverBlurMode = 'always' | 'hover' | 'never';

/** 播放器时间显示模式：total 总时长 / remaining 剩余时间（-mm:ss）。 */
export type TimeDisplayMode = 'total' | 'remaining';

/** 全屏播放器封面显示比例：square 1:1 裁剪 / original 原始比例。 */
export type CoverAspectRatio = 'square' | 'original';

/** 作品库翻页方式：paginate 分页 / infinite 无限滚动。 */
export type WorksPaginationMode = 'paginate' | 'infinite';

/** 作品库分页控件显示位置：top 顶部 / bottom 底部 / both 两处都显示。 */
export type WorksPaginatorPosition = 'top' | 'bottom' | 'both';

/** 内容宽度档位：standard 维持各页现状 / wide 1280px / ultra 1680px / full 不限宽；默认 wide。 */
export type ContentWidth = 'standard' | 'wide' | 'ultra' | 'full';

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

/** 作品库每页条数可选档位（单一来源，后端 /api/works 的 pageSize 上限即最大值 100）。 */
export const WORKS_PAGE_SIZES = [10, 20, 50, 100] as const;

/** 视频播放模式：video 画面播放 / audio 仅播音轨（Howler）/ none 不入队；默认 audio。 */
export type VideoMode = 'video' | 'audio' | 'none';

/** 判断是否为合法档位（越界值会被后端 /api/works 以 400 拒绝）。 */
function isWorksPageSize(v: unknown): v is (typeof WORKS_PAGE_SIZES)[number] {
  return (WORKS_PAGE_SIZES as readonly number[]).includes(v as number);
}

const CONTENT_WIDTHS = ['standard', 'wide', 'ultra', 'full'] as const;

/** 判断是否为合法档位（水合/快照还原消毒用，非法值回落 standard）。 */
function isContentWidth(v: unknown): v is ContentWidth {
  return (CONTENT_WIDTHS as readonly string[]).includes(v as string);
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

/** 均衡器设置（自定义 preset 随快照/备份同步）。 */
export interface EqualizerSettings {
  /** 是否启用均衡器 */
  enabled: boolean;
  /** 当前选中 preset id：内置（BUILTIN_PRESETS）或自定义 */
  activeId: string;
  /** 用户自定义 preset（上限 EQ_CUSTOM_PRESET_LIMIT 套） */
  customPresets: EqualizerPreset[];
}

/** 均衡器运行态：当前实际生效的增益/Q（不持久化、不进快照，水合后按 activeId 重装）。 */
export interface EqCurrent {
  gains: number[];
  qs: number[];
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
  /** 音量均衡：播放时按作品响度数据应用增益（需服务器已完成响度分析） */
  loudnessNormalization: boolean;
  /** 音量均衡目标响度（LUFS，-40..0，默认 -28） */
  loudnessTargetLufs: number;
  /** 音量均衡最大增益（dB，0..30，默认 12） */
  loudnessMaxGainDb: number;
  /** 悬浮歌词（LyricsBar）设置 */
  floatingLyrics: FloatingLyricsSettings;
  /** 文件预览设置 */
  preview: PreviewSettings;
  /** R18 封面显示模式：always 始终模糊 / hover 悬浮显示 / never 始终显示 */
  coverBlurMode: CoverBlurMode;
  /** 播放器时间显示：total 总时长 / remaining 剩余时间 */
  timeDisplayMode: TimeDisplayMode;
  /** 全屏播放器封面比例：square 1:1 裁剪 / original 原始比例 */
  coverAspectRatio: CoverAspectRatio;
  /** 作品库翻页方式（默认分页） */
  worksPaginationMode: WorksPaginationMode;
  /** 作品库分页控件显示位置（默认两处都显示） */
  worksPaginatorPosition: WorksPaginatorPosition;
  /** 作品库是否显示「最近收听」条（默认显示） */
  worksHistoryStrip: boolean;
  /** 作品库每页条数，取值限 WORKS_PAGE_SIZES（默认 20） */
  worksPageSize: number;
  /** 界面整体缩放（%，80–130 步进 5），改 html font-size 全局等比缩放 */
  uiScale: number;
  /** 内容宽度档位（默认 wide）：standard 维持各页自身上限，wide/ultra 统一放宽上限，full 不限宽（见 PageContainer） */
  contentWidth: ContentWidth;
  /** 视频播放模式（默认 audio）：决定视频文件入队与播放后端（见 VideoMode） */
  videoMode: VideoMode;
  /** 均衡器设置（默认关闭、选中内置 flat、无自定义 preset） */
  equalizer: EqualizerSettings;
  /** 均衡器运行态：当前生效的增益/Q（不持久化） */
  eqCurrent: EqCurrent;
  /** 是否在首次加载时按屏幕像素密度自动推断 uiScale（推断一次后置 false，内部标记不对外暴露） */
  uiScaleAuto: boolean;
  setDynamicColor: (on: boolean) => void;
  setColorMode: (mode: ColorMode) => void;
  setMediaNotification: (on: boolean) => void;
  setLoudnessNormalization: (on: boolean) => void;
  setLoudnessTargetLufs: (v: number) => void;
  setLoudnessMaxGainDb: (v: number) => void;
  setFloatingLyrics: (patch: Partial<FloatingLyricsSettings>) => void;
  setPreview: (patch: Partial<PreviewSettings>) => void;
  setCoverBlurMode: (mode: CoverBlurMode) => void;
  setTimeDisplayMode: (mode: TimeDisplayMode) => void;
  setCoverAspectRatio: (mode: CoverAspectRatio) => void;
  setWorksPaginationMode: (mode: WorksPaginationMode) => void;
  setWorksPaginatorPosition: (position: WorksPaginatorPosition) => void;
  setShowHistoryStrip: (on: boolean) => void;
  setWorksPageSize: (v: number) => void;
  setUiScale: (scale: number) => void;
  setContentWidth: (v: ContentWidth) => void;
  setVideoMode: (mode: VideoMode) => void;
  setEqualizerEnabled: (on: boolean) => void;
  /** 选中 preset（内置/自定义）：载入其 gains/qs 到 eqCurrent；未知 id 回落 flat */
  selectEqualizerPreset: (id: string) => void;
  /** 改单频段增益（量化到 0.5 dB）；自定义选中项同步写回 */
  updateEqualizerBand: (i: number, gainDb: number) => void;
  /** 改单频段 Q（量化到 0.1）；首尾 shelf 频段忽略，自定义选中项同步写回 */
  updateEqualizerQ: (i: number, q: number) => void;
  /** 以当前运行态新建自定义 preset 并选中；已满 8 套或 name 空白时 no-op 返回 '' */
  addEqualizerCustomPreset: (name: string) => string;
  /** 删除自定义 preset；删的是当前选中项时回落 flat（内置 id 无操作） */
  deleteEqualizerCustomPreset: (id: string) => void;
}

/** 内置 preset id：findPreset 优先命中内置项，同 id 的自定义项不参与写回。 */
const BUILTIN_PRESET_IDS = new Set(BUILTIN_PRESETS.map((p) => p.id));

let customPresetSeq = 0;

/** 生成自定义 preset id：时间戳跨会话唯一，进程内序号消同毫秒碰撞。 */
function nextCustomPresetId(): string {
  customPresetSeq += 1;
  return `custom-${Date.now().toString(36)}-${customPresetSeq}`;
}

/** 全平运行态（未命中 preset / 删除当前自定义项时回落）。 */
function flatCurrent(): EqCurrent {
  return { gains: flatGains(), qs: defaultQs() };
}

/**
 * preset → 运行态。必须复制数组：BUILTIN_PRESETS 是可变结构，
 * 直接引用会让用户拖滑条的写入污染内置 preset。
 */
function presetCurrent(preset: EqualizerPreset): EqCurrent {
  return { gains: [...preset.gains], qs: [...preset.qs] };
}

/**
 * activeId 悬空归一化：指向不存在的 preset（被 8 套上限截断 / 被丢弃的非法项 /
 * 手改 blob）时强制回落内置 flat。消毒后立刻调用（在重装 eqCurrent 之前），
 * 保证落盘的 activeId 与生效的 eqCurrent 一致，不会出现「选中项为空但 EQ 生效」。
 */
function normalizeActiveId(equalizer: EqualizerSettings): EqualizerSettings {
  if (findPreset(equalizer.activeId, equalizer.customPresets)) {
    return equalizer;
  }
  return { ...equalizer, activeId: 'flat' };
}

/** 按 activeId 取运行态；未命中（脏数据）回落全平。 */
function currentForEqualizer(equalizer: EqualizerSettings): EqCurrent {
  const preset = findPreset(equalizer.activeId, equalizer.customPresets);
  return preset ? presetCurrent(preset) : flatCurrent();
}

/** 频段下标是否合法（10 段）。 */
function isBandIndex(i: number): boolean {
  return Number.isInteger(i) && i >= 0 && i < EQ_BANDS.length;
}

/**
 * 当前选中项是自定义 preset 时把运行态改动写回 customPresets；
 * 内置 preset 只读（写回会污染 BUILTIN_PRESETS 且无法持久化）→ 返回空补丁。
 */
function customPresetWriteBack(
  equalizer: EqualizerSettings,
  patch: (preset: EqualizerPreset) => EqualizerPreset,
): Partial<Pick<SettingsState, 'equalizer'>> {
  if (BUILTIN_PRESET_IDS.has(equalizer.activeId)) return {};
  const index = equalizer.customPresets.findIndex(
    (p) => p.id === equalizer.activeId,
  );
  if (index < 0) return {};
  const customPresets = [...equalizer.customPresets];
  customPresets[index] = patch(equalizer.customPresets[index]);
  return { equalizer: { ...equalizer, customPresets } };
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
  'loudnessNormalization',
  'loudnessTargetLufs',
  'loudnessMaxGainDb',
  'floatingLyrics',
  'preview',
  'coverBlurMode',
  'timeDisplayMode',
  'coverAspectRatio',
  'worksPaginationMode',
  'worksPaginatorPosition',
  'worksHistoryStrip',
  'worksPageSize',
  'uiScale',
  'contentWidth',
  'videoMode',
  'equalizer',
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
    (set, get) => ({
      dynamicColor: true,
      colorMode: 'auto',
      setDynamicColor: (on) => set({ dynamicColor: on }),
      setColorMode: (mode) => set({ colorMode: mode }),
      mediaNotification: true,
      setMediaNotification: (on) => set({ mediaNotification: on }),
      loudnessNormalization: false,
      setLoudnessNormalization: (on) => set({ loudnessNormalization: on }),
      loudnessTargetLufs: -28,
      setLoudnessTargetLufs: (v) => set({ loudnessTargetLufs: v }),
      loudnessMaxGainDb: 12,
      setLoudnessMaxGainDb: (v) => set({ loudnessMaxGainDb: v }),
      floatingLyrics: { enabled: false, fontSize: 14, lines: 2, opacity: 0.8 },
      preview: { textFontSize: 14, textWordWrap: true },
      coverBlurMode: 'hover',
      timeDisplayMode: 'total',
      coverAspectRatio: 'original',
      worksPaginationMode: 'paginate',
      worksPaginatorPosition: 'both',
      worksHistoryStrip: true,
      worksPageSize: 20,
      uiScale: 100,
      uiScaleAuto: true,
      contentWidth: 'wide',
      videoMode: 'audio',
      equalizer: { enabled: false, activeId: 'flat', customPresets: [] },
      eqCurrent: flatCurrent(),
      setVideoMode: (mode) => set({ videoMode: mode }),
      setEqualizerEnabled: (on) =>
        set((s) => ({ equalizer: { ...s.equalizer, enabled: on } })),
      selectEqualizerPreset: (id) =>
        set((s) => {
          const preset = findPreset(id, s.equalizer.customPresets);
          // 未命中（含已删除的自定义项 / 未知 id）回落 flat
          if (!preset) {
            return {
              equalizer: { ...s.equalizer, activeId: 'flat' },
              eqCurrent: flatCurrent(),
            };
          }
          return {
            equalizer: { ...s.equalizer, activeId: preset.id },
            eqCurrent: presetCurrent(preset),
          };
        }),
      updateEqualizerBand: (i, gainDb) => {
        // 参数来自 UI：非有限数 / 越界下标直接 no-op（量化函数对 NaN 返回 NaN）
        if (!isBandIndex(i) || !Number.isFinite(gainDb)) return;
        const gain = quantizeGainDb(gainDb);
        // 同值 no-op：拖动时 pointermove 远多于量化档位，避免无意义的重渲染与音频链重设
        if (get().eqCurrent.gains[i] === gain) return;
        set((s) => {
          const gains = [...s.eqCurrent.gains];
          gains[i] = gain;
          return {
            eqCurrent: { ...s.eqCurrent, gains },
            ...customPresetWriteBack(s.equalizer, (preset) => {
              const next = [...preset.gains];
              next[i] = gain;
              return { ...preset, gains: next };
            }),
          };
        });
      },
      updateEqualizerQ: (i, q) => {
        // 首尾走 shelf（buildBandParams 恒用默认 Q），Q 改动对它们无意义
        if (!isBandIndex(i) || i === 0 || i === EQ_BANDS.length - 1) return;
        if (!Number.isFinite(q)) return;
        const value = quantizeQ(q);
        if (get().eqCurrent.qs[i] === value) return; // 同值 no-op
        set((s) => {
          const qs = [...s.eqCurrent.qs];
          qs[i] = value;
          return {
            eqCurrent: { ...s.eqCurrent, qs },
            ...customPresetWriteBack(s.equalizer, (preset) => {
              const next = [...preset.qs];
              next[i] = value;
              return { ...preset, qs: next };
            }),
          };
        });
      },
      addEqualizerCustomPreset: (name) => {
        // 名称去空白 + 截断到 EQ_PRESET_NAME_MAX（与 sanitize 一致）
        const trimmed = name.trim().slice(0, EQ_PRESET_NAME_MAX);
        const s = get();
        if (
          !trimmed
          || s.equalizer.customPresets.length >= EQ_CUSTOM_PRESET_LIMIT
        ) {
          return '';
        }
        const id = nextCustomPresetId();
        const preset: EqualizerPreset = {
          id,
          name: trimmed,
          // 快照当前运行态；复制数组，避免与 eqCurrent 共享
          gains: [...s.eqCurrent.gains],
          qs: [...s.eqCurrent.qs],
        };
        set({
          equalizer: {
            ...s.equalizer,
            activeId: id,
            customPresets: [...s.equalizer.customPresets, preset],
          },
        });
        return id;
      },
      deleteEqualizerCustomPreset: (id) =>
        set((s) => {
          const customPresets = s.equalizer.customPresets.filter(
            (p) => p.id !== id,
          );
          // 未匹配（内置 id / 已删除）→ 原样返回 state，zustand 视为无操作
          if (customPresets.length === s.equalizer.customPresets.length) {
            return s;
          }
          if (s.equalizer.activeId !== id) {
            return { equalizer: { ...s.equalizer, customPresets } };
          }
          // 删的是当前选中项 → 回落 flat
          return {
            equalizer: { ...s.equalizer, activeId: 'flat', customPresets },
            eqCurrent: flatCurrent(),
          };
        }),
      setFloatingLyrics: (patch) =>
        set((s) => ({ floatingLyrics: { ...s.floatingLyrics, ...patch } })),
      setPreview: (patch) =>
        set((s) => ({ preview: { ...s.preview, ...patch } })),
      setCoverBlurMode: (mode) => set({ coverBlurMode: mode }),
      setTimeDisplayMode: (mode) => set({ timeDisplayMode: mode }),
      setCoverAspectRatio: (mode) => set({ coverAspectRatio: mode }),
      setWorksPaginationMode: (mode) => set({ worksPaginationMode: mode }),
      setWorksPaginatorPosition: (position) =>
        set({ worksPaginatorPosition: position }),
      setShowHistoryStrip: (on) => set({ worksHistoryStrip: on }),
      // 公开 API 层校验：非法档位回落 20，保证「worksPageSize 取值限
      // WORKS_PAGE_SIZES」这一文档契约对 setter 也成立
      setWorksPageSize: (v) =>
        set({ worksPageSize: isWorksPageSize(v) ? v : 20 }),
      setUiScale: (scale) => set({ uiScale: scale }),
      setContentWidth: (v) => set({ contentWidth: v }),
    }),
    {
      name: 'kiku-settings',
      partialize: (s) => ({
        ...pickSettings(s),
        // uiScaleAuto 为内部标记：持久化以支持「首次加载推断一次 uiScale」，但不进快照
        uiScaleAuto: s.uiScaleAuto,
      }),
      // 水合消毒放在 merge（而非 onRehydrateStorage 回调）：persist 在模块求值期就
      // 启动 hydrate，此时 `useSettingsStore` 常量仍在 TDZ，回调里引用它会抛
      // ReferenceError 并被 zustand 静默吞掉。merge 在 set 之前同步执行、无需引用该常量。
      // 语义：先完全复刻 zustand 默认浅合并 { ...current, ...persisted }，再消毒
      // worksPageSize（缺失/越界/非数字一律回落 20，合法档位原样保留）。
      merge: (persisted, current) => {
        const merged = {
          ...current,
          ...(persisted as Partial<SettingsState>),
        };
        // equalizer 来自不可信 blob：逐项消毒（缺失/非法回落默认、超 8 套截断），
        // 再把悬空 activeId 归一化到 flat（先归一化，重装的 eqCurrent 才跟着走）
        const equalizer = normalizeActiveId(
          sanitizeEqualizerSettings(merged.equalizer),
        );
        return {
          ...merged,
          worksPageSize: isWorksPageSize(merged.worksPageSize)
            ? merged.worksPageSize
            : 20,
          // contentWidth 非法档位（旧版本前端/手改 blob）回落默认档 wide，
          // 防止 PageContainer 映射表查不到
          contentWidth: isContentWidth(merged.contentWidth)
            ? merged.contentWidth
            : 'wide',
          equalizer,
          // eqCurrent 是运行态（不持久化），水合后按 activeId 重装，
          // 否则刷新后选中项与生效值会不一致（EQ 静默失效）
          eqCurrent: currentForEqualizer(equalizer),
        };
      },
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

/**
 * 应用备份快照：仅接受白名单字段，未知/缺失字段忽略（保留当前值），
 * uiScale 夹取 80–130，worksPageSize 必须落在 WORKS_PAGE_SIZES 内（否则回落 20），
 * equalizer 消毒后应用（快照不含运行态，eqCurrent 随之按 activeId 重装）。
 */
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
  // worksPageSize 必须落在可选档位内，否则还原后会把非法值发给 /api/works（400 白屏）
  if ('worksPageSize' in patch) {
    const size = Number(patch.worksPageSize);
    patch.worksPageSize = isWorksPageSize(size) ? size : 20;
  }
  // contentWidth 必须落在档位内，否则还原后 PageContainer 映射表查不到
  if ('contentWidth' in patch) {
    patch.contentWidth = isContentWidth(patch.contentWidth)
      ? patch.contentWidth
      : 'wide';
  }
  // equalizer 可能来自旧版本/手改备份：消毒 + 悬空 activeId 归一化后应用
  // （超 8 套截断、非法字段回落默认；归一化先于 eqCurrent 重装）
  let eqCurrent: EqCurrent | undefined;
  if ('equalizer' in patch) {
    const equalizer = normalizeActiveId(
      sanitizeEqualizerSettings(patch.equalizer),
    );
    patch.equalizer = equalizer;
    eqCurrent = currentForEqualizer(equalizer);
  }
  // 快照来自同结构 store（写入方同源），字段类型整体信任；嵌套对象整体替换不深合并。
  // setState 走 persist 中间件自动落盘；uiScale 变化由 ThemeRoot 现有 effect 即时生效。
  useSettingsStore.setState({
    ...(patch as Partial<SettingsState>),
    ...(eqCurrent ? { eqCurrent } : {}),
  });
}

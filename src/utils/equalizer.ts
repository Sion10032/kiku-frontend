/**
 * 播放器均衡器纯逻辑层：频段常量、量化、preset 净化与频段参数构造。
 * 除 `createEqChain`（建 WebAudio biquad 链，仅接收注入的 AudioContext）外不触碰 DOM。
 */

/** 10 段图示均衡频段（Hz）。 */
export const EQ_BANDS = [
  31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000,
] as const;

export const EQ_GAIN_MIN = -12;
export const EQ_GAIN_MAX = 12;
export const EQ_GAIN_STEP = 0.5;

export const EQ_Q_MIN = 0.4;
export const EQ_Q_MAX = 8;
export const EQ_Q_STEP = 0.1;
/** 默认 Q；shelf 频段恒用此值。取值在 0.1 量化网格上，消毒后不变。 */
export const EQ_Q_DEFAULT = 1.4;

/** 自定义 preset 套数上限。 */
export const EQ_CUSTOM_PRESET_LIMIT = 8;
/** 自定义 preset 名称长度上限。 */
export const EQ_PRESET_NAME_MAX = 16;

export interface EqualizerPreset {
  id: string;
  name: string;
  gains: number[];
  qs: number[];
}

export interface EqBandParams {
  type: BiquadFilterType;
  frequency: number;
  gain: number;
  Q: number;
}

const BAND_COUNT = EQ_BANDS.length;

/** 增益量化：clamp ±12 后按 0.5 取整（除以 0.5 再乘回，避免浮点尾差）。 */
export function quantizeGainDb(v: number): number {
  const clamped = Math.max(EQ_GAIN_MIN, Math.min(EQ_GAIN_MAX, v));
  return Math.round(clamped / EQ_GAIN_STEP) * EQ_GAIN_STEP;
}

/** Q 量化：clamp 0.4..8 后按 0.1 取整（乘除 10 而非 0.1 累乘，避免浮点尾差）。 */
export function quantizeQ(v: number): number {
  const clamped = Math.max(EQ_Q_MIN, Math.min(EQ_Q_MAX, v));
  return Math.round(clamped * 10) / 10;
}

/** 全平增益：10 个 0。 */
export function flatGains(): number[] {
  return new Array(BAND_COUNT).fill(0);
}

/** 默认 Q：10 个 1.4。 */
export function defaultQs(): number[] {
  return new Array(BAND_COUNT).fill(EQ_Q_DEFAULT);
}

/** 可作为数值处理（NaN 与非数字都不算）；±Infinity 交由量化函数 clamp。 */
function isNumeric(v: unknown): v is number {
  return typeof v === 'number' && !Number.isNaN(v);
}

/** 把任意数组收拾成 10 个量化增益；缺失/非数组补 0，NaN 元素当 0。 */
function normalizeGains(raw: unknown): number[] {
  const src = Array.isArray(raw) ? raw : [];
  const gains: number[] = [];
  for (let i = 0; i < BAND_COUNT; i++) {
    const v = src[i];
    gains.push(isNumeric(v) ? quantizeGainDb(v) : 0);
  }
  return gains;
}

/** 把任意数组收拾成 10 个量化 Q；缺失/非数组补 1.4，NaN 元素当 1.4。 */
function normalizeQs(raw: unknown): number[] {
  // 整个 qs 缺失/非数组 → 直接用默认值（1.4，本身落在 0.1 网格上）
  if (!Array.isArray(raw)) return defaultQs();
  const qs: number[] = [];
  for (let i = 0; i < BAND_COUNT; i++) {
    const v = raw[i];
    qs.push(isNumeric(v) ? quantizeQ(v) : EQ_Q_DEFAULT);
  }
  return qs;
}

/**
 * 净化单个 preset（localStorage 反序列化 / 导入的不可信数据）。
 * id、name 必须是非空字符串，否则视为不可救 → null；gains/qs 逐步 clamp+量化，
 * 长度裁剪/补齐到 10。
 */
export function sanitizeEqualizerPreset(p: unknown): EqualizerPreset | null {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return null;
  const raw = p as Record<string, unknown>;
  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (!id || !name) return null;
  return {
    id,
    name: name.slice(0, EQ_PRESET_NAME_MAX),
    gains: normalizeGains(raw.gains),
    qs: normalizeQs(raw.qs),
  };
}

/** 净化均衡器设置（持久化数据反序列化用）；任何非法输入都回落到默认值。 */
export function sanitizeEqualizerSettings(raw: unknown): {
  enabled: boolean;
  activeId: string;
  customPresets: EqualizerPreset[];
} {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { enabled: false, activeId: 'flat', customPresets: [] };
  }
  const r = raw as Record<string, unknown>;
  const activeId =
    typeof r.activeId === 'string' && r.activeId.trim()
      ? r.activeId.trim()
      : 'flat';
  const customPresets = Array.isArray(r.customPresets)
    ? r.customPresets
        .map(sanitizeEqualizerPreset)
        .filter((p): p is EqualizerPreset => p !== null)
        .slice(0, EQ_CUSTOM_PRESET_LIMIT)
    : [];
  return {
    enabled: typeof r.enabled === 'boolean' ? r.enabled : false,
    activeId,
    customPresets,
  };
}

/** 按 id 查 preset：先内置后自定义。 */
export function findPreset(
  id: string,
  custom: EqualizerPreset[],
): EqualizerPreset | undefined {
  return (
    BUILTIN_PRESETS.find((p) => p.id === id) ?? custom.find((p) => p.id === id)
  );
}

/**
 * 单频段滤波参数：两端走 shelf（忽略传入 Q，恒默认 1.4），中间走 peaking。
 * frequency 取自 EQ_BANDS，gain 由调用方量化后透传。
 */
export function buildBandParams(
  bandIndex: number,
  gainDb: number,
  q: number,
): EqBandParams {
  const frequency = EQ_BANDS[bandIndex];
  if (bandIndex === 0) {
    return { type: 'lowshelf', frequency, gain: gainDb, Q: EQ_Q_DEFAULT };
  }
  if (bandIndex === BAND_COUNT - 1) {
    return { type: 'highshelf', frequency, gain: gainDb, Q: EQ_Q_DEFAULT };
  }
  return { type: 'peaking', frequency, gain: gainDb, Q: q };
}

/** 内置 preset：name 存中文，展示时由 UI 走 i18n（自定义项直接显示 name）。 */
export const BUILTIN_PRESETS: EqualizerPreset[] = [
  {
    id: 'flat',
    name: '平直',
    gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    qs: defaultQs(),
  },
  {
    id: 'bass-boost',
    name: '低音增强',
    gains: [6, 5, 3.5, 1.5, 0, 0, 0, 0, 0, 0],
    qs: defaultQs(),
  },
  {
    id: 'vocal',
    name: '人声增强',
    gains: [0, -1, -1, 0, 1.5, 3, 3.5, 2.5, 1, 0],
    qs: defaultQs(),
  },
  {
    id: 'treble-boost',
    name: '高音增强',
    gains: [0, 0, 0, 0, 0, 1.5, 2.5, 4, 4.5, 5],
    qs: defaultQs(),
  },
  {
    id: 'soft',
    name: '柔和',
    gains: [-2, -1.5, -1, 0.5, 1.5, 1.5, 0.5, -1, -2.5, -3.5],
    qs: defaultQs(),
  },
];

export interface EqChain {
  input: AudioNode;
  output: AudioNode;
  setBands(gains: number[], qs: number[], enabled: boolean): void;
}

/**
 * 建 10 段 biquad 串联链：type/frequency 建链时按 buildBandParams 固定，
 * 运行期只动 gain/Q（setTargetAtTime 0.05s 平滑，对齐响度增益链）。
 * enabled=false 走全 0dB 的恒等变换而非断链——链路常在，切开关不重建节点。
 */
export function createEqChain(ctx: AudioContext): EqChain {
  const filters: BiquadFilterNode[] = [];
  for (let i = 0; i < BAND_COUNT; i++) {
    const { type, frequency, Q } = buildBandParams(i, 0, EQ_Q_DEFAULT);
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    filter.gain.value = 0;
    filter.Q.value = Q;
    filters.push(filter);
  }
  for (let i = 0; i < filters.length - 1; i++) {
    filters[i].connect(filters[i + 1]);
  }

  return {
    input: filters[0],
    output: filters[filters.length - 1],
    setBands(gains: number[], qs: number[], enabled: boolean): void {
      const now = ctx.currentTime;
      for (let i = 0; i < filters.length; i++) {
        // 关闭时全部 0dB：链仍在，只是恒等（Q 回落默认值，增益 0 时不可闻）
        const params = enabled
          ? buildBandParams(i, gains[i] ?? 0, qs[i] ?? EQ_Q_DEFAULT)
          : buildBandParams(i, 0, EQ_Q_DEFAULT);
        filters[i].gain.setTargetAtTime(params.gain, now, 0.05);
        filters[i].Q.setTargetAtTime(params.Q, now, 0.05);
      }
    },
  };
}

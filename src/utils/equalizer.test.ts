import { describe, expect, it } from 'vitest';
import {
  BUILTIN_PRESETS,
  buildBandParams,
  defaultQs,
  EQ_BANDS,
  EQ_CUSTOM_PRESET_LIMIT,
  EQ_GAIN_MAX,
  EQ_GAIN_MIN,
  EQ_GAIN_STEP,
  EQ_PRESET_NAME_MAX,
  EQ_Q_DEFAULT,
  EQ_Q_MAX,
  EQ_Q_MIN,
  EQ_Q_STEP,
  findPreset,
  flatGains,
  quantizeGainDb,
  quantizeQ,
  sanitizeEqualizerPreset,
  sanitizeEqualizerSettings,
} from './equalizer';

describe('eq 常量', () => {
  it('10 个频段 31Hz..16kHz', () => {
    expect(EQ_BANDS).toHaveLength(10);
    expect(EQ_BANDS[0]).toBe(31);
    expect(EQ_BANDS[9]).toBe(16000);
  });

  it('增益量化范围 -12..12 步进 0.5', () => {
    expect(EQ_GAIN_MIN).toBe(-12);
    expect(EQ_GAIN_MAX).toBe(12);
    expect(EQ_GAIN_STEP).toBe(0.5);
  });

  it('Q 范围 0.4..8 步进 0.1，默认 1.4（落在网格上）', () => {
    expect(EQ_Q_MIN).toBe(0.4);
    expect(EQ_Q_MAX).toBe(8);
    expect(EQ_Q_STEP).toBe(0.1);
    expect(EQ_Q_DEFAULT).toBe(1.4);
  });

  it('自定义 preset 上限 8 套、名称最长 16 字符', () => {
    expect(EQ_CUSTOM_PRESET_LIMIT).toBe(8);
    expect(EQ_PRESET_NAME_MAX).toBe(16);
  });
});

describe('quantizeGainDb', () => {
  it('已是步进值原样返回', () => {
    expect(quantizeGainDb(0)).toBe(0);
    expect(quantizeGainDb(0.5)).toBe(0.5);
    expect(quantizeGainDb(-3.5)).toBe(-3.5);
    expect(quantizeGainDb(12)).toBe(12);
    expect(quantizeGainDb(-12)).toBe(-12);
  });

  it('按 Math.round(v/0.5)*0.5 取整（0.25 进位到 0.5）', () => {
    expect(quantizeGainDb(4.24)).toBe(4);
    expect(quantizeGainDb(4.25)).toBe(4.5);
    expect(quantizeGainDb(4.2)).toBe(4);
  });

  it('负值同为 Math.round 半进位（-4.25 → -4）', () => {
    // Math.round(-8.5) === -8：半值向 +∞ 进位
    expect(quantizeGainDb(-4.24)).toBe(-4);
    expect(quantizeGainDb(-4.25)).toBe(-4);
    expect(quantizeGainDb(-4.26)).toBe(-4.5);
  });

  it('clamp 到 ±12', () => {
    expect(quantizeGainDb(20)).toBe(12);
    expect(quantizeGainDb(-20)).toBe(-12);
    expect(quantizeGainDb(12.4)).toBe(12);
    expect(quantizeGainDb(-12.4)).toBe(-12);
    expect(quantizeGainDb(Number.POSITIVE_INFINITY)).toBe(12);
    expect(quantizeGainDb(Number.NEGATIVE_INFINITY)).toBe(-12);
  });
});

describe('quantizeQ', () => {
  it('按 0.1 取整，无浮点尾差', () => {
    expect(quantizeQ(4.1999999)).toBe(4.2);
    expect(quantizeQ(1.41)).toBe(1.4);
    expect(quantizeQ(1.44)).toBe(1.4);
    expect(quantizeQ(1.45)).toBe(1.5);
    expect(quantizeQ(1)).toBe(1);
  });

  it('clamp 到 0.4..8', () => {
    expect(quantizeQ(0.1)).toBe(0.4);
    expect(quantizeQ(0.4)).toBe(0.4);
    expect(quantizeQ(8)).toBe(8);
    expect(quantizeQ(12)).toBe(8);
    expect(quantizeQ(Number.POSITIVE_INFINITY)).toBe(8);
  });
});

describe('flatGains / defaultQs', () => {
  it('flatGains 为 10 个 0', () => {
    expect(flatGains()).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('flatGains 每次返回新数组（调用方改不会被串味）', () => {
    const a = flatGains();
    a[0] = 9;
    expect(flatGains()[0]).toBe(0);
  });

  it('defaultQs 为 10 个 1.4', () => {
    expect(defaultQs()).toEqual(new Array(10).fill(EQ_Q_DEFAULT));
    expect(defaultQs()).toEqual(new Array(10).fill(1.4));
  });

  it('默认 Q 已在 0.1 网格上（消毒幂等）', () => {
    expect(quantizeQ(EQ_Q_DEFAULT)).toBe(EQ_Q_DEFAULT);
    const preset = sanitizeEqualizerPreset({
      id: 'x',
      name: 'n',
      gains: flatGains(),
      qs: defaultQs(),
    });
    expect(preset?.qs).toEqual(defaultQs());
  });
});

describe('sanitizeEqualizerPreset', () => {
  it('合法 preset 原样保留（数值在步进内）', () => {
    const gains = [6, 5, 3.5, 1.5, 0, 0, 0, 0, 0, -1];
    const qs = new Array(10).fill(1.4);
    expect(
      sanitizeEqualizerPreset({ id: 'x', name: '我的', gains, qs }),
    ).toEqual({ id: 'x', name: '我的', gains, qs });
  });

  it('非对象一律 null', () => {
    for (const bad of [null, undefined, 'preset', 42, true, []]) {
      expect(sanitizeEqualizerPreset(bad)).toBeNull();
    }
  });

  it('id 缺失/非字符串/空白 → null', () => {
    const base = { name: '名字' };
    expect(sanitizeEqualizerPreset(base)).toBeNull();
    expect(sanitizeEqualizerPreset({ ...base, id: 7 })).toBeNull();
    expect(sanitizeEqualizerPreset({ ...base, id: '   ' })).toBeNull();
  });

  it('name 缺失/非字符串/空白 → null', () => {
    expect(sanitizeEqualizerPreset({ id: 'x' })).toBeNull();
    expect(sanitizeEqualizerPreset({ id: 'x', name: null })).toBeNull();
    expect(sanitizeEqualizerPreset({ id: 'x', name: '' })).toBeNull();
  });

  it('name 截断到 16 字符', () => {
    const long = '一二三四五六七八九十一二三四五六七八';
    const got = sanitizeEqualizerPreset({ id: 'x', name: long });
    expect(got?.name).toHaveLength(EQ_PRESET_NAME_MAX);
    expect(got?.name).toBe(long.slice(0, EQ_PRESET_NAME_MAX));
  });

  it('gains/qs 缺失或非数组 → 补默认值', () => {
    expect(sanitizeEqualizerPreset({ id: 'x', name: 'n' })).toEqual({
      id: 'x',
      name: 'n',
      gains: flatGains(),
      qs: defaultQs(),
    });
    expect(
      sanitizeEqualizerPreset({
        id: 'x',
        name: 'n',
        gains: 'oops',
        qs: { 0: 1 },
      }),
    ).toEqual({ id: 'x', name: 'n', gains: flatGains(), qs: defaultQs() });
  });

  it('长度裁剪到 10 / 不足补齐到 10', () => {
    const cropped = sanitizeEqualizerPreset({
      id: 'x',
      name: 'n',
      gains: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      qs: new Array(12).fill(1.4),
    });
    expect(cropped?.gains).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(cropped?.qs).toHaveLength(10);

    const padded = sanitizeEqualizerPreset({
      id: 'x',
      name: 'n',
      gains: [2, 3],
      qs: [0.5],
    });
    expect(padded?.gains).toEqual([2, 3, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(padded?.qs).toEqual([
      0.5, 1.4, 1.4, 1.4, 1.4, 1.4, 1.4, 1.4, 1.4, 1.4,
    ]);
  });

  it('NaN/非数字元素 → gain 0、Q 1.4', () => {
    const got = sanitizeEqualizerPreset({
      id: 'x',
      name: 'n',
      gains: [Number.NaN, '3', null, undefined, {}, 1],
      qs: [Number.NaN, '2', null, undefined, {}, 2],
    });
    expect(got?.gains).toEqual([0, 0, 0, 0, 0, 1, 0, 0, 0, 0]);
    expect(got?.qs).toEqual([1.4, 1.4, 1.4, 1.4, 1.4, 2, 1.4, 1.4, 1.4, 1.4]);
  });

  it('越界元素 clamp 并量化到步进', () => {
    const got = sanitizeEqualizerPreset({
      id: 'x',
      name: 'n',
      gains: [
        20,
        -20,
        4.25,
        -4.24,
        Number.POSITIVE_INFINITY,
        Number.NEGATIVE_INFINITY,
      ],
      qs: [0.1, 12, 1.41, 4.1999999],
    });
    expect(got?.gains).toEqual([12, -12, 4.5, -4, 12, -12, 0, 0, 0, 0]);
    expect(got?.qs).toEqual([0.4, 8, 1.4, 4.2, 1.4, 1.4, 1.4, 1.4, 1.4, 1.4]);
  });

  it('不修改入参数组', () => {
    const gains = [20, ...new Array(9).fill(0)];
    sanitizeEqualizerPreset({ id: 'x', name: 'n', gains });
    expect(gains[0]).toBe(20);
  });
});

describe('sanitizeEqualizerSettings', () => {
  const fallback = { enabled: false, activeId: 'flat', customPresets: [] };

  it('缺省/非法顶层 → 默认值', () => {
    for (const bad of [null, undefined, 'eq', 0, [], true]) {
      expect(sanitizeEqualizerSettings(bad)).toEqual(fallback);
    }
  });

  it('enabled 非布尔 → false，合法布尔保留', () => {
    expect(sanitizeEqualizerSettings({ enabled: 'yes' }).enabled).toBe(false);
    expect(sanitizeEqualizerSettings({ enabled: true }).enabled).toBe(true);
    expect(sanitizeEqualizerSettings({ enabled: false }).enabled).toBe(false);
  });

  it('activeId 非字符串/空白 → flat，合法保留', () => {
    expect(sanitizeEqualizerSettings({ activeId: 9 }).activeId).toBe('flat');
    expect(sanitizeEqualizerSettings({ activeId: '  ' }).activeId).toBe('flat');
    expect(sanitizeEqualizerSettings({ activeId: 'bass-boost' }).activeId).toBe(
      'bass-boost',
    );
  });

  it('customPresets 非数组 → []，坏项丢弃', () => {
    expect(
      sanitizeEqualizerSettings({ customPresets: 'nope' }).customPresets,
    ).toEqual([]);
    const got = sanitizeEqualizerSettings({
      customPresets: [null, { id: 'a', name: 'A' }, 7, { name: '无名' }],
    });
    expect(got.customPresets).toHaveLength(1);
    expect(got.customPresets[0].id).toBe('a');
  });

  it('customPresets 超过 8 套截断', () => {
    const customPresets = Array.from({ length: 12 }, (_, i) => ({
      id: `p${i}`,
      name: `预设${i}`,
    }));
    expect(
      sanitizeEqualizerSettings({ customPresets }).customPresets,
    ).toHaveLength(EQ_CUSTOM_PRESET_LIMIT);
  });

  it('customPresets 逐项 sanitize（名字截断、增益量化）', () => {
    const got = sanitizeEqualizerSettings({
      customPresets: [{ id: 'a', name: 'x'.repeat(20), gains: [99] }],
    });
    expect(got.customPresets[0].name).toHaveLength(EQ_PRESET_NAME_MAX);
    expect(got.customPresets[0].gains[0]).toBe(12);
    expect(got.customPresets[0].gains).toHaveLength(10);
  });
});

describe('findPreset', () => {
  it('命中内置 preset', () => {
    expect(findPreset('bass-boost', [])?.name).toBe('低音增强');
  });

  it('命中自定义 preset', () => {
    const custom = sanitizeEqualizerPreset({ id: 'mine', name: '我的' });
    expect(custom).not.toBeNull();
    expect(findPreset('mine', [custom!])?.id).toBe('mine');
  });

  it('查不到 → undefined', () => {
    expect(findPreset('nope', [])).toBeUndefined();
  });
});

describe('buildBandParams', () => {
  it('band 0 为 lowshelf，忽略传入 Q 用默认 1.4', () => {
    expect(buildBandParams(0, 6, 4)).toEqual({
      type: 'lowshelf',
      frequency: 31,
      gain: 6,
      Q: EQ_Q_DEFAULT,
    });
  });

  it('band 9 为 highshelf，忽略传入 Q 用默认 1.4', () => {
    expect(buildBandParams(9, -3, 0.5)).toEqual({
      type: 'highshelf',
      frequency: 16000,
      gain: -3,
      Q: EQ_Q_DEFAULT,
    });
  });

  it('中间频段为 peaking，Q 透传', () => {
    expect(buildBandParams(4, 1.5, 2.5)).toEqual({
      type: 'peaking',
      frequency: 500,
      gain: 1.5,
      Q: 2.5,
    });
  });

  it('frequency 取对应频段、gain 透传', () => {
    for (let i = 0; i < EQ_BANDS.length; i++) {
      const params = buildBandParams(i, -0.5, 1.4);
      expect(params.frequency).toBe(EQ_BANDS[i]);
      expect(params.gain).toBe(-0.5);
    }
  });
});

describe('BUILTIN_PRESETS', () => {
  it('5 套、id 唯一且齐全', () => {
    expect(BUILTIN_PRESETS).toHaveLength(5);
    const ids = BUILTIN_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(5);
    expect(ids).toEqual([
      'flat',
      'bass-boost',
      'vocal',
      'treble-boost',
      'soft',
    ]);
  });

  it('name 存中文', () => {
    const names = Object.fromEntries(
      BUILTIN_PRESETS.map((p) => [p.id, p.name]),
    );
    expect(names).toEqual({
      flat: '平直',
      'bass-boost': '低音增强',
      vocal: '人声增强',
      'treble-boost': '高音增强',
      soft: '柔和',
    });
  });

  it('每套 gains 长度 10、在量化值域内；qs 全 1.4', () => {
    for (const preset of BUILTIN_PRESETS) {
      expect(preset.gains).toHaveLength(10);
      expect(preset.qs).toEqual(new Array(10).fill(EQ_Q_DEFAULT));
      for (const g of preset.gains) {
        expect(g).toBeGreaterThanOrEqual(EQ_GAIN_MIN);
        expect(g).toBeLessThanOrEqual(EQ_GAIN_MAX);
        expect(Number.isInteger(g / EQ_GAIN_STEP)).toBe(true);
      }
    }
  });

  it('flat 全 0', () => {
    expect(BUILTIN_PRESETS.find((p) => p.id === 'flat')?.gains).toEqual(
      new Array(10).fill(0),
    );
  });

  it('内置数值与预设表逐项一致', () => {
    const byId = Object.fromEntries(
      BUILTIN_PRESETS.map((p) => [p.id, p.gains]),
    );
    expect(byId.flat).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(byId['bass-boost']).toEqual([6, 5, 3.5, 1.5, 0, 0, 0, 0, 0, 0]);
    expect(byId.vocal).toEqual([0, -1, -1, 0, 1.5, 3, 3.5, 2.5, 1, 0]);
    expect(byId['treble-boost']).toEqual([0, 0, 0, 0, 0, 1.5, 2.5, 4, 4.5, 5]);
    expect(byId.soft).toEqual([
      -2, -1.5, -1, 0.5, 1.5, 1.5, 0.5, -1, -2.5, -3.5,
    ]);
  });
});

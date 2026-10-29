import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// node 环境没有 window，而 zustand v5 persist 默认存储为
// createJSONStorage(() => window.localStorage)，绑定失败会退化为纯内存（永不落盘）。
// setupFiles 已注入内存 localStorage，这里在 settingsStore 模块求值前
// 把 window 指向 globalThis（补 devicePixelRatio 默认值供 detectUiScale 使用），
// 使 persist 正常绑定存储。
vi.hoisted(() => {
  const g = globalThis as unknown as Record<string, unknown>;
  if (typeof g.window === 'undefined') {
    g.window = globalThis;
    if (typeof g.devicePixelRatio === 'undefined') {
      g.devicePixelRatio = 1;
    }
  }
});

import { BUILTIN_PRESETS } from '../utils/equalizer';
import {
  applySettingsSnapshot,
  getSettingsSnapshot,
  useSettingsStore,
} from './settingsStore';

/** 快照白名单期望值：在测试中独立硬编码，防止实现侧 SNAPSHOT_KEYS 漂移 */
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

/** 全平增益 / 默认 Q：测试内独立硬编码，防止实现侧常量漂移。 */
const FLAT_GAINS = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const DEFAULT_QS = [1.4, 1.4, 1.4, 1.4, 1.4, 1.4, 1.4, 1.4, 1.4, 1.4];

/** 自定义 preset 夹具（10 段，默认全平）。 */
function makePreset(id: string, name = id, gains: number[] = FLAT_GAINS) {
  return { id, name, gains: [...gains], qs: [...DEFAULT_QS] };
}

/** 重置为 store 创建时的初始状态（含内部标记 uiScaleAuto）。 */
function resetStore() {
  localStorage.clear();
  useSettingsStore.setState(useSettingsStore.getInitialState(), true);
}

/** 以指定 equalizer 整体替换（模拟持久化/快照写入的自定义 preset 场景）。 */
function seedEqualizer(
  equalizer: Partial<{
    enabled: boolean;
    activeId: string;
    customPresets: ReturnType<typeof makePreset>[];
  }>,
) {
  useSettingsStore.setState({
    equalizer: {
      enabled: false,
      activeId: 'flat',
      customPresets: [],
      ...equalizer,
    },
  });
}

/** 读取 persist 落盘 blob 的 state 部分。 */
function persistedState(): Record<string, unknown> {
  const raw = localStorage.getItem('kiku-settings');
  expect(raw).toBeTruthy();
  return (JSON.parse(raw as string) as { state: Record<string, unknown> })
    .state;
}

/** 用全新模块实例跑「模块求值期真实水合」：localStorage 必须在动态 import 前种好。 */
async function hydrateFreshModule(blob: Record<string, unknown>) {
  localStorage.clear();
  localStorage.setItem(
    'kiku-settings',
    JSON.stringify({ state: blob, version: 0 }),
  );
  vi.resetModules();
  const mod = await import('./settingsStore');
  // hydrate 在模块求值时启动，merge/落 state 在微任务链里执行：等一拍再断言
  await new Promise((resolve) => setTimeout(resolve, 0));
  return mod.useSettingsStore;
}

// 默认值断言：zustand v5 的 getInitialState() 返回 store 创建时的初始快照，
// 不受同文件其他用例 setState / persist 水合影响（store 是模块单例），
// 因此可独立于下方 beforeEach 的状态重置直接断言，避免「先 setState 再验默认值」的恒真问题。
describe('settingsStore 默认值', () => {
  it('videoMode 默认为 audio（仅音频）', () => {
    expect(useSettingsStore.getInitialState().videoMode).toBe('audio');
  });

  it('worksPaginationMode 默认为 paginate', () => {
    expect(useSettingsStore.getInitialState().worksPaginationMode).toBe(
      'paginate',
    );
  });

  it('worksPaginatorPosition 默认为 both', () => {
    expect(useSettingsStore.getInitialState().worksPaginatorPosition).toBe(
      'both',
    );
  });

  it('worksHistoryStrip 默认为 true', () => {
    expect(useSettingsStore.getInitialState().worksHistoryStrip).toBe(true);
  });

  it('worksPageSize 默认为 20', () => {
    expect(useSettingsStore.getInitialState().worksPageSize).toBe(20);
  });

  it('contentWidth 默认为 wide', () => {
    expect(useSettingsStore.getInitialState().contentWidth).toBe('wide');
  });
});

describe('settingsStore contentWidth', () => {
  beforeEach(() => {
    localStorage.clear();
    useSettingsStore.setState({ contentWidth: 'standard' });
  });

  it('setContentWidth 切换到 wide', () => {
    useSettingsStore.getState().setContentWidth('wide');
    expect(useSettingsStore.getState().contentWidth).toBe('wide');
  });
});

describe('settingsStore worksPaginationMode', () => {
  beforeEach(() => {
    localStorage.clear();
    useSettingsStore.setState({ worksPaginationMode: 'paginate' });
  });

  it('setWorksPaginationMode 切换到 infinite', () => {
    useSettingsStore.getState().setWorksPaginationMode('infinite');
    expect(useSettingsStore.getState().worksPaginationMode).toBe('infinite');
  });
});

describe('settingsStore worksPaginatorPosition', () => {
  beforeEach(() => {
    localStorage.clear();
    useSettingsStore.setState({ worksPaginatorPosition: 'both' });
  });

  it('setWorksPaginatorPosition 切换到 top', () => {
    useSettingsStore.getState().setWorksPaginatorPosition('top');
    expect(useSettingsStore.getState().worksPaginatorPosition).toBe('top');
  });
});

describe('settingsStore worksHistoryStrip', () => {
  beforeEach(() => {
    localStorage.clear();
    useSettingsStore.setState({ worksHistoryStrip: true });
  });

  it('setShowHistoryStrip 切换到 false', () => {
    useSettingsStore.getState().setShowHistoryStrip(false);
    expect(useSettingsStore.getState().worksHistoryStrip).toBe(false);
  });
});

describe('settingsStore worksPageSize', () => {
  beforeEach(() => {
    localStorage.clear();
    useSettingsStore.setState({ worksPageSize: 20 });
  });

  it('setWorksPageSize 置为 100', () => {
    useSettingsStore.getState().setWorksPageSize(100);
    expect(useSettingsStore.getState().worksPageSize).toBe(100);
  });

  it('setWorksPageSize 非法档位 500 → 回落 20', () => {
    useSettingsStore.getState().setWorksPageSize(500);
    expect(useSettingsStore.getState().worksPageSize).toBe(20);
  });
});

describe('settingsStore worksPageSize 水合消毒', () => {
  // 水合用例会改写 localStorage 与 store 单例状态：前后都恢复，避免污染其余用例
  beforeEach(() => {
    localStorage.clear();
    useSettingsStore.setState(useSettingsStore.getInitialState(), true);
  });

  afterEach(() => {
    localStorage.clear();
    useSettingsStore.setState(useSettingsStore.getInitialState(), true);
  });

  it('persist 水合：持久化非法档位 500 → 回落 20', async () => {
    useSettingsStore.setState({ worksPageSize: 10 });
    localStorage.setItem(
      'kiku-settings',
      JSON.stringify({ state: { worksPageSize: 500 }, version: 0 }),
    );
    await useSettingsStore.persist.rehydrate();
    expect(useSettingsStore.getState().worksPageSize).toBe(20);
  });

  it('persist 水合：blob 缺失 worksPageSize → 回落 20', async () => {
    // 先制造非默认内存值，证明「缺失」也走消毒分支（而非依赖初始值恰好为 20）
    useSettingsStore.setState({ worksPageSize: 500 });
    localStorage.setItem(
      'kiku-settings',
      JSON.stringify({ state: {}, version: 0 }),
    );
    await useSettingsStore.persist.rehydrate();
    expect(useSettingsStore.getState().worksPageSize).toBe(20);
  });
});

describe('settingsStore worksPageSize 初次水合（模块求值路径）', () => {
  // 生产路径：persist 在模块求值期间自行 hydrate，而不是测试手动调用 rehydrate()。
  // 用 vi.resetModules + 动态 import 拿到全新模块实例（hydrateFreshModule）。
  beforeEach(() => {
    localStorage.clear();
    useSettingsStore.setState(useSettingsStore.getInitialState(), true);
  });

  afterEach(() => {
    localStorage.clear();
    useSettingsStore.setState(useSettingsStore.getInitialState(), true);
  });

  it('初次水合：持久化非法档位 500 → 回落 20', async () => {
    const store = await hydrateFreshModule({ worksPageSize: 500 });
    expect(store.getState().worksPageSize).toBe(20);
  });

  it('初次水合：合法档位 50 原样保留', async () => {
    const store = await hydrateFreshModule({ worksPageSize: 50 });
    expect(store.getState().worksPageSize).toBe(50);
  });

  it('初次水合：blob 缺失 worksPageSize → 回落 20', async () => {
    const store = await hydrateFreshModule({});
    expect(store.getState().worksPageSize).toBe(20);
  });
});

describe('settingsStore contentWidth 水合消毒', () => {
  beforeEach(() => {
    localStorage.clear();
    useSettingsStore.setState(useSettingsStore.getInitialState(), true);
  });

  afterEach(() => {
    localStorage.clear();
    useSettingsStore.setState(useSettingsStore.getInitialState(), true);
  });

  it('persist 水合：持久化非法档位 → 回落默认 wide', async () => {
    // 先置为合法非默认值（standard），排除「值恰好未变」的假阳性
    useSettingsStore.setState({ contentWidth: 'standard' });
    localStorage.setItem(
      'kiku-settings',
      JSON.stringify({ state: { contentWidth: 'super' }, version: 0 }),
    );
    await useSettingsStore.persist.rehydrate();
    expect(useSettingsStore.getState().contentWidth).toBe('wide');
  });

  it('初次水合：合法档位 ultra 原样保留', async () => {
    const store = await hydrateFreshModule({ contentWidth: 'ultra' });
    expect(store.getState().contentWidth).toBe('ultra');
  });

  it('初次水合：持久化非法档位 → 回落默认 wide', async () => {
    const store = await hydrateFreshModule({ contentWidth: 'super' });
    expect(store.getState().contentWidth).toBe('wide');
  });

  it('初次水合：blob 缺失 contentWidth → 保持默认 wide', async () => {
    const store = await hydrateFreshModule({});
    expect(store.getState().contentWidth).toBe('wide');
  });
});

describe('settingsStore 快照导出/应用', () => {
  // 完整重置为 store 创建时的初始状态（含内部标记 uiScaleAuto），避免受其他用例影响
  beforeEach(() => {
    localStorage.clear();
    useSettingsStore.setState(useSettingsStore.getInitialState(), true);
  });

  it('getSettingsSnapshot 含全部白名单字段，不含 uiScaleAuto 与 setter', () => {
    const snapshot = getSettingsSnapshot();
    expect(Object.keys(snapshot).sort()).toEqual([...SNAPSHOT_KEYS].sort());
    expect(snapshot).not.toHaveProperty('uiScaleAuto');
    for (const value of Object.values(snapshot)) {
      expect(typeof value).not.toBe('function');
    }
  });

  it('applySettingsSnapshot 应用白名单字段：夹取 uiScale、忽略未知字段、其余保持原值', () => {
    applySettingsSnapshot({ colorMode: 'dark', uiScale: 200, unknownKey: 1 });
    const s = useSettingsStore.getState();
    expect(s.colorMode).toBe('dark');
    expect(s.uiScale).toBe(130);
    expect(
      (s as unknown as Record<string, unknown>).unknownKey,
    ).toBeUndefined();
    // 其余字段保持原值（含内部标记 uiScaleAuto 不被触碰）
    expect(s.dynamicColor).toBe(true);
    expect(s.mediaNotification).toBe(true);
    expect(s.floatingLyrics).toEqual({
      enabled: false,
      fontSize: 14,
      lines: 2,
      opacity: 0.8,
    });
    expect(s.preview).toEqual({ textFontSize: 14, textWordWrap: true });
    expect(s.coverBlurMode).toBe('hover');
    expect(s.timeDisplayMode).toBe('total');
    expect(s.coverAspectRatio).toBe('original');
    expect(s.worksPaginationMode).toBe('paginate');
    expect(s.worksPaginatorPosition).toBe('both');
    expect(s.worksHistoryStrip).toBe(true);
    expect(s.contentWidth).toBe('wide');
    expect(s.uiScaleAuto).toBe(true);
  });

  it('applySettingsSnapshot：非法 contentWidth → 回落默认 wide', () => {
    // 先置为合法非默认值，确保断言验证的是消毒兜底，而非「字段被整体忽略」
    useSettingsStore.setState({ contentWidth: 'standard' });
    applySettingsSnapshot({ contentWidth: 'bogus' });
    expect(useSettingsStore.getState().contentWidth).toBe('wide');
  });

  it('applySettingsSnapshot：合法 contentWidth(full) → 原样应用', () => {
    applySettingsSnapshot({ contentWidth: 'full' });
    expect(useSettingsStore.getState().contentWidth).toBe('full');
  });

  it('applySettingsSnapshot：非法 worksPageSize(37) → 回落 20', () => {
    // 先置为合法非默认值，确保断言验证的是夹取兜底，而非「字段被整体忽略」
    useSettingsStore.setState({ worksPageSize: 100 });
    applySettingsSnapshot({ worksPageSize: 37 });
    expect(useSettingsStore.getState().worksPageSize).toBe(20);
  });

  it('applySettingsSnapshot：合法 worksPageSize(100) → 原样应用', () => {
    applySettingsSnapshot({ worksPageSize: 100 });
    expect(useSettingsStore.getState().worksPageSize).toBe(100);
  });

  it('applySettingsSnapshot({}) 不改变任何 state 字段', () => {
    const before = useSettingsStore.getState();
    applySettingsSnapshot({});
    expect(useSettingsStore.getState()).toEqual(before);
  });

  it('应用后 persist 落盘：localStorage 中为新值', () => {
    applySettingsSnapshot({ colorMode: 'dark', uiScale: 200 });
    const raw = localStorage.getItem('kiku-settings');
    expect(raw).toBeTruthy();
    const persisted = JSON.parse(raw as string) as {
      state: Record<string, unknown>;
    };
    expect(persisted.state.colorMode).toBe('dark');
    expect(persisted.state.uiScale).toBe(130);
  });
});

describe('settingsStore equalizer 默认值', () => {
  it('equalizer 默认关闭，activeId flat，无自定义 preset', () => {
    expect(useSettingsStore.getInitialState().equalizer).toEqual({
      enabled: false,
      activeId: 'flat',
      customPresets: [],
    });
  });

  it('eqCurrent 默认全平（0 dB / Q 1.4）', () => {
    expect(useSettingsStore.getInitialState().eqCurrent).toEqual({
      gains: FLAT_GAINS,
      qs: DEFAULT_QS,
    });
  });
});

describe('settingsStore equalizer setEqualizerEnabled', () => {
  beforeEach(resetStore);

  it('开关切换且保留 activeId / customPresets', () => {
    seedEqualizer({ activeId: 'vocal', customPresets: [makePreset('c1')] });
    useSettingsStore.getState().setEqualizerEnabled(true);
    expect(useSettingsStore.getState().equalizer).toEqual({
      enabled: true,
      activeId: 'vocal',
      customPresets: [makePreset('c1')],
    });
    useSettingsStore.getState().setEqualizerEnabled(false);
    expect(useSettingsStore.getState().equalizer.enabled).toBe(false);
  });
});

describe('settingsStore equalizer selectEqualizerPreset', () => {
  beforeEach(resetStore);

  it('内置 preset：写 activeId 并载入其 gains/qs', () => {
    useSettingsStore.getState().selectEqualizerPreset('bass-boost');
    const s = useSettingsStore.getState();
    expect(s.equalizer.activeId).toBe('bass-boost');
    expect(s.eqCurrent.gains).toEqual([6, 5, 3.5, 1.5, 0, 0, 0, 0, 0, 0]);
    expect(s.eqCurrent.qs).toEqual(DEFAULT_QS);
  });

  it('自定义 preset：载入其 gains/qs', () => {
    const gains = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    seedEqualizer({ customPresets: [makePreset('c1', '自定义', gains)] });
    useSettingsStore.getState().selectEqualizerPreset('c1');
    const s = useSettingsStore.getState();
    expect(s.equalizer.activeId).toBe('c1');
    expect(s.eqCurrent.gains).toEqual(gains);
  });

  it('未知 id：回落 flat 并载入全平', () => {
    useSettingsStore.getState().selectEqualizerPreset('bass-boost');
    useSettingsStore.getState().selectEqualizerPreset('nope');
    const s = useSettingsStore.getState();
    expect(s.equalizer.activeId).toBe('flat');
    expect(s.eqCurrent.gains).toEqual(FLAT_GAINS);
    expect(s.eqCurrent.qs).toEqual(DEFAULT_QS);
  });

  it('载入内置 preset 不与 BUILTIN_PRESETS 共享数组（深拷贝）', () => {
    useSettingsStore.getState().selectEqualizerPreset('bass-boost');
    const builtin = BUILTIN_PRESETS.find((p) => p.id === 'bass-boost');
    expect(builtin).toBeTruthy();
    const s = useSettingsStore.getState();
    expect(s.eqCurrent.gains).not.toBe(builtin?.gains);
    expect(s.eqCurrent.qs).not.toBe(builtin?.qs);
    // 拖滑条只动运行态，内置 preset 本体不受污染
    useSettingsStore.getState().updateEqualizerBand(0, -12);
    expect(builtin?.gains[0]).toBe(6);
    expect(s.equalizer.customPresets).toHaveLength(0);
  });
});

describe('settingsStore equalizer updateEqualizerBand', () => {
  beforeEach(resetStore);

  it('内置选中：只改 eqCurrent，不回写', () => {
    useSettingsStore.getState().selectEqualizerPreset('vocal');
    const builtin = BUILTIN_PRESETS.find((p) => p.id === 'vocal');
    const builtinGains = [...(builtin?.gains ?? [])];
    useSettingsStore.getState().updateEqualizerBand(3, 5.3);
    const s = useSettingsStore.getState();
    // 5.3 → 量化到 0.5 网格
    expect(s.eqCurrent.gains[3]).toBe(5.5);
    expect(builtin?.gains).toEqual(builtinGains);
    expect(s.equalizer.customPresets).toHaveLength(0);
  });

  it('自定义选中：写回 customPresets 并持久化', () => {
    seedEqualizer({ customPresets: [makePreset('c1')] });
    useSettingsStore.getState().selectEqualizerPreset('c1');
    useSettingsStore.getState().updateEqualizerBand(2, 3.2);
    const s = useSettingsStore.getState();
    // 3.2 → 量化到 0.5 网格
    expect(s.eqCurrent.gains[2]).toBe(3);
    expect(s.equalizer.customPresets[0].gains[2]).toBe(3);
    // 写回的其余频段保持原值
    expect(s.equalizer.customPresets[0].gains[3]).toBe(0);
    const persisted = persistedState() as {
      equalizer: { customPresets: { gains: number[] }[] };
    };
    expect(persisted.equalizer.customPresets[0].gains[2]).toBe(3);
  });

  it('增益夹取到 ±12', () => {
    useSettingsStore.getState().updateEqualizerBand(0, 99);
    expect(useSettingsStore.getState().eqCurrent.gains[0]).toBe(12);
    useSettingsStore.getState().updateEqualizerBand(0, -99);
    expect(useSettingsStore.getState().eqCurrent.gains[0]).toBe(-12);
  });

  it('非有限数 / 越界索引 no-op', () => {
    const before = useSettingsStore.getState().eqCurrent;
    useSettingsStore.getState().updateEqualizerBand(0, Number.NaN);
    useSettingsStore
      .getState()
      .updateEqualizerBand(0, Number.POSITIVE_INFINITY);
    useSettingsStore.getState().updateEqualizerBand(42, 3);
    useSettingsStore.getState().updateEqualizerBand(-1, 3);
    expect(useSettingsStore.getState().eqCurrent).toBe(before);
  });
});

describe('settingsStore equalizer updateEqualizerQ', () => {
  beforeEach(resetStore);

  it('端点频段（i=0 / i=9）忽略 Q 改动', () => {
    const before = useSettingsStore.getState().eqCurrent;
    useSettingsStore.getState().updateEqualizerQ(0, 5);
    useSettingsStore.getState().updateEqualizerQ(9, 5);
    expect(useSettingsStore.getState().eqCurrent).toBe(before);
  });

  it('中间频段：量化到 0.1 并写回自定义 preset', () => {
    seedEqualizer({ customPresets: [makePreset('c1')] });
    useSettingsStore.getState().selectEqualizerPreset('c1');
    useSettingsStore.getState().updateEqualizerQ(4, 2.34);
    const s = useSettingsStore.getState();
    expect(s.eqCurrent.qs[4]).toBe(2.3);
    expect(s.equalizer.customPresets[0].qs[4]).toBe(2.3);
  });

  it('Q 夹取到 0.4..8；非有限数 no-op', () => {
    useSettingsStore.getState().updateEqualizerQ(1, 99);
    expect(useSettingsStore.getState().eqCurrent.qs[1]).toBe(8);
    useSettingsStore.getState().updateEqualizerQ(1, 0);
    expect(useSettingsStore.getState().eqCurrent.qs[1]).toBe(0.4);
    const before = useSettingsStore.getState().eqCurrent;
    useSettingsStore.getState().updateEqualizerQ(1, Number.NaN);
    expect(useSettingsStore.getState().eqCurrent).toBe(before);
  });
});

describe('settingsStore equalizer 自定义 preset 生命周期', () => {
  beforeEach(resetStore);

  it('addEqualizerCustomPreset：快照 eqCurrent、切 activeId、返回新 id', () => {
    useSettingsStore.getState().selectEqualizerPreset('bass-boost');
    const id = useSettingsStore.getState().addEqualizerCustomPreset('我的预设');
    expect(id).not.toBe('');
    const s = useSettingsStore.getState();
    expect(s.equalizer.activeId).toBe(id);
    expect(s.equalizer.customPresets).toHaveLength(1);
    const preset = s.equalizer.customPresets[0];
    expect(preset.id).toBe(id);
    expect(preset.name).toBe('我的预设');
    expect(preset.gains).toEqual([6, 5, 3.5, 1.5, 0, 0, 0, 0, 0, 0]);
    expect(preset.qs).toEqual(DEFAULT_QS);
    // 深拷贝：快照不与运行态共享数组
    expect(preset.gains).not.toBe(s.eqCurrent.gains);
    expect(preset.qs).not.toBe(s.eqCurrent.qs);
  });

  it('name 去首尾空白并截断到 16 字符', () => {
    const name = `  ${'x'.repeat(30)}  `;
    useSettingsStore.getState().addEqualizerCustomPreset(name);
    expect(useSettingsStore.getState().equalizer.customPresets[0].name).toBe(
      'x'.repeat(16),
    );
  });

  it('name 空白：no-op 返回空串且不新增', () => {
    expect(useSettingsStore.getState().addEqualizerCustomPreset('   ')).toBe(
      '',
    );
    expect(useSettingsStore.getState().equalizer.customPresets).toHaveLength(0);
    expect(useSettingsStore.getState().equalizer.activeId).toBe('flat');
  });

  it('已满 8 套：第 9 套 no-op 返回空串，activeId 不变', () => {
    for (let i = 0; i < 8; i++) {
      expect(
        useSettingsStore.getState().addEqualizerCustomPreset(`p${i}`),
      ).not.toBe('');
    }
    const activeBefore = useSettingsStore.getState().equalizer.activeId;
    expect(useSettingsStore.getState().addEqualizerCustomPreset('p8')).toBe('');
    const s = useSettingsStore.getState();
    expect(s.equalizer.customPresets).toHaveLength(8);
    expect(s.equalizer.activeId).toBe(activeBefore);
  });

  it('deleteEqualizerCustomPreset：删 active → 回落 flat', () => {
    const id = useSettingsStore.getState().addEqualizerCustomPreset('temp');
    useSettingsStore.setState({
      eqCurrent: { gains: FLAT_GAINS, qs: DEFAULT_QS },
    });
    useSettingsStore.getState().updateEqualizerBand(0, 6);
    useSettingsStore.getState().deleteEqualizerCustomPreset(id);
    const s = useSettingsStore.getState();
    expect(s.equalizer.customPresets).toHaveLength(0);
    expect(s.equalizer.activeId).toBe('flat');
    expect(s.eqCurrent.gains).toEqual(FLAT_GAINS);
    expect(s.eqCurrent.qs).toEqual(DEFAULT_QS);
  });

  it('deleteEqualizerCustomPreset：删非 active → active 与运行态不变', () => {
    seedEqualizer({
      activeId: 'c1',
      customPresets: [
        makePreset('c1', 'A', [1, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
        makePreset('c2'),
      ],
    });
    useSettingsStore.getState().selectEqualizerPreset('c1');
    const currentBefore = useSettingsStore.getState().eqCurrent;
    useSettingsStore.getState().deleteEqualizerCustomPreset('c2');
    const s = useSettingsStore.getState();
    expect(s.equalizer.customPresets.map((p) => p.id)).toEqual(['c1']);
    expect(s.equalizer.activeId).toBe('c1');
    expect(s.eqCurrent).toBe(currentBefore);
  });

  it('deleteEqualizerCustomPreset：重复 id 只删第一处（与写回对称）', () => {
    seedEqualizer({
      activeId: 'flat',
      customPresets: [makePreset('dup'), makePreset('dup')],
    });
    useSettingsStore.getState().deleteEqualizerCustomPreset('dup');
    expect(useSettingsStore.getState().equalizer.customPresets).toHaveLength(1);
  });

  it('deleteEqualizerCustomPreset：内置 id 无操作', () => {
    seedEqualizer({
      activeId: 'vocal',
      customPresets: [makePreset('c1')],
    });
    useSettingsStore.getState().selectEqualizerPreset('vocal');
    useSettingsStore.getState().deleteEqualizerCustomPreset('vocal');
    const s = useSettingsStore.getState();
    expect(s.equalizer.activeId).toBe('vocal');
    expect(s.equalizer.customPresets.map((p) => p.id)).toEqual(['c1']);
  });
});

describe('settingsStore equalizer 水合消毒', () => {
  beforeEach(resetStore);
  afterEach(resetStore);

  it('blob 缺失 equalizer → 回落默认（含 eqCurrent 全平）', async () => {
    const store = await hydrateFreshModule({});
    expect(store.getState().equalizer).toEqual({
      enabled: false,
      activeId: 'flat',
      customPresets: [],
    });
    expect(store.getState().eqCurrent).toEqual({
      gains: FLAT_GAINS,
      qs: DEFAULT_QS,
    });
  });

  it('blob 非法 equalizer（字符串）→ 回落默认', async () => {
    const store = await hydrateFreshModule({ equalizer: 'bogus' });
    expect(store.getState().equalizer).toEqual({
      enabled: false,
      activeId: 'flat',
      customPresets: [],
    });
  });

  it('blob 字段逐项消毒：enabled 非布尔→false、activeId 空白→flat、无 id 的 preset 丢弃', async () => {
    const store = await hydrateFreshModule({
      equalizer: {
        enabled: 'yes',
        activeId: '   ',
        customPresets: [{ name: 'no-id' }, makePreset('c1')],
      },
    });
    const s = store.getState();
    expect(s.equalizer.enabled).toBe(false);
    expect(s.equalizer.activeId).toBe('flat');
    expect(s.equalizer.customPresets.map((p) => p.id)).toEqual(['c1']);
  });

  it('blob 超 8 套自定义 preset → 截断到 8', async () => {
    const nine = Array.from({ length: 9 }, (_, i) => makePreset(`c${i}`));
    const store = await hydrateFreshModule({
      equalizer: { enabled: true, activeId: 'flat', customPresets: nine },
    });
    expect(store.getState().equalizer.customPresets).toHaveLength(8);
  });

  it('合法 blob 原样保留，eqCurrent 跟随 activeId', async () => {
    const store = await hydrateFreshModule({
      equalizer: { enabled: true, activeId: 'bass-boost', customPresets: [] },
    });
    const s = store.getState();
    expect(s.equalizer.enabled).toBe(true);
    expect(s.equalizer.activeId).toBe('bass-boost');
    expect(s.eqCurrent.gains).toEqual([6, 5, 3.5, 1.5, 0, 0, 0, 0, 0, 0]);
  });

  it('blob 悬空 activeId（preset 不存在）→ 归一化 flat，eqCurrent 全 0', async () => {
    const store = await hydrateFreshModule({
      equalizer: {
        enabled: true,
        activeId: 'custom-gone',
        customPresets: [
          makePreset('c1', 'A', [6, 5, 3.5, 1.5, 0, 0, 0, 0, 0, 0]),
        ],
      },
    });
    const s = store.getState();
    expect(s.equalizer.activeId).toBe('flat');
    expect(s.eqCurrent.gains).toEqual(FLAT_GAINS);
    expect(s.eqCurrent.qs).toEqual(DEFAULT_QS);
  });
});

describe('settingsStore equalizer 快照应用', () => {
  beforeEach(resetStore);

  it('getSettingsSnapshot 含 equalizer，不含 eqCurrent', () => {
    const snapshot = getSettingsSnapshot();
    expect(snapshot).toHaveProperty('equalizer');
    expect(snapshot).not.toHaveProperty('eqCurrent');
  });

  it('含 equalizer 键 → 消毒后应用', () => {
    applySettingsSnapshot({
      equalizer: {
        enabled: true,
        activeId: 'treble-boost',
        customPresets: [makePreset('c1')],
      },
    });
    const s = useSettingsStore.getState();
    expect(s.equalizer.enabled).toBe(true);
    expect(s.equalizer.activeId).toBe('treble-boost');
    expect(s.equalizer.customPresets.map((p) => p.id)).toEqual(['c1']);
    const builtin = BUILTIN_PRESETS.find((p) => p.id === 'treble-boost');
    expect(s.eqCurrent.gains).toEqual(builtin?.gains);
  });

  it('含非法 equalizer → 消毒为默认值', () => {
    seedEqualizer({ enabled: true, activeId: 'vocal' });
    applySettingsSnapshot({ equalizer: 42 });
    expect(useSettingsStore.getState().equalizer).toEqual({
      enabled: false,
      activeId: 'flat',
      customPresets: [],
    });
  });

  it('悬空 activeId（preset 不存在）→ 归一化 flat，eqCurrent 全 0', () => {
    applySettingsSnapshot({
      equalizer: {
        enabled: true,
        activeId: 'custom-gone',
        customPresets: [
          makePreset('c1', 'A', [6, 5, 3.5, 1.5, 0, 0, 0, 0, 0, 0]),
        ],
      },
    });
    const s = useSettingsStore.getState();
    expect(s.equalizer.activeId).toBe('flat');
    expect(s.eqCurrent.gains).toEqual(FLAT_GAINS);
    expect(s.eqCurrent.qs).toEqual(DEFAULT_QS);
  });

  it('含超 8 套 preset → 截断到 8', () => {
    const nine = Array.from({ length: 9 }, (_, i) => makePreset(`c${i}`));
    applySettingsSnapshot({
      equalizer: { enabled: true, activeId: 'flat', customPresets: nine },
    });
    expect(useSettingsStore.getState().equalizer.customPresets).toHaveLength(8);
  });

  it('不含 equalizer 键 → equalizer 不被触碰', () => {
    seedEqualizer({
      enabled: true,
      activeId: 'vocal',
      customPresets: [makePreset('c1')],
    });
    const before = useSettingsStore.getState().equalizer;
    applySettingsSnapshot({ colorMode: 'dark' });
    expect(useSettingsStore.getState().equalizer).toBe(before);
  });

  it('eqCurrent 不落盘：persist blob 无 eqCurrent', () => {
    useSettingsStore.getState().selectEqualizerPreset('soft');
    const persisted = persistedState();
    expect(persisted).not.toHaveProperty('eqCurrent');
    expect(persisted.equalizer).toBeTruthy();
  });
});

describe('settingsStore equalizer 快照体积', () => {
  beforeEach(resetStore);

  it('满载（8 套 × 16 字符 name）快照 < 4096 字节', () => {
    const gains = [-12, -11.5, -11, -10.5, -10, -9.5, -9, -8.5, -8, -7.5];
    const qs = [7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 8];
    const dense = Array.from({ length: 8 }, (_, i) => ({
      id: `custom-lz9x0abc-${i}`,
      name: 'ABCDEFGHIJKLMNOP',
      gains: [...gains],
      qs: [...qs],
    }));
    applySettingsSnapshot({
      equalizer: { enabled: true, activeId: dense[0].id, customPresets: dense },
    });
    const equalizer = useSettingsStore.getState().equalizer;
    expect(equalizer.customPresets).toHaveLength(8);
    expect(equalizer.customPresets.every((p) => p.name.length === 16)).toBe(
      true,
    );
    expect(JSON.stringify(getSettingsSnapshot()).length).toBeLessThan(4096);
  });
});

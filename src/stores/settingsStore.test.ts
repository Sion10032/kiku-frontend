import { describe, it, expect, beforeEach, vi } from 'vitest';

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
  'floatingLyrics',
  'preview',
  'coverBlurMode',
  'timeDisplayMode',
  'worksPaginationMode',
  'worksPaginatorPosition',
  'worksHistoryStrip',
  'uiScale',
] as const;

// 默认值断言：zustand v5 的 getInitialState() 返回 store 创建时的初始快照，
// 不受同文件其他用例 setState / persist 水合影响（store 是模块单例），
// 因此可独立于下方 beforeEach 的状态重置直接断言，避免「先 setState 再验默认值」的恒真问题。
describe('settingsStore 默认值', () => {
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
    expect(s.worksPaginationMode).toBe('paginate');
    expect(s.worksPaginatorPosition).toBe('both');
    expect(s.worksHistoryStrip).toBe(true);
    expect(s.uiScaleAuto).toBe(true);
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

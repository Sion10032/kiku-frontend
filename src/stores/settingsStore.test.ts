import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsStore } from './settingsStore';

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

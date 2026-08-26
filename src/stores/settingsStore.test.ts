import { describe, it, expect, beforeEach } from 'vitest';
// 须最先导入：node 环境无 localStorage，store 的 persist 需在创建时绑定此内存实现
import '../test/localStorageStub';
import { useSettingsStore } from './settingsStore';

describe('settingsStore worksPaginationMode', () => {
  beforeEach(() => {
    localStorage.clear();
    useSettingsStore.setState({ worksPaginationMode: 'paginate' });
  });

  it('默认为 paginate', () => {
    expect(useSettingsStore.getState().worksPaginationMode).toBe('paginate');
  });

  it('setWorksPaginationMode 切换到 infinite', () => {
    useSettingsStore.getState().setWorksPaginationMode('infinite');
    expect(useSettingsStore.getState().worksPaginationMode).toBe('infinite');
  });
});

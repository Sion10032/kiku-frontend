import { describe, expect, it } from 'vitest';
import en from './en.json';
import zhCN from './zh-CN.json';

/**
 * 剥离 i18next 复数后缀得到基础 key。
 *
 * 两份字典的复数 key 天然不对称：zh 复数规则只有 other（仅 _other），
 * en 有 one/other（_one + _other），故按基础 key 比较集合相等。
 */
function baseKey(key: string): string {
  return key.replace(/_(one|other)$/, '');
}

describe('locale parity', () => {
  it('两份字典基础 key 集合一致（剥离 _one/_other 复数后缀）', () => {
    const zhBase = [...new Set(Object.keys(zhCN).map(baseKey))].sort();
    const enBase = [...new Set(Object.keys(en).map(baseKey))].sort();
    expect(zhBase).toEqual(enBase);
  });

  it('无空值（两份字典）', () => {
    for (const [key, value] of Object.entries(zhCN)) {
      expect(String(value).trim().length, `zh-CN: ${key}`).toBeGreaterThan(0);
    }
    for (const [key, value] of Object.entries(en)) {
      expect(String(value).trim().length, `en: ${key}`).toBeGreaterThan(0);
    }
  });
});

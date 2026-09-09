import { describe, expect, it } from 'vitest';
import {
  LANG_STORAGE_KEY,
  matchLanguageList,
  resolveInitialLanguage,
} from './index';

describe('resolveInitialLanguage', () => {
  const storage = (value: string | null) => ({
    getItem: (key: string) => (key === LANG_STORAGE_KEY ? value : null),
  });

  it('无存储、无浏览器语言 → zh-CN', () => {
    expect(resolveInitialLanguage(undefined, [])).toBe('zh-CN');
  });

  it('localStorage 已选语言优先（含非法值校验）', () => {
    expect(resolveInitialLanguage(storage('en'), ['zh-CN'])).toBe('en');
    expect(resolveInitialLanguage(storage('xx'), ['zh-CN'])).toBe('zh-CN');
  });

  it('浏览器语言按序匹配（前缀归并同后端规则）', () => {
    expect(resolveInitialLanguage(undefined, ['ja-JP', 'en-US'])).toBe('en');
    expect(resolveInitialLanguage(undefined, ['zh-TW'])).toBe('zh-CN');
    expect(resolveInitialLanguage(undefined, ['fr'])).toBe('zh-CN');
  });
});

describe('matchLanguageList', () => {
  it('大小写不敏感、精确优先', () => {
    expect(matchLanguageList(['EN'])).toBe('en');
    expect(matchLanguageList(['zh-cn'])).toBe('zh-CN');
  });
});

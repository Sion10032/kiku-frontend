import i18next from 'i18next';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { getDeviceName, inferDeviceName, setDeviceName } from './deviceName';
// getDeviceName 兕底走 i18next.t 翻译；断言 zh-CN 文案，需先初始化并固定语言
// （node 测试环境 navigator.languages 为 en-US，init 默认会解析到 en）
import '../i18n';

beforeAll(async () => {
  await i18next.changeLanguage('zh-CN');
});

const UA_WINDOWS_CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const UA_ANDROID_FIREFOX =
  'Mozilla/5.0 (Android 14; Mobile; rv:125.0) Gecko/125.0 Firefox/125.0';
const UA_MAC_SAFARI =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';
const UA_UNKNOWN = 'SomeUnknownBrowser/1.0';

afterEach(() => {
  // navigator 由 vi.stubGlobal 注入（node 环境无 UA）；localStorage
  // 来自 src/test/setup.ts 的内存实现，直接 clear 重置。
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('inferDeviceName', () => {
  it('Windows NT + Chrome UA → Windows · Chrome', () => {
    expect(inferDeviceName(UA_WINDOWS_CHROME)).toBe('Windows · Chrome');
  });

  it('Android + Firefox UA → Android · Firefox（先判 Android，不落入 Linux）', () => {
    expect(inferDeviceName(UA_ANDROID_FIREFOX)).toBe('Android · Firefox');
  });

  it('Mac OS X + 仅 Safari UA → macOS · Safari（Safari 非 Chrome 分支）', () => {
    expect(inferDeviceName(UA_MAC_SAFARI)).toBe('macOS · Safari');
  });

  it('完全未知 UA 返回空串', () => {
    expect(inferDeviceName(UA_UNKNOWN)).toBe('');
  });
});

describe('getDeviceName', () => {
  it('无自定义名时按 UA 推断', () => {
    vi.stubGlobal('navigator', { userAgent: UA_WINDOWS_CHROME });
    expect(getDeviceName()).toBe('Windows · Chrome');
  });

  it('UA 推断为空串时兜底「我的设备」', () => {
    vi.stubGlobal('navigator', { userAgent: UA_UNKNOWN });
    expect(getDeviceName()).toBe('我的设备');
  });
});

describe('setDeviceName', () => {
  it('保存后 getDeviceName 返回自定义名（优先于 UA 推断）', () => {
    vi.stubGlobal('navigator', { userAgent: UA_WINDOWS_CHROME });
    setDeviceName('我的电脑');
    expect(getDeviceName()).toBe('我的电脑');
  });

  it('空串清除自定义名，回落 UA 推断', () => {
    vi.stubGlobal('navigator', { userAgent: UA_ANDROID_FIREFOX });
    setDeviceName('我的电脑');
    setDeviceName('');
    expect(getDeviceName()).toBe('Android · Firefox');
  });
});

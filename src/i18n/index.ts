import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import zhCN from './locales/zh-CN.json';

export const SUPPORTED_LOCALES = ['zh-CN', 'en'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const FALLBACK_LOCALE: Locale = 'zh-CN';
export const LANG_STORAGE_KEY = 'kiku-lang';

/** 按语言偏好列表匹配支持语言：先精确后主子标签（zh-TW→zh-CN），与后端 negotiate 同规则。 */
export function matchLanguageList(languages: readonly string[]): Locale {
  for (const raw of languages) {
    const lower = raw.toLowerCase();
    if ((SUPPORTED_LOCALES as readonly string[]).includes(lower))
      return lower as Locale;
    const base = lower.split('-')[0];
    const byBase = SUPPORTED_LOCALES.find((l) => l.split('-')[0] === base);
    if (byBase) return byBase;
  }
  return FALLBACK_LOCALE;
}

/** 初始语言：localStorage 用户选择 → 浏览器语言 → zh-CN。 */
export function resolveInitialLanguage(
  storage: Pick<Storage, 'getItem'> | undefined,
  navigatorLanguages: readonly string[],
): Locale {
  const stored = storage?.getItem(LANG_STORAGE_KEY);
  if (stored && (SUPPORTED_LOCALES as readonly string[]).includes(stored))
    return stored as Locale;
  return matchLanguageList(navigatorLanguages);
}

/** 切换界面语言（即时生效；languageChanged 订阅统一负责持久化与 html lang 同步）。 */
export function setLanguage(locale: Locale): void {
  void i18next.changeLanguage(locale);
}

const initial = resolveInitialLanguage(
  typeof localStorage !== 'undefined' ? localStorage : undefined,
  typeof navigator !== 'undefined' ? navigator.languages : [],
);

void i18next.use(initReactI18next).init({
  resources: {
    'zh-CN': { translation: zhCN },
    en: { translation: en },
  },
  lng: initial,
  fallbackLng: FALLBACK_LOCALE,
  // 扁平 dotted key 按字面量查找，不按 ./: 拆路径（与后端同规则，漏配必炸）
  keySeparator: false,
  nsSeparator: false,
  interpolation: { escapeValue: false },
});

/** html lang 同步：node 测试环境无 document，需防护（浏览器行为不变）。 */
function syncHtmlLang(lng: string): void {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lng;
  }
}

syncHtmlLang(i18next.language);
i18next.on('languageChanged', (lng) => {
  syncHtmlLang(lng);
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lng);
  } catch {
    // 隐私模式等写入失败可忽略（仅影响下次记忆）
  }
});

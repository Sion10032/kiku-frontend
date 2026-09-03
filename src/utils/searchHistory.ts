/** localStorage 存储键（最近搜索历史） */
const SEARCH_HISTORY_KEY = 'kiku-search-history';

/** 最近搜索最多保留条数，超出时丢弃最旧记录 */
const SEARCH_HISTORY_LIMIT = 8;

/** 读取最近搜索历史；存储缺失/损坏（解析失败或非字符串数组）时返回 []。 */
export function loadSearchHistory(): string[] {
  try {
    const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    if (!parsed.every((item) => typeof item === 'string')) return [];
    return parsed as string[];
  } catch {
    return [];
  }
}

/**
 * 新增一条最近搜索（trim 后存储），返回新列表便于组件同步 state。
 *
 * - 空串/纯空格忽略，原样返回当前列表
 * - 已存在词条去重并置顶
 * - 超出上限时截断，保留最新条目
 * - 写入失败（隐私模式/超额）吞异常，不影响返回值
 */
export function addSearchHistory(term: string): string[] {
  const trimmed = term.trim();
  const history = loadSearchHistory();
  if (!trimmed) return history;
  const deduped = history.filter((item) => item !== trimmed);
  const next = [trimmed, ...deduped].slice(0, SEARCH_HISTORY_LIMIT);
  try {
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next));
  } catch {
    /* noop */
  }
  return next;
}

/** 删除指定词条（trim 匹配），返回删除后的列表。 */
export function removeSearchHistory(term: string): string[] {
  const trimmed = term.trim();
  const next = loadSearchHistory().filter((item) => item !== trimmed);
  try {
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next));
  } catch {
    /* noop */
  }
  return next;
}

/** 清空最近搜索历史（移除存储键）。 */
export function clearSearchHistory(): void {
  try {
    localStorage.removeItem(SEARCH_HISTORY_KEY);
  } catch {
    /* noop */
  }
}

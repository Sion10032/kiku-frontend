import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  addSearchHistory,
  clearSearchHistory,
  loadSearchHistory,
  removeSearchHistory,
} from './searchHistory';

const KEY = 'kiku-search-history';

afterEach(() => {
  // localStorage 来自 src/test/setup.ts 的内存实现，每例后清空避免相互污染；
  // 同时还原 vi.spyOn 注入的抛异常桩。
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('loadSearchHistory', () => {
  it('无存储时返回 []', () => {
    expect(loadSearchHistory()).toEqual([]);
  });

  it('正常读取已存词条（保持存储顺序）', () => {
    localStorage.setItem(KEY, JSON.stringify(['a', 'b']));
    expect(loadSearchHistory()).toEqual(['a', 'b']);
  });

  it('损坏 JSON 容错：返回 []', () => {
    localStorage.setItem(KEY, '{broken json');
    expect(loadSearchHistory()).toEqual([]);
  });

  it('解析结果非数组（如对象）返回 []', () => {
    localStorage.setItem(KEY, JSON.stringify({ term: 'a' }));
    expect(loadSearchHistory()).toEqual([]);
  });

  it('数组含非字符串项返回 []', () => {
    localStorage.setItem(KEY, JSON.stringify(['a', 1, null]));
    expect(loadSearchHistory()).toEqual([]);
  });

  it('getItem 抛异常（隐私模式）容错：返回 []', () => {
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(loadSearchHistory()).toEqual([]);
  });
});

describe('addSearchHistory', () => {
  it('新增词条置顶并返回新列表', () => {
    expect(addSearchHistory('a')).toEqual(['a']);
    expect(addSearchHistory('b')).toEqual(['b', 'a']);
    expect(loadSearchHistory()).toEqual(['b', 'a']);
  });

  it('已存在词条去重并置顶', () => {
    localStorage.setItem(KEY, JSON.stringify(['a', 'b', 'c']));
    expect(addSearchHistory('b')).toEqual(['b', 'a', 'c']);
  });

  it('trim 后存储（前后空格不保留）', () => {
    addSearchHistory('  环境音  ');
    expect(loadSearchHistory()).toEqual(['环境音']);
  });

  it('空串/纯空格忽略：返回当前列表且不写存储', () => {
    localStorage.setItem(KEY, JSON.stringify(['a']));
    expect(addSearchHistory('')).toEqual(['a']);
    expect(addSearchHistory('   ')).toEqual(['a']);
    expect(localStorage.getItem(KEY)).toBe(JSON.stringify(['a']));
  });

  it('超出上限截断，保留最新 8 条', () => {
    const eight = Array.from({ length: 8 }, (_, i) => String(i + 1));
    localStorage.setItem(KEY, JSON.stringify(eight));
    expect(addSearchHistory('9')).toEqual(['9', ...eight.slice(0, 7)]);
    expect(addSearchHistory('1')).toEqual(['1', '9', ...eight.slice(1, 7)]);
  });

  it('写入抛异常（超额/隐私模式）吞异常，仍返回新列表', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(addSearchHistory('a')).toEqual(['a']);
  });
});

describe('removeSearchHistory', () => {
  it('删除指定词条，返回删除后的列表', () => {
    localStorage.setItem(KEY, JSON.stringify(['a', 'b', 'c']));
    expect(removeSearchHistory('b')).toEqual(['a', 'c']);
    expect(loadSearchHistory()).toEqual(['a', 'c']);
  });

  it('删除不存在的词条：列表不变', () => {
    localStorage.setItem(KEY, JSON.stringify(['a']));
    expect(removeSearchHistory('x')).toEqual(['a']);
  });
});

describe('clearSearchHistory', () => {
  it('清空后读取为 []，存储键被移除', () => {
    localStorage.setItem(KEY, JSON.stringify(['a', 'b']));
    clearSearchHistory();
    expect(loadSearchHistory()).toEqual([]);
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});

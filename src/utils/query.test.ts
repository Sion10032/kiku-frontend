import { afterEach, describe, expect, it } from 'vitest';
import {
  fieldQuery,
  loadQuickFilters,
  mergeWorksQuery,
  saveQuickFilters,
} from './query';

describe('fieldQuery', () => {
  it('普通名称：字段名 + 双引号包裹', () => {
    expect(fieldQuery('tag', '标签')).toBe('tag:"标签"');
    expect(fieldQuery('circle', '社团')).toBe('circle:"社团"');
  });

  it('含空格名称：引号保证解析', () => {
    expect(fieldQuery('circle', '社 团')).toBe('circle:"社 团"');
  });

  it('转义值内的双引号与反斜杠（liqe 引号串支持 \\ 转义）', () => {
    expect(fieldQuery('tag', 'a"b')).toBe('tag:"a\\"b"');
    expect(fieldQuery('tag', 'a\\b')).toBe('tag:"a\\\\b"');
  });
});

describe('mergeWorksQuery', () => {
  it('无任何条件 → undefined', () => {
    expect(mergeWorksQuery({})).toBeUndefined();
    expect(mergeWorksQuery({ q: '  ' })).toBeUndefined();
  });

  it('仅已有 q：原样透传', () => {
    expect(mergeWorksQuery({ q: 'tag:催眠' })).toBe('tag:催眠');
  });

  it('分级：追加 age: 等值片段', () => {
    expect(mergeWorksQuery({ age: 'r18' })).toBe('age:r18');
    expect(mergeWorksQuery({ q: 'circle:x', age: 'all' })).toBe(
      'circle:x AND age:all',
    );
  });

  it('状态已读：read:true', () => {
    expect(mergeWorksQuery({ progress: 'read' })).toBe('read:true');
  });

  it('状态进行中：progress:true AND read:false（有进度且未标记已读）', () => {
    expect(mergeWorksQuery({ progress: 'inprogress' })).toBe(
      'progress:true AND read:false',
    );
  });

  it('状态未读：read:false AND progress:false（无已读标记且无进度）', () => {
    expect(mergeWorksQuery({ progress: 'unread' })).toBe(
      'read:false AND progress:false',
    );
  });

  it('q + 分级 + 状态全条件按序 AND 拼接', () => {
    expect(
      mergeWorksQuery({ q: 'tag:x', age: 'r15', progress: 'unread' }),
    ).toBe('tag:x AND age:r15 AND read:false AND progress:false');
  });
});

describe('loadQuickFilters / saveQuickFilters', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('无存储 → 空状态', () => {
    expect(loadQuickFilters()).toEqual({});
  });

  it('save → load 往返；undefined 字段落盘为缺省', () => {
    saveQuickFilters({ age: 'r18', progress: 'unread' });
    expect(loadQuickFilters()).toEqual({ age: 'r18', progress: 'unread' });
    saveQuickFilters({ age: 'r15' });
    expect(loadQuickFilters()).toEqual({ age: 'r15' });
  });

  it('损坏 JSON / 非对象 / 值不在取值域 → 忽略，返回空状态', () => {
    localStorage.setItem('kiku-works-quick-filters', '{oops');
    expect(loadQuickFilters()).toEqual({});
    localStorage.setItem('kiku-works-quick-filters', '"str"');
    expect(loadQuickFilters()).toEqual({});
    localStorage.setItem(
      'kiku-works-quick-filters',
      JSON.stringify({ age: 'xxx', progress: 1 }),
    );
    expect(loadQuickFilters()).toEqual({});
  });
});

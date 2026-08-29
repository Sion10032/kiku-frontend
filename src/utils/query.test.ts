import { describe, expect, it } from 'vitest';
import { fieldQuery } from './query';

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

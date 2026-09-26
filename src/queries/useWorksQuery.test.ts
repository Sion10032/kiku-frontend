import { describe, expect, it } from 'vitest';
import { worksListQueryKey } from './useWorksQuery';

describe('worksListQueryKey', () => {
  it('pageSize 参与 key：20 与 50 不共用缓存', () => {
    expect(worksListQueryKey({ page: 1, pageSize: 20 })).not.toEqual(
      worksListQueryKey({ page: 1, pageSize: 50 }),
    );
  });

  it('key 形状固定：base 显式含 pageSize（键序稳定，hash 不漂移）', () => {
    const key = worksListQueryKey({ page: 2, pageSize: 50, q: 'tag:x' });
    expect(key).toEqual([
      'works',
      {
        order: undefined,
        sort: undefined,
        seed: undefined,
        q: 'tag:x',
        pageSize: 50,
      },
      2,
    ]);
    // toEqual 忽略值为 undefined 的属性：单独钉住 base 的键集合与键序
    expect(Object.keys(key[1])).toEqual([
      'order',
      'sort',
      'seed',
      'q',
      'pageSize',
    ]);
  });
});

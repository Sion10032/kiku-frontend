import { describe, expect, it } from 'vitest';
import { dlsiteUrl } from './dlsite';

describe('dlsiteUrl（作品页链接）', () => {
  it('RJ 号走 home 站点', () => {
    expect(dlsiteUrl('RJ01173549')).toBe(
      'https://www.dlsite.com/home/work/=/product_id/RJ01173549.html',
    );
  });

  it('VJ 号走 pro 站点', () => {
    expect(dlsiteUrl('VJ01003042')).toBe(
      'https://www.dlsite.com/pro/work/=/product_id/VJ01003042.html',
    );
  });
});

import { describe, expect, it } from 'vitest';
import { formatDuration, formatRemaining } from './format';

describe('formatRemaining', () => {
  it('播放中返回带负号的剩余时长', () => {
    expect(formatRemaining(933, 1353)).toBe('-7:00');
  });

  it('不足一小时不补零分钟', () => {
    expect(formatRemaining(2754, 2754 + 99)).toBe('-1:39');
  });

  it('剩余超过一小时为 -h:mm:ss', () => {
    expect(formatRemaining(3600, 3600 + 3661)).toBe('-1:01:01');
    expect(formatRemaining(0, 2 * 3600 + 59 * 60 + 59)).toBe('-2:59:59');
  });

  it('current 超过 duration 时 clamp 为 -0:00', () => {
    expect(formatRemaining(200, 100)).toBe('-0:00');
  });

  it('时长未知（duration <= 0）回退 0:00，不带负号', () => {
    expect(formatRemaining(30, 0)).toBe('0:00');
    expect(formatRemaining(30, -1)).toBe('0:00');
    expect(formatRemaining(30, Number.NaN)).toBe('0:00');
  });

  it('非有限 current 按 0 处理（即剩余完整时长）', () => {
    expect(formatRemaining(Number.NaN, 60)).toBe('-1:00');
  });
});

describe('formatDuration', () => {
  it('小时以上为 h:mm:ss', () => {
    expect(formatDuration(3661)).toBe('1:01:01');
  });
});

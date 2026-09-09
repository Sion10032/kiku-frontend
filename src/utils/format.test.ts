import i18next from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  formatDuration,
  formatProgress,
  formatRemaining,
  formatTotalDuration,
} from './format';
// format 内部用 i18next.t 翻译；断言 zh-CN 文案，需先初始化并固定语言
// （node 测试环境 navigator.languages 为 en-US，init 默认会解析到 en）
import '../i18n';
import type { UserWorkProgress } from '../types';

beforeAll(async () => {
  await i18next.changeLanguage('zh-CN');
});

/** 构造最小合法进度记录（测试用） */
function makeProgress(
  position: number,
  duration: number | null,
): UserWorkProgress {
  return {
    mediaIndex: 'folder/track01.mp3',
    trackTitle: null,
    position,
    duration,
    listenedCount: 0,
    updatedAt: '2024-01-01T00:00:00Z',
  };
}

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

describe('formatTotalDuration', () => {
  it('一小时以上为一位小数小时', () => {
    expect(formatTotalDuration(19440)).toBe('5.4 小时');
    expect(formatTotalDuration(3600)).toBe('1.0 小时');
  });

  it('不足一小时为整分钟', () => {
    expect(formatTotalDuration(2700)).toBe('45 分钟');
    expect(formatTotalDuration(3599)).toBe('60 分钟');
  });

  it('无效输入返回 null（调用方不渲染）', () => {
    expect(formatTotalDuration(null)).toBeNull();
    expect(formatTotalDuration(undefined)).toBeNull();
    expect(formatTotalDuration(0)).toBeNull();
    expect(formatTotalDuration(-1)).toBeNull();
    expect(formatTotalDuration(Number.NaN)).toBeNull();
  });
});

describe('formatProgress', () => {
  it('有音轨时长时返回整百分比（clamp 100）', () => {
    expect(formatProgress(makeProgress(500, 1000))).toBe('50%');
    expect(formatProgress(makeProgress(0, 1000))).toBe('0%');
    expect(formatProgress(makeProgress(2000, 1000))).toBe('100%');
  });

  it('无音轨时长但有记录时返回「正在听」', () => {
    expect(formatProgress(makeProgress(30, null))).toBe('正在听');
    expect(formatProgress(makeProgress(30, 0))).toBe('正在听');
  });

  it('无记录（未听/未登录）返回 null（调用方不渲染）', () => {
    expect(formatProgress(null)).toBeNull();
    expect(formatProgress(undefined)).toBeNull();
  });
});

describe('formatDuration', () => {
  it('小时以上为 h:mm:ss', () => {
    expect(formatDuration(3661)).toBe('1:01:01');
  });

  it('不足一小时不补零分钟', () => {
    expect(formatDuration(65)).toBe('1:05');
  });

  it('null/undefined 返回 —（时长未知）', () => {
    expect(formatDuration(null)).toBe('—');
    expect(formatDuration(undefined)).toBe('—');
  });
});

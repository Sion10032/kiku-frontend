import { describe, expect, it } from 'vitest';
import { APP_COMMIT, APP_VERSION, formatVersion } from './appVersion';

describe('formatVersion', () => {
  it('拼成 `版本-commit`', () => {
    expect(formatVersion('0.1.0', 'a1b2c3d')).toBe('0.1.0-a1b2c3d');
  });

  it('commit 缺失 / 空串 / 空白时兜底 unknown，不留裸连字符', () => {
    expect(formatVersion('0.1.0')).toBe('0.1.0-unknown');
    expect(formatVersion('0.1.0', '')).toBe('0.1.0-unknown');
    expect(formatVersion('0.1.0', '   ')).toBe('0.1.0-unknown');
    expect(formatVersion('0.1.0', null)).toBe('0.1.0-unknown');
  });
});

describe('构建期注入的常量', () => {
  // 锁定「不读 package.json、不跑 git 解析」：两个常量都只来自构建期注入，
  // 测试环境没注入 → 'dev' / 'unknown'（从而断言也永远不会渲染出 undefined）
  it('只来自构建期注入，未注入时兜底 dev / unknown', () => {
    expect(APP_VERSION).toBe(process.env.APP_VERSION_FRONTEND?.trim() || 'dev');
    expect(APP_COMMIT).toBe(
      process.env.GIT_COMMIT_FRONTEND?.trim() || 'unknown',
    );
  });
});

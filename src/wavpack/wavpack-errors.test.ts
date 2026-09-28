import { describe, expect, it } from 'vitest';
import {
  WAVPACK_SEEK_FAILED_PREFIX,
  WAVPACK_TRUNCATED_PREFIX,
  WAVPACK_UNSUPPORTED_TEXT,
  wavpackErrorKey,
} from './wavpack-errors';

describe('wavpackErrorKey：已知错误收敛为 i18n key', () => {
  it('不受支持/损坏文件 → player.wavpack-error-unsupported', () => {
    expect(wavpackErrorKey('DECODE', WAVPACK_UNSUPPORTED_TEXT)).toBe(
      'player.wavpack-error-unsupported',
    );
  });

  it('seek 定位失败（任意 sample 后缀）→ player.wavpack-error-seek', () => {
    expect(
      wavpackErrorKey('DECODE', `${WAVPACK_SEEK_FAILED_PREFIX}sample 264600`),
    ).toBe('player.wavpack-error-seek');
  });

  it('流提前结束 → player.wavpack-error-truncated', () => {
    expect(
      wavpackErrorKey(
        'DECODE',
        `${WAVPACK_TRUNCATED_PREFIX}：输出 1 / 应有 2 帧`,
      ),
    ).toBe('player.wavpack-error-truncated');
  });

  it('NETWORK（HTTP 状态等动态 message）→ player.wavpack-error-network', () => {
    expect(wavpackErrorKey('NETWORK', 'HTTP 404')).toBe(
      'player.wavpack-error-network',
    );
  });

  it('未知 DECODE message → player.wavpack-error（{{message}} 插值兜底）', () => {
    expect(wavpackErrorKey('DECODE', 'TypeError: boom')).toBe(
      'player.wavpack-error',
    );
  });
});

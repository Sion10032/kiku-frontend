import { describe, expect, it, vi } from 'vitest';
import { apiFetch } from './client';

vi.mock('./client', () => ({ apiFetch: vi.fn() }));

const mockedApiFetch = vi.mocked(apiFetch);

describe('setup 状态缓存（原 sharedConfig.ts 搬迁）', () => {
  it('只请求一次；markSetupDone 后为 false 且不再请求', async () => {
    mockedApiFetch.mockResolvedValue({ needed: true });
    const { ensureSetupStatus, getSetupNeeded, markSetupDone } = await import(
      './setup'
    );

    expect(getSetupNeeded()).toBeNull();
    await expect(ensureSetupStatus()).resolves.toBe(true);
    await expect(ensureSetupStatus()).resolves.toBe(true);
    expect(mockedApiFetch).toHaveBeenCalledTimes(1);

    markSetupDone();
    expect(getSetupNeeded()).toBe(false);
    await expect(ensureSetupStatus()).resolves.toBe(false);
    expect(mockedApiFetch).toHaveBeenCalledTimes(1);
  });
});

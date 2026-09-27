import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from './client';
import { killAnalysis, startAnalysis } from './analysis';

vi.mock('./client', () => ({ apiFetch: vi.fn() }));

const mockedApiFetch = vi.mocked(apiFetch);

describe('analysis api', () => {
  beforeEach(() => {
    mockedApiFetch.mockReset();
    mockedApiFetch.mockResolvedValue({ success: true, queued: false });
  });

  it('startAnalysis()：全量，缺省 priority low', async () => {
    await startAnalysis();
    expect(mockedApiFetch).toHaveBeenCalledWith('analysis/start', {
      method: 'POST',
      json: { priority: 'low' },
    });
  });

  it('startAnalysis(workIds)：管理页批量子集，priority 缺省 low', async () => {
    await startAnalysis(['RJ00000001', 'RJ00000002']);
    expect(mockedApiFetch).toHaveBeenCalledWith('analysis/start', {
      method: 'POST',
      json: { priority: 'low', workIds: ['RJ00000001', 'RJ00000002'] },
    });
  });

  it('startAnalysis(workIds, high)：作品页插队，priority high', async () => {
    await startAnalysis(['RJ00000001'], 'high');
    expect(mockedApiFetch).toHaveBeenCalledWith('analysis/start', {
      method: 'POST',
      json: { priority: 'high', workIds: ['RJ00000001'] },
    });
  });

  it('killAnalysis：POST 无 body', async () => {
    await killAnalysis();
    expect(mockedApiFetch).toHaveBeenCalledWith('analysis/stop', {
      method: 'POST',
    });
  });
});

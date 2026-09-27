import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from './client';
import { killScan, startScan, type ScanMode } from './scanner';

vi.mock('./client', () => ({ apiFetch: vi.fn() }));

const mockedApiFetch = vi.mocked(apiFetch);

describe('scanner api', () => {
  beforeEach(() => {
    mockedApiFetch.mockReset();
    mockedApiFetch.mockResolvedValue({ success: true });
  });

  it('startScan：缺省 mode=scan，body 不带 workIds', async () => {
    await startScan();
    expect(mockedApiFetch).toHaveBeenCalledWith('scanner/scan', {
      method: 'POST',
      json: { mode: 'scan' },
    });
  });

  it('startScan(mode)：body 透传 mode', async () => {
    await startScan('update' satisfies ScanMode);
    expect(mockedApiFetch).toHaveBeenCalledWith('scanner/scan', {
      method: 'POST',
      json: { mode: 'update' },
    });
  });

  it('startScan(mode, workIds)：选中子集时 body 携带 workIds', async () => {
    await startScan('update', ['RJ00000001', 'RJ00000002']);
    expect(mockedApiFetch).toHaveBeenCalledWith('scanner/scan', {
      method: 'POST',
      json: { mode: 'update', workIds: ['RJ00000001', 'RJ00000002'] },
    });
  });

  it('killScan：POST 无 body', async () => {
    await killScan();
    expect(mockedApiFetch).toHaveBeenCalledWith('scanner/kill', {
      method: 'POST',
    });
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from './client';
import { getWorksList } from './works';

vi.mock('./client', () => ({ apiFetch: vi.fn() }));

const mockedApiFetch = vi.mocked(apiFetch);

describe('getWorksList pageSize', () => {
  beforeEach(() => {
    mockedApiFetch.mockReset();
    mockedApiFetch.mockResolvedValue({ works: [], pagination: {} });
  });

  it('pageSize 写进 searchParams', async () => {
    await getWorksList({ page: 2, pageSize: 50 });
    expect(mockedApiFetch).toHaveBeenCalledWith('works', {
      searchParams: { page: '2', pageSize: '50' },
    });
  });

  it('省略 pageSize 时不发送该参数（由服务端默认 20）', async () => {
    await getWorksList({ page: 1 });
    expect(mockedApiFetch).toHaveBeenCalledWith('works', {
      searchParams: { page: '1' },
    });
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from './client';
import {
  createRootFolder,
  deleteRootFolder,
  listRootFolders,
  updateRootFolder,
} from './rootFolders';

vi.mock('./client', () => ({ apiFetch: vi.fn() }));

const mockedApiFetch = vi.mocked(apiFetch);

describe('rootFolders api', () => {
  beforeEach(() => {
    mockedApiFetch.mockReset();
    mockedApiFetch.mockResolvedValue(undefined);
  });

  it('listRootFolders：GET，path 不带前导斜杠（apiFetch 自带 /api 前缀）', async () => {
    await listRootFolders();
    expect(mockedApiFetch).toHaveBeenCalledWith('config/root-folders');
  });

  it('createRootFolder：POST body 原样透传', async () => {
    await createRootFolder({ name: '同人音声', path: '/m/a' });
    expect(mockedApiFetch).toHaveBeenCalledWith('config/root-folders', {
      method: 'POST',
      json: { name: '同人音声', path: '/m/a' },
    });
  });

  it('updateRootFolder / deleteRootFolder：当前名经 URLSearchParams 编码', async () => {
    // name 可能含 '/'、空格、日文——手拼查询串会让 '/' 截断路由。
    const name = '同人/音声 日语&x=1';
    await updateRootFolder(name, { name: '新名', path: '/m/b' });
    const putOpts = mockedApiFetch.mock.calls[0][1] as {
      searchParams: URLSearchParams;
      json: unknown;
    };
    expect(mockedApiFetch.mock.calls[0][0]).toBe('config/root-folders');
    expect(putOpts.searchParams.get('name')).toBe(name);
    expect(putOpts.searchParams.toString()).toContain('%2F');
    expect(putOpts.json).toEqual({ name: '新名', path: '/m/b' });

    await deleteRootFolder(name);
    const deleteOpts = mockedApiFetch.mock.calls[1][1] as {
      searchParams: URLSearchParams;
    };
    expect(deleteOpts.searchParams.get('name')).toBe(name);
  });
});

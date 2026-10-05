import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from './client';
import { cancelTask, fetchTaskSnapshot, subscribeTaskEvents } from './tasks';

vi.mock('./client', () => ({ apiFetch: vi.fn() }));
vi.mock('./token', () => ({ getToken: vi.fn(() => 'tok-123') }));
vi.mock('@microsoft/fetch-event-source', () => ({
  fetchEventSource: vi.fn(() => new Promise(() => {})), // 挂起模拟长连接
}));

const mockedApiFetch = vi.mocked(apiFetch);
const mockedFES = vi.mocked(
  (await import('@microsoft/fetch-event-source')).fetchEventSource,
);

describe('tasks api', () => {
  beforeEach(() => {
    mockedApiFetch.mockReset();
    mockedFES.mockClear();
    mockedApiFetch.mockResolvedValue({
      batches: [],
      pipelines: [],
      logs: [],
    });
  });

  it('fetchTaskSnapshot()：GET tasks 并解包 {snapshot} 包裹', async () => {
    mockedApiFetch.mockResolvedValue({
      snapshot: { batches: [{ batchId: 'scan-1' }], pipelines: [], logs: [] },
    });
    const snapshot = await fetchTaskSnapshot();
    expect(mockedApiFetch).toHaveBeenCalledWith('tasks');
    expect(snapshot.batches[0]?.batchId).toBe('scan-1');
  });

  it('cancelTask(id)：DELETE tasks/:id', async () => {
    await cancelTask('scan-abc');
    expect(mockedApiFetch).toHaveBeenCalledWith('tasks/scan-abc', {
      method: 'DELETE',
    });
  });

  it('subscribeTaskEvents：带 JWT 订阅 /api/tasks/events', () => {
    const unsub = subscribeTaskEvents(() => {});
    expect(mockedFES).toHaveBeenCalledTimes(1);
    const cfg = mockedFES.mock.calls[0]?.[1];
    expect(mockedFES.mock.calls[0]?.[0]).toBe('/api/tasks/events');
    expect(cfg?.headers).toEqual({ Authorization: 'Bearer tok-123' });
    expect(cfg?.signal).toBeInstanceOf(AbortSignal);
    unsub();
    expect(cfg?.signal?.aborted).toBe(true);
  });

  it('subscribeTaskEvents：onmessage 解析 JSON 帧并分发 TaskEvent', () => {
    const events: unknown[] = [];
    subscribeTaskEvents((e) => events.push(e));
    const cfg = mockedFES.mock.calls[0]?.[1];
    cfg?.onmessage?.({
      event: 'TASK_DELTA',
      data: JSON.stringify({ type: 'TASK_DELTA', entries: [], counters: [] }),
      id: '1',
      retry: undefined,
    });
    expect(events).toEqual([{ type: 'TASK_DELTA', entries: [], counters: [] }]);
  });

  it('subscribeTaskEvents：非 JSON 帧静默忽略不抛错', () => {
    const onEvent = vi.fn();
    subscribeTaskEvents(onEvent);
    const cfg = mockedFES.mock.calls[0]?.[1];
    expect(() =>
      cfg?.onmessage?.({
        event: ':keepalive',
        data: 'ping',
        id: '2',
        retry: undefined,
      }),
    ).not.toThrow();
    expect(onEvent).not.toHaveBeenCalled();
  });
});

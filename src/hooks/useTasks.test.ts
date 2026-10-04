// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SubscribeHooks, TaskEvent } from '../api/tasks';
import { fetchTaskSnapshot, subscribeTaskEvents } from '../api/tasks';
import { emptyTaskSnapshot, useTasksStore } from '../stores/tasks';
import { useBatches, usePipeline, useTasks } from './useTasks';

vi.mock('../api/tasks', () => ({
  fetchTaskSnapshot: vi.fn(),
  subscribeTaskEvents: vi.fn(),
}));

const mockedFetch = vi.mocked(fetchTaskSnapshot);
const mockedSubscribe = vi.mocked(subscribeTaskEvents);

/** 捕获到的订阅回调（onEvent / hooks.onOpen） */
let onEvent: (e: TaskEvent) => void;
let hooks: SubscribeHooks;
let unsubSpy = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  unsubSpy = vi.fn();
  onEvent = () => {};
  hooks = {};
  mockedSubscribe.mockImplementation((cb, h) => {
    onEvent = cb;
    hooks = h ?? {};
    return unsubSpy;
  });
  mockedFetch.mockResolvedValue(emptyTaskSnapshot());
  useTasksStore.setState({ snapshot: emptyTaskSnapshot(), connected: false });
});

afterEach(() => {
  cleanup(); // 卸载消费者 → refCount 归零断开（模块级单例状态跨用例复位）
});

describe('useTasks（单例 SSE 连接管理）', () => {
  it('首个消费者建立订阅并拉取初始快照', async () => {
    const seeded: typeof emptyTaskSnapshot extends never
      ? never
      : ReturnType<typeof emptyTaskSnapshot> = {
      batches: [],
      pipelines: [{ workId: 'RJ1', phases: {}, updatedAt: 't' }],
      logs: [],
    };
    mockedFetch.mockResolvedValue(seeded);

    const { result } = renderHook(() => useTasks());
    await waitFor(() => {
      expect(mockedSubscribe).toHaveBeenCalledTimes(1);
      expect(mockedFetch).toHaveBeenCalledTimes(1);
      expect(result.current.snapshot.pipelines[0]?.workId).toBe('RJ1');
    });
  });

  it('第二个消费者不重复订阅（单例连接）', async () => {
    renderHook(() => useTasks());
    renderHook(() => useTasks());
    await waitFor(() => expect(mockedSubscribe).toHaveBeenCalledTimes(1));
  });

  it('全部消费者卸载后断开；重挂载重新订阅', async () => {
    const { unmount } = renderHook(() => useTasks());
    await waitFor(() => expect(mockedSubscribe).toHaveBeenCalledTimes(1));
    unmount();
    await waitFor(() => expect(unsubSpy).toHaveBeenCalledTimes(1));
    expect(useTasksStore.getState().connected).toBe(false);

    renderHook(() => useTasks());
    await waitFor(() => expect(mockedSubscribe).toHaveBeenCalledTimes(2));
  });

  it('onOpen 置 connected=true，onError 置 false', async () => {
    const { result } = renderHook(() => useTasks());
    await waitFor(() => expect(hooks.onOpen).toBeDefined());
    act(() => hooks.onOpen?.());
    expect(result.current.connected).toBe(true);
    act(() => hooks.onError?.(new Error('boom')));
    expect(result.current.connected).toBe(false);
  });

  it('SSE 事件经 apply 归并进 store', async () => {
    const { result } = renderHook(() => useTasks());
    await waitFor(() => expect(onEvent).toBeDefined());
    act(() =>
      onEvent({
        type: 'TASK_DELTA',
        entries: [
          {
            workId: 'RJ9',
            phase: 'metadata',
            status: 'running',
            changedAt: '2026-10-04T00:00:00.000Z',
          },
        ],
        counters: [],
      }),
    );
    expect(result.current.snapshot.pipelines[0]?.workId).toBe('RJ9');
  });
});

describe('选择器', () => {
  it('useBatches 返回批次列表', () => {
    useTasksStore.setState({
      snapshot: {
        ...emptyTaskSnapshot(),
        batches: [
          {
            batchId: 'scan-1',
            kind: 'scan',
            createdAt: 't',
            counters: {
              batchId: 'scan-1',
              kind: 'scan',
              total: 1,
              running: 0,
              completed: 1,
              failed: 0,
            },
            status: 'completed',
          },
        ],
      },
    });
    const { result } = renderHook(() => useBatches());
    expect(result.current[0]?.batchId).toBe('scan-1');
  });

  it('usePipeline 按 workId 过滤；无匹配返回 undefined', () => {
    useTasksStore.setState({
      snapshot: {
        ...emptyTaskSnapshot(),
        pipelines: [{ workId: 'RJ1', phases: {}, updatedAt: 't' }],
      },
    });
    const { result: hit } = renderHook(() => usePipeline('RJ1'));
    const { result: miss } = renderHook(() => usePipeline('RJ2'));
    expect(hit.current?.workId).toBe('RJ1');
    expect(miss.current).toBeUndefined();
  });
});

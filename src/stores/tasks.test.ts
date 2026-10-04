import { beforeEach, describe, expect, it } from 'vitest';
import { applyTaskEvent, emptyTaskSnapshot, useTasksStore } from './tasks';
import type { PhaseEntry, TaskSnapshot } from '../api/tasks';

function entry(
  partial: Partial<PhaseEntry> & { workId: string; phase: PhaseEntry['phase'] },
): PhaseEntry {
  return {
    status: 'running',
    changedAt: '2026-10-04T00:00:00.000Z',
    ...partial,
  };
}

function log(n: number) {
  return {
    level: 'info',
    message: `log-${n}`,
    timestamp: '2026-10-04T00:00:00.000Z',
  };
}

beforeEach(() => {
  useTasksStore.setState({
    snapshot: emptyTaskSnapshot(),
    connected: false,
  });
});

describe('applyTaskEvent（镜像后端 reducer）', () => {
  it('TASK_DELTA 按 workId+phase upsert 流水线状态', () => {
    let s: TaskSnapshot = emptyTaskSnapshot();
    s = applyTaskEvent(s, {
      type: 'TASK_DELTA',
      entries: [entry({ workId: 'RJ1', phase: 'metadata' })],
      counters: [
        {
          batchId: 'b1',
          kind: 'scan',
          total: 1,
          running: 1,
          completed: 0,
          failed: 0,
        },
      ],
    });
    expect(s.pipelines[0]?.phases.metadata?.status).toBe('running');
    s = applyTaskEvent(s, {
      type: 'TASK_DELTA',
      entries: [
        entry({ workId: 'RJ1', phase: 'metadata', status: 'completed' }),
      ],
      counters: [
        {
          batchId: 'b1',
          kind: 'scan',
          total: 1,
          running: 0,
          completed: 1,
          failed: 0,
        },
      ],
    });
    expect(s.pipelines).toHaveLength(1);
    expect(s.pipelines[0]?.phases.metadata?.status).toBe('completed');
  });

  it('TASK_DELTA counters 防御性创建未知批次', () => {
    const s = applyTaskEvent(emptyTaskSnapshot(), {
      type: 'TASK_DELTA',
      entries: [],
      counters: [
        {
          batchId: 'bx',
          kind: 'analysis',
          total: 3,
          running: 2,
          completed: 1,
          failed: 0,
        },
      ],
    });
    expect(s.batches[0]?.batchId).toBe('bx');
    expect(s.batches[0]?.status).toBe('running');
  });

  it('BATCH_LOG 追加且封顶 500 条', () => {
    let s: TaskSnapshot = emptyTaskSnapshot();
    for (let n = 0; n < 505; n++) {
      s = applyTaskEvent(s, { type: 'BATCH_LOG', log: log(n) });
    }
    expect(s.logs).toHaveLength(500);
    expect(s.logs[0]?.message).toBe('log-5');
  });

  it('BATCH_SUMMARY 标记批次 completed 并写入 results', () => {
    let s: TaskSnapshot = emptyTaskSnapshot();
    s = applyTaskEvent(s, {
      type: 'TASK_DELTA',
      entries: [],
      counters: [
        {
          batchId: 'b1',
          kind: 'scan',
          total: 10,
          running: 2,
          completed: 8,
          failed: 0,
        },
      ],
    });
    s = applyTaskEvent(s, {
      type: 'BATCH_SUMMARY',
      batchId: 'b1',
      kind: 'scan',
      results: {
        total: 10,
        added: 3,
        updated: 5,
        failed: 0,
        skipped: 2,
        removed: 1,
        purged: 0,
      },
      completedAt: '2026-10-04T01:00:00.000Z',
    });
    const batch = s.batches.find((b) => b.batchId === 'b1');
    expect(batch?.status).toBe('completed');
    expect(batch?.results).toEqual({
      total: 10,
      added: 3,
      updated: 5,
      failed: 0,
      skipped: 2,
      removed: 1,
      purged: 0,
    });
  });

  it('TASK_SNAPSHOT 整体替换快照', () => {
    const replaced: TaskSnapshot = {
      batches: [],
      pipelines: [
        { workId: 'RJ9', phases: {}, updatedAt: '2026-10-04T02:00:00.000Z' },
      ],
      logs: [log(1)],
    };
    const s = applyTaskEvent(emptyTaskSnapshot(), {
      type: 'TASK_SNAPSHOT',
      snapshot: replaced,
    });
    expect(s).toEqual(replaced);
  });
});

describe('useTasksStore', () => {
  it('apply 将事件归并进 store 快照', () => {
    useTasksStore.getState().apply({
      type: 'TASK_DELTA',
      entries: [entry({ workId: 'RJ1', phase: 'metadata' })],
      counters: [],
    });
    expect(useTasksStore.getState().snapshot.pipelines[0]?.workId).toBe('RJ1');
  });

  it('setConnected 切换连接状态', () => {
    useTasksStore.getState().setConnected(true);
    expect(useTasksStore.getState().connected).toBe(true);
  });
});

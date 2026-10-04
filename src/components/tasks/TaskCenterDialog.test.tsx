// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  BatchInfo,
  Phase,
  PhaseEntry,
  PhaseStatus,
  TaskSnapshot,
  WorkPipelineState,
} from '../../api/tasks';
import PhaseDots from './PhaseDots';
import TaskCenterDialog from './TaskCenterDialog';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, vals?: Record<string, unknown>) =>
      vals ? `${key}:${JSON.stringify(vals)}` : key,
  }),
}));
vi.mock('@m3e/react/dialog', () => ({
  M3eDialog: (props: { children?: ReactNode }) => <div>{props.children}</div>,
}));
vi.mock('@m3e/react/button', () => ({
  M3eButton: (props: {
    children?: ReactNode;
    onClick?: () => void;
    slot?: string;
    variant?: string;
    className?: string;
  }) => (
    <button type='button' slot={props.slot} onClick={props.onClick}>
      {props.children}
    </button>
  ),
}));
const cancelTask = vi.fn();
vi.mock('../../api/tasks', () => ({
  cancelTask: (...args: unknown[]) => cancelTask(...args),
}));
// useTasks mock：注入测试快照（store 逻辑已由 stores/tasks.test 锚定）
const snapshotState = {
  current: {
    batches: [] as BatchInfo[],
    pipelines: [] as WorkPipelineState[],
    logs: [] as TaskSnapshot['logs'],
  },
};
vi.mock('../../hooks/useTasks', () => ({
  useTasks: () => ({ snapshot: snapshotState.current, connected: true }),
}));

afterEach(() => {
  cleanup();
  cancelTask.mockClear();
});

function phase(workId: string, ph: Phase, status: PhaseStatus) {
  return { workId, phase: ph, status, changedAt: 't' } as PhaseEntry;
}

describe('PhaseDots（阶段点状态映射）', () => {
  it('四阶段按序渲染，状态写入 data-status', () => {
    const pipeline: WorkPipelineState = {
      workId: 'RJ1',
      phases: {
        metadata: phase('RJ1', 'metadata', 'completed'),
        cover: phase('RJ1', 'cover', 'running'),
        track: phase('RJ1', 'track', 'failed'),
      },
      updatedAt: 't',
    };
    render(<PhaseDots pipeline={pipeline} />);
    const dots = screen.getAllByText(/[●⟳○－✗]/);
    expect(dots.map((d) => d.getAttribute('data-phase'))).toEqual([
      'metadata',
      'cover',
      'track',
      'analyze',
    ]);
    expect(dots.map((d) => d.getAttribute('data-status'))).toEqual([
      'completed',
      'running',
      'failed',
      'pending', // 未注入
    ]);
  });
});

describe('TaskCenterDialog', () => {
  function renderDialog() {
    render(<TaskCenterDialog open onClose={() => {}} />);
  }

  it('批次卡片：kind/进度/取消按钮（running 才有）', () => {
    snapshotState.current = {
      batches: [
        {
          batchId: 'scan-1',
          kind: 'scan',
          createdAt: 't',
          counters: {
            batchId: 'scan-1',
            kind: 'scan',
            total: 10,
            running: 3,
            completed: 6,
            failed: 1,
          },
          status: 'running',
        },
      ],
      pipelines: [
        {
          workId: 'RJ1',
          phases: {
            metadata: {
              ...phase('RJ1', 'metadata', 'completed'),
              batchId: 'scan-1',
            },
          },
          updatedAt: 't',
        },
      ],
      logs: [],
    };
    renderDialog();
    expect(screen.getByText('tasks.kind.scan')).toBeTruthy();
    expect(
      screen.getByText(
        `tasks.count.progress:${JSON.stringify({ done: 7, total: 10 })}`,
      ),
    ).toBeTruthy();
    const cancel = screen.getByText('tasks.cancel');
    fireEvent.click(cancel);
    expect(cancelTask).toHaveBeenCalledWith('scan-1');
  });

  it('过滤 failed：只显示失败批次', () => {
    snapshotState.current = {
      batches: [
        mkBatch('scan-ok', 'scan', 'completed'),
        mkBatch('analysis-bad', 'analysis', 'failed'),
      ],
      pipelines: [],
      logs: [],
    };
    renderDialog();
    fireEvent.click(screen.getByText('tasks.filter.failed'));
    expect(screen.getByText('tasks.kind.analysis')).toBeTruthy();
    expect(screen.queryByText('tasks.kind.scan')).toBeNull();
  });

  it('手动任务（阶段无 batchId）显示独立段落', () => {
    snapshotState.current = {
      batches: [],
      pipelines: [
        {
          workId: 'RJ2',
          phases: { track: { ...phase('RJ2', 'track', 'running') } },
          updatedAt: 't',
        },
      ],
      logs: [],
    };
    renderDialog();
    expect(screen.getByText('tasks.manual')).toBeTruthy();
    expect(screen.getByText('RJ2')).toBeTruthy();
  });

  it('空快照显示暂无任务', () => {
    snapshotState.current = { batches: [], pipelines: [], logs: [] };
    renderDialog();
    expect(screen.getByText('tasks.no-active')).toBeTruthy();
  });
});

function mkBatch(
  batchId: string,
  kind: BatchInfo['kind'],
  status: BatchInfo['status'],
): BatchInfo {
  return {
    batchId,
    kind,
    createdAt: 't',
    counters: { batchId, kind, total: 0, running: 0, completed: 0, failed: 0 },
    status,
  };
}

// @vitest-environment jsdom
import { forwardRef } from 'react';
import type { ReactNode } from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  BatchInfo,
  TaskSnapshot,
  WorkPipelineState,
} from '../../api/tasks';
import TaskCenterDialog from './TaskCenterDialog';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, vals?: Record<string, unknown>) =>
      vals ? `${key}:${JSON.stringify(vals)}` : key,
  }),
}));
vi.mock('@m3e/react/expansion-panel', () => ({
  M3eExpansionPanel: forwardRef<
    HTMLElement,
    { togglePosition?: string; children?: ReactNode }
  >((props, ref) => (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      data-testid='logs-panel'
      data-toggle-position={props.togglePosition}
    >
      {props.children}
    </div>
  )),
}));
const h = vi.hoisted(() => ({
  dialogClosed: undefined as ((e: Event) => void) | undefined,
}));
vi.mock('@m3e/react/dialog', () => ({
  M3eDialog: (props: {
    children?: ReactNode;
    onClosed?: (e: Event) => void;
  }) => {
    h.dialogClosed = props.onClosed;
    return <div data-testid='dialog'>{props.children}</div>;
  },
}));
vi.mock('@m3e/react/button', () => ({
  M3eButton: (props: {
    children?: ReactNode;
    onClick?: () => void;
    slot?: string;
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

// BatchCard mock：真实 M3eExpansionPanel 在 jsdom 无法注册（unhandled errors 源）；
// 断言降为透传层（kind/pipelines 经 props 传入）
const snapshotState = {
  current: {
    batches: [] as BatchInfo[],
    pipelines: [] as WorkPipelineState[],
    logs: [] as TaskSnapshot['logs'],
  },
};
const batchCardProps: Array<{
  batchId: string;
  kind: string;
  pipelines: WorkPipelineState[];
}> = [];
vi.mock('./BatchCard', () => ({
  default: (props: { batch: BatchInfo; pipelines: WorkPipelineState[] }) => {
    batchCardProps.push({
      batchId: props.batch.batchId,
      kind: props.batch.kind,
      pipelines: props.pipelines,
    });
    return (
      <div data-testid={`batch-${props.batch.batchId}`}>
        <span>{props.batch.kind}</span>
        {props.pipelines.map((p) => (
          <span key={p.workId}>{p.workId}</span>
        ))}
      </div>
    );
  },
}));
vi.mock('../../hooks/useTasks', () => ({
  useTasks: () => ({ snapshot: snapshotState.current, connected: true }),
}));

afterEach(() => {
  cleanup();
  cancelTask.mockClear();
});

function renderDialog() {
  batchCardProps.length = 0;
  render(<TaskCenterDialog open onClose={() => {}} />);
}

describe('TaskCenterDialog', () => {
  it('批次卡片：透传 batch 与 pipelines，取消按钮回调 batchId', () => {
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
              workId: 'RJ1',
              phase: 'metadata',
              status: 'completed',
              changedAt: 't',
              batchId: 'scan-1',
            },
          },
          updatedAt: 't',
        },
      ],
      logs: [],
    };
    renderDialog();
    const card = screen.getByTestId('batch-scan-1');
    expect(card.textContent).toContain('scan'); // kind 透传
    expect(card.textContent).toContain('RJ1'); // 批次内流水线透传
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
    expect(screen.getByTestId('batch-analysis-bad')).toBeTruthy();
    expect(screen.queryByTestId('batch-scan-ok')).toBeNull();
  });

  it('手动任务（阶段无 batchId）显示独立段落', () => {
    snapshotState.current = {
      batches: [],
      pipelines: [
        {
          workId: 'RJ2',
          phases: {
            track: {
              workId: 'RJ2',
              phase: 'track',
              status: 'running',
              changedAt: 't',
            },
          },
          updatedAt: 't',
        },
      ],
      logs: [],
    };
    renderDialog();
    expect(screen.getByText('tasks.manual')).toBeTruthy();
    expect(screen.getByText('RJ2')).toBeTruthy();
  });

  it('终态批次条目不漂移（workIds 固化名单优先于活流水线 batchId）', () => {
    // scan 批次已收尾并固化 workIds；update 批次随后重跑同作品（活流水线
    // phases[].batchId 已改指 update）——scan 卡仍应显示该作品
    snapshotState.current = {
      batches: [
        {
          batchId: 'scan-old',
          kind: 'scan',
          createdAt: 't',
          counters: {
            batchId: 'scan-old',
            kind: 'scan',
            total: 1,
            running: 0,
            completed: 1,
            failed: 0,
          },
          status: 'completed',
          workIds: ['RJ1'],
        },
        {
          batchId: 'update-new',
          kind: 'update',
          createdAt: 't2',
          counters: {
            batchId: 'update-new',
            kind: 'update',
            total: 1,
            running: 1,
            completed: 0,
            failed: 0,
          },
          status: 'running',
        },
      ],
      pipelines: [
        {
          workId: 'RJ1',
          phases: {
            metadata: {
              workId: 'RJ1',
              phase: 'metadata',
              status: 'running',
              changedAt: 't2',
              batchId: 'update-new',
            },
          },
          updatedAt: 't2',
        },
      ],
      logs: [],
    };
    renderDialog();
    // RJ1 同时出现在 scan-old（固化名单）与 update-new（实时 batchId）两张卡
    const scanCard = screen.getByTestId('batch-scan-old');
    expect(scanCard.textContent).toContain('RJ1');
    const updateCard = screen.getByTestId('batch-update-new');
    expect(updateCard.textContent).toContain('RJ1');
  });

  it('批次卡片倒序渲染（最新在最上）', () => {
    snapshotState.current = {
      batches: [
        mkBatch('old-1', 'scan', 'completed'),
        mkBatch('new-2', 'scan', 'running'),
      ],
      pipelines: [],
      logs: [],
    };
    renderDialog();
    // batchCardProps 按 renderDialog 清空后收集，顺序 = 渲染顺序
    expect(batchCardProps.map((p) => p.batchId)).toEqual(['new-2', 'old-1']);
  });

  it('日志面板收起的冒泡 closed 不关 dialog（dialog 自身 closed 才触发 onClose）', () => {
    const onClose = vi.fn();
    snapshotState.current = { batches: [], pipelines: [], logs: [] };
    render(<TaskCenterDialog open onClose={onClose} />);
    // panel 冒泡来的 closed：target ≠ currentTarget → 不触发
    act(() =>
      h.dialogClosed?.({ target: {}, currentTarget: {} } as unknown as Event),
    );
    expect(onClose).not.toHaveBeenCalled();
    // dialog 自身的 closed：target === currentTarget → 触发
    const self = {};
    act(() =>
      h.dialogClosed?.({
        target: self,
        currentTarget: self,
      } as unknown as Event),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
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

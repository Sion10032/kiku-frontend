// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BatchInfo, WorkPipelineState } from '../../api/tasks';
import TaskPanel from './TaskPanel';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, vals?: Record<string, unknown>) =>
      vals ? `${key}:${JSON.stringify(vals)}` : key,
  }),
}));
vi.mock('@m3e/react/icon', () => ({ M3eIcon: () => <span /> }));

const h = vi.hoisted(() => ({
  batches: [] as BatchInfo[],
  manualPipelines: [] as WorkPipelineState[],
  dialogOpen: false as boolean | undefined,
}));

vi.mock('../../hooks/useTasks', () => ({
  useBatches: () => h.batches,
  useActiveManualPipelines: () => h.manualPipelines,
}));
vi.mock('./TaskCenterDialog', () => ({
  default: (props: { open?: boolean; onClose?: () => void }) => {
    h.dialogOpen = props.open;
    return (
      <div data-testid='task-dialog' data-open={String(props.open === true)} />
    );
  },
}));

afterEach(() => {
  cleanup();
  h.batches = [];
  h.manualPipelines = [];
  h.dialogOpen = false;
});

function mkBatch(batchId: string, status: BatchInfo['status']): BatchInfo {
  return {
    batchId,
    kind: 'scan',
    createdAt: 't',
    counters: {
      batchId,
      kind: 'scan',
      total: 2,
      running: 0,
      completed: 2,
      failed: 0,
    },
    status,
  };
}

/** 活跃手动流水线（作品页高优注入，无 batchId） */
function mkManualRunning(workId: string): WorkPipelineState {
  return {
    workId,
    phases: {
      analyze: {
        workId,
        phase: 'analyze',
        status: 'running',
        changedAt: 't',
      },
    },
    updatedAt: 't',
  };
}

describe('TaskPanel（指示器行与稳定弹窗）', () => {
  it('有进行中批次：显示 active 文案与合计进度', () => {
    h.batches = [mkBatch('scan-1', 'running')];
    render(<TaskPanel />);
    expect(
      screen.getByText(`tasks.panel.active:${JSON.stringify({ n: 1 })}`),
    ).toBeTruthy();
    expect(screen.getByText(/tasks.count.progress/)).toBeTruthy();
  });

  it('批次与手动流水线同时在跑：活跃计数合计', () => {
    h.batches = [mkBatch('scan-1', 'running')];
    h.manualPipelines = [mkManualRunning('RJ700001')];
    render(<TaskPanel />);
    expect(
      screen.getByText(`tasks.panel.active:${JSON.stringify({ n: 2 })}`),
    ).toBeTruthy();
    expect(screen.getByText(/tasks.count.progress/)).toBeTruthy();
  });

  it('只有终态批次：显示 recent 文案（完成后入口保留，可查看 SUMMARY）', () => {
    h.batches = [mkBatch('scan-1', 'completed')];
    render(<TaskPanel />);
    expect(screen.getByText('tasks.panel.recent')).toBeTruthy();
  });

  it('无任何批次：不渲染指示器行', () => {
    render(<TaskPanel />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByTestId('task-dialog').getAttribute('data-open')).toBe(
      'false',
    );
  });

  it('无批次但有活跃手动流水线：渲染入口（手动任务在管理后台可见）', () => {
    h.manualPipelines = [mkManualRunning('RJ700001')];
    render(<TaskPanel />);
    expect(
      screen.getByText(`tasks.panel.active:${JSON.stringify({ n: 1 })}`),
    ).toBeTruthy();
    // 仅手动任务无批次 counters，不显示进度数字
    expect(screen.queryByText(/tasks.count.progress/)).toBeNull();
  });

  it('手动流水线终态且无批次：不渲染指示器行', () => {
    h.manualPipelines = [];
    render(<TaskPanel />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('点击指示器行打开弹窗；批次终态化不卸载弹窗（树位置稳定）', () => {
    h.batches = [mkBatch('scan-1', 'running')];
    const { rerender } = render(<TaskPanel />);
    fireEvent.click(screen.getByRole('button'));
    expect(h.dialogOpen).toBe(true);

    // 批次完成（running 消失）后弹窗仍挂载且保持打开——关键回归：旧实现
    // 分支切换会卸载 M3eDialog 触发 onClosed 自动关闭
    h.batches = [mkBatch('scan-1', 'completed')];
    rerender(<TaskPanel />);
    expect(screen.getByTestId('task-dialog').getAttribute('data-open')).toBe(
      'true',
    );
    expect(screen.getByText('tasks.panel.recent')).toBeTruthy();
  });
});

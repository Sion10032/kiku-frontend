// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { forwardRef } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BatchInfo, WorkPipelineState } from '../../api/tasks';
import BatchCard from './BatchCard';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, vals?: Record<string, unknown>) =>
      vals ? `${key}:${JSON.stringify(vals)}` : key,
  }),
}));
vi.mock('@m3e/react/button', () => ({
  M3eButton: (props: {
    children?: ReactNode;
    onClick?: (e: { stopPropagation: () => void }) => void;
  }) => (
    <button
      type='button'
      onClick={(e) =>
        props.onClick?.({ stopPropagation: () => e.stopPropagation() })
      }
    >
      {props.children}
    </button>
  ),
}));
vi.mock('./PhaseDots', () => ({ default: () => <span data-testid='dots' /> }));

// expansion-panel mock：forwardRef 承接 ref（useEffect 设 ref.current.open）
const h = vi.hoisted(() => ({
  togglePosition: undefined as string | undefined,
  disabled: false,
}));

vi.mock('@m3e/react/expansion-panel', () => ({
  M3eExpansionPanel: forwardRef<
    HTMLElement,
    {
      togglePosition?: string;
      disabled?: boolean;
      children?: ReactNode;
    }
  >((props, ref) => {
    h.togglePosition = props.togglePosition;
    h.disabled = props.disabled === true;
    return (
      <div
        ref={ref as React.Ref<HTMLDivElement>}
        data-testid='panel'
        data-toggle-position={props.togglePosition}
        data-disabled={String(props.disabled === true)}
      >
        {props.children}
      </div>
    );
  }),
}));

vi.mock('@m3e/react/button', () => ({
  M3eButton: (props: {
    children?: ReactNode;
    onClick?: (e: { stopPropagation: () => void }) => void;
  }) => (
    <button
      type='button'
      onClick={(e) =>
        props.onClick?.({ stopPropagation: () => e.stopPropagation() })
      }
    >
      {props.children}
    </button>
  ),
}));

const onCancel = vi.fn();

afterEach(() => {
  cleanup();
  onCancel.mockClear();
});

function mkBatch(status: BatchInfo['status']): BatchInfo {
  return {
    batchId: 'scan-1',
    kind: 'scan',
    createdAt: 't',
    counters: {
      batchId: 'scan-1',
      kind: 'scan',
      total: 3,
      running: 1,
      completed: 1,
      failed: 1,
    },
    status,
  };
}

function mkPipelines(): WorkPipelineState[] {
  return [
    {
      workId: 'RJ1',
      phases: {
        metadata: {
          workId: 'RJ1',
          phase: 'metadata',
          status: 'completed',
          changedAt: 't',
        },
      },
      updatedAt: 't',
    },
    {
      workId: 'RJ2',
      phases: {
        metadata: {
          workId: 'RJ2',
          phase: 'metadata',
          status: 'failed',
          error: 'DLsite 429',
          changedAt: 't',
        },
      },
      updatedAt: 't',
    },
  ];
}

describe('BatchCard（m3e-expansion-panel）', () => {
  it('running 批次初始展开（open=true）；completed 初始收起', () => {
    const running = render(
      <BatchCard
        batch={mkBatch('running')}
        pipelines={mkPipelines()}
        onCancel={onCancel}
      />,
    );
    expect(
      (screen.getByTestId('panel') as HTMLElement & { open?: boolean }).open,
    ).toBe(true);
    running.unmount();

    render(
      <BatchCard
        batch={mkBatch('completed')}
        pipelines={mkPipelines()}
        onCancel={onCancel}
      />,
    );
    expect(
      (screen.getByTestId('panel') as HTMLElement & { open?: boolean }).open,
    ).toBeFalsy();
  });

  it('无流水线的批次 disabled（toggle 展示但不可点击展开）', () => {
    render(
      <BatchCard
        batch={mkBatch('completed')}
        pipelines={[]}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByTestId('panel').getAttribute('data-disabled')).toBe(
      'true',
    );
    expect(screen.getByText('tasks.kind.scan')).toBeTruthy();
  });

  it('toggle 统一在左侧（toggle-position=before）', () => {
    render(
      <BatchCard
        batch={mkBatch('completed')}
        pipelines={mkPipelines()}
        onCancel={onCancel}
      />,
    );
    expect(
      screen.getByTestId('panel').getAttribute('data-toggle-position'),
    ).toBe('before');
  });

  it('取消按钮阻断冒泡（不触发面板 toggle）并回调 batchId', () => {
    render(
      <BatchCard
        batch={mkBatch('running')}
        pipelines={mkPipelines()}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByText('tasks.cancel'));
    expect(onCancel).toHaveBeenCalledWith('scan-1');
  });

  it('失败行渲染错误消息；进度合计渲染', () => {
    render(
      <BatchCard
        batch={mkBatch('running')}
        pipelines={mkPipelines()}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByText('DLsite 429')).toBeTruthy();
    expect(screen.getByText(/tasks.count.progress/)).toBeTruthy();
  });
});

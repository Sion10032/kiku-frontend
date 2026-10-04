import type { Phase, PhaseStatus, WorkPipelineState } from '../../api/tasks';

export const PHASE_ORDER: readonly Phase[] = [
  'metadata',
  'cover',
  'track',
  'analyze',
] as const;

/** 状态符号：● 完成 / ⟳ 运行中 / ○ 未注入 / － 跳过 / ✗ 失败 */
const SYMBOL: Record<PhaseStatus, string> = {
  completed: '●',
  running: '⟳',
  pending: '○',
  skipped: '－',
  failed: '✗',
};

const COLOR: Record<PhaseStatus, string> = {
  completed: 'text-[var(--md-sys-color-primary)]',
  running: 'text-[var(--md-sys-color-tertiary)]',
  pending: 'opacity-40',
  skipped: 'opacity-40',
  failed: 'text-[var(--md-sys-color-error)]',
};

/**
 * 单作品流水线阶段点（metadata → cover → track → analyze）。
 * 无该阶段记录视为未注入（○ pending）。
 */
export default function PhaseDots({
  pipeline,
}: {
  pipeline: WorkPipelineState;
}) {
  return (
    <span className='inline-flex items-center gap-1 font-mono text-sm leading-none'>
      {PHASE_ORDER.map((phase) => {
        const status: PhaseStatus = pipeline.phases[phase]?.status ?? 'pending';
        return (
          <span
            key={phase}
            data-phase={phase}
            data-status={status}
            title={`${phase}: ${status}`}
            className={`${COLOR[status]} ${status === 'running' ? 'animate-pulse' : ''}`}
          >
            {SYMBOL[status]}
          </span>
        );
      })}
    </span>
  );
}

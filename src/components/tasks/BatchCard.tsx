import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { M3eButton } from '@m3e/react/button';
import type { BatchInfo, WorkPipelineState } from '../../api/tasks';
import PhaseDots from './PhaseDots';

/**
 * 批次卡片：kind 标签 + 进度条（completed/total）+ 状态 + 取消按钮；
 * 展开显示批次内各作品流水线阶段点（含失败原因）。
 */
export default function BatchCard({
  batch,
  pipelines,
  onCancel,
}: {
  batch: BatchInfo;
  pipelines: WorkPipelineState[];
  onCancel: (batchId: string) => void;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(batch.status === 'running');

  const done = batch.counters.completed + batch.counters.failed;
  const pct =
    batch.counters.total > 0
      ? Math.round((done / batch.counters.total) * 100)
      : 0;
  const statusKey = `tasks.status.${batch.status}` as const;
  const kindKey = `tasks.kind.${batch.kind}` as const;
  const failedPipelines = pipelines.filter((p) =>
    Object.values(p.phases).some((ph) => ph.status === 'failed'),
  );
  const visible =
    expanded || batch.status === 'running' ? pipelines : failedPipelines;

  return (
    <div className='rounded-md border border-[var(--md-sys-color-outline-variant)] p-3'>
      <div className='flex items-center gap-2'>
        <span className='shrink-0 rounded bg-[var(--md-sys-color-surface-variant)] px-2 py-0.5 text-xs'>
          {t(kindKey)}
        </span>
        <span className='min-w-0 flex-1 truncate text-xs opacity-60'>
          {t(statusKey)}
          {batch.completedAt ? ` · ${batch.completedAt}` : ''}
        </span>
        {batch.status === 'running' && (
          <M3eButton
            variant='text'
            className='shrink-0 text-[var(--md-sys-color-error)]'
            onClick={() => onCancel(batch.batchId)}
          >
            {t('tasks.cancel')}
          </M3eButton>
        )}
      </div>

      <div className='mt-2 flex items-center gap-2'>
        <div className='h-1 flex-1 overflow-hidden rounded-full bg-[var(--md-sys-color-surface-variant)]'>
          <div
            className='h-full bg-[var(--md-sys-color-primary)] transition-[width]'
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className='shrink-0 text-xs tabular-nums opacity-70'>
          {t('tasks.count.progress', { done, total: batch.counters.total })}
        </span>
      </div>

      {pipelines.length > 0 && (
        <button
          type='button'
          className='mt-2 text-xs opacity-60 hover:opacity-100'
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded
            ? t('tasks.collapse')
            : t('tasks.expand', { n: pipelines.length })}
        </button>
      )}

      {visible.length > 0 && (
        <ul className='mt-1 flex flex-col gap-1'>
          {visible.map((p) => {
            const failedPhase = Object.values(p.phases).find(
              (ph) => ph.status === 'failed',
            );
            return (
              <li key={p.workId} className='flex items-center gap-2 text-xs'>
                <span className='w-24 shrink-0 truncate font-mono'>
                  {p.workId}
                </span>
                <PhaseDots pipeline={p} />
                {failedPhase?.error && (
                  <span
                    className='min-w-0 flex-1 truncate text-[var(--md-sys-color-error)]'
                    title={failedPhase.error}
                  >
                    {failedPhase.error}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

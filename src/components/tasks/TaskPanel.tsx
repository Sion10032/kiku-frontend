import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { M3eIcon } from '@m3e/react/icon';
import { useBatches } from '../../hooks/useTasks';
import TaskCenterDialog from './TaskCenterDialog';

/**
 * 音声管理页任务面板：有活跃批次时显示指示器行（合计进度，点击开任务中心），
 * 空闲时渲染裸弹窗（无可见内容，不占布局）。单一状态源 useTasks。
 */
export default function TaskPanel() {
  const { t } = useTranslation();
  const batches = useBatches();
  const [open, setOpen] = useState(false);

  const active = batches.filter((b) => b.status === 'running');
  const totals = active.reduce(
    (acc, b) => ({
      done: acc.done + b.counters.completed + b.counters.failed,
      total: acc.total + b.counters.total,
    }),
    { done: 0, total: 0 },
  );

  const dialog = (
    <TaskCenterDialog open={open} onClose={() => setOpen(false)} />
  );

  if (active.length === 0) return dialog;

  return (
    <div className='flex flex-col gap-2'>
      <button
        type='button'
        onClick={() => setOpen(true)}
        className='flex w-full items-center gap-2 rounded-md border border-[var(--md-sys-color-outline-variant)] px-3 py-2 text-left text-sm'
      >
        <M3eIcon name='pending' className='shrink-0 animate-pulse' />
        <span className='min-w-0 flex-1 truncate'>
          {t('tasks.panel.active', { n: active.length })}
        </span>
        <span className='shrink-0 text-xs tabular-nums opacity-70'>
          {t('tasks.count.progress', {
            done: totals.done,
            total: totals.total,
          })}
        </span>
        <M3eIcon
          name='chevron_right'
          aria-hidden='true'
          className='shrink-0 opacity-60'
        />
      </button>
      {dialog}
    </div>
  );
}

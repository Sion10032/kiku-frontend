import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { M3eIcon } from '@m3e/react/icon';
import '@m3e/icons/outlined/pending';
import '@m3e/icons/outlined/chevron_right';
import { useBatches } from '../../hooks/useTasks';
import TaskCenterDialog from './TaskCenterDialog';

/**
 * 音声管理页任务面板：有批次时显示指示器行（进行中合计进度 / 最近批次摘要，
 * 点击开任务中心），无任何批次时只渲染裸弹窗（不占布局）。
 *
 * 弹窗必须渲染在稳定的树位置（Fragment 直挂，不随指示器行条件分支切换）：
 * 否则批次 running→终态的瞬间分支切换会卸载重挂 M3eDialog，
 * 触发 onClosed 自动关闭（运行完成后弹窗闪退的根因）。
 * 终态批次在后端有 5 分钟 TTL——完成后入口仍保留可查看 SUMMARY。
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

  if (batches.length === 0) return dialog;

  return (
    <>
      <button
        type='button'
        onClick={() => setOpen(true)}
        className='flex w-full items-center gap-2 rounded-md border border-[var(--md-sys-color-outline-variant)] px-3 py-2 text-left text-sm'
      >
        <M3eIcon
          name='pending'
          className={active.length > 0 ? 'shrink-0 animate-pulse' : 'shrink-0'}
        />
        <span className='min-w-0 flex-1 truncate'>
          {active.length > 0
            ? t('tasks.panel.active', { n: active.length })
            : t('tasks.panel.recent')}
        </span>
        {active.length > 0 && (
          <span className='shrink-0 text-xs tabular-nums opacity-70'>
            {t('tasks.count.progress', {
              done: totals.done,
              total: totals.total,
            })}
          </span>
        )}
        <M3eIcon
          name='chevron_right'
          aria-hidden='true'
          className='shrink-0 opacity-60'
        />
      </button>
      {dialog}
    </>
  );
}

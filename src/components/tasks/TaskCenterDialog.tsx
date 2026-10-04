import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { M3eButton } from '@m3e/react/button';
import { M3eDialog } from '@m3e/react/dialog';
import { cancelTask } from '../../api/tasks';
import { useTasks } from '../../hooks/useTasks';
import BatchCard from './BatchCard';
import TaskLogList from './TaskLogList';

type Filter = 'all' | 'active' | 'failed';

/**
 * 任务中心弹窗：批次卡片（scan/update/analysis）+ 手动单作品任务行 +
 * 过滤（全部/进行中/失败）+ 折叠日志。单一状态源 useTasks。
 */
export default function TaskCenterDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { snapshot, connected } = useTasks();
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = snapshot.batches.filter((b) => {
    if (filter === 'active') return b.status === 'running';
    if (filter === 'failed') return b.status === 'failed';
    return true;
  });
  // 手动任务：阶段均无 batchId 的流水线（作品页高优注入省略 batchId）
  const manualPipelines = snapshot.pipelines.filter((p) =>
    Object.values(p.phases).every((ph) => !ph.batchId),
  );
  const pipelinesOf = (batchId: string) =>
    snapshot.pipelines.filter((p) =>
      Object.values(p.phases).some((ph) => ph.batchId === batchId),
    );

  const filters: Array<{ key: Filter; label: string }> = [
    { key: 'all', label: t('tasks.filter.all') },
    { key: 'active', label: t('tasks.filter.active') },
    { key: 'failed', label: t('tasks.filter.failed') },
  ];

  return (
    <M3eDialog
      open={open}
      dismissible
      closeLabel={t('common.close')}
      onClosed={onClose}
    >
      <span slot='header'>{t('tasks.title')}</span>
      <div className='flex max-h-[70vh] w-[min(560px,80vw)] flex-col gap-3 overflow-y-auto'>
        {!connected && (
          <p className='m-0 text-xs opacity-60'>{t('tasks.disconnected')}</p>
        )}

        <div
          className='flex gap-1'
          role='tablist'
          aria-label={t('tasks.title')}
        >
          {filters.map((f) => (
            <button
              key={f.key}
              type='button'
              role='tab'
              aria-selected={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-3 py-1 text-xs ${
                filter === f.key
                  ? 'bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)]'
                  : 'bg-[var(--md-sys-color-surface-variant)]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {filtered.length === 0 && manualPipelines.length === 0 && (
          <p className='m-0 text-sm opacity-60'>{t('tasks.no-active')}</p>
        )}

        <div className='flex flex-col gap-2'>
          {filtered.map((b) => (
            <BatchCard
              key={b.batchId}
              batch={b}
              pipelines={pipelinesOf(b.batchId)}
              onCancel={(id) => void cancelTask(id)}
            />
          ))}
        </div>

        {manualPipelines.length > 0 && (
          <section className='flex flex-col gap-1'>
            <h3 className='m-0 text-xs font-semibold uppercase opacity-60'>
              {t('tasks.manual')}
            </h3>
            {manualPipelines.map((p) => (
              <div key={p.workId} className='flex items-center gap-2 text-xs'>
                <span className='w-24 shrink-0 truncate font-mono'>
                  {p.workId}
                </span>
                <code className='font-mono'>{JSON.stringify(p.phases)}</code>
              </div>
            ))}
          </section>
        )}

        <details>
          <summary className='cursor-pointer text-xs opacity-60'>
            {t('tasks.logs')}
          </summary>
          <div className='mt-1'>
            <TaskLogList logs={snapshot.logs} />
          </div>
        </details>
      </div>
      <div slot='actions' className='flex justify-end'>
        <M3eButton variant='text' onClick={onClose}>
          {t('common.close')}
        </M3eButton>
      </div>
    </M3eDialog>
  );
}

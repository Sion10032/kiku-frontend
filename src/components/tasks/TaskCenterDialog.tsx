import { clsx } from 'clsx';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { M3eButton } from '@m3e/react/button';
import { M3eDialog } from '@m3e/react/dialog';
import { M3eExpansionPanel } from '@m3e/react/expansion-panel';
import type { M3eExpansionPanelElement } from '@m3e/web/expansion-panel';
import { cancelTask } from '../../api/tasks';
import { useTasks } from '../../hooks/useTasks';
import BatchCard from './BatchCard';
import TaskLogList from './TaskLogList';

type Filter = 'all' | 'active' | 'failed';

/**
 * 任务中心弹窗：批次卡片（scan/update/analysis）+ 手动单作品任务行 +
 * 过滤（全部/进行中/失败）+ 日志面板（expansion panel）。单一状态源 useTasks。
 *
 * 高度布局固定：内容区 h-[60dvh]（dialog 高度恒定），上方批次区
 * flex-1 单独滚动，下方日志面板默认展开（内容区 h-[40dvh] = 内容区的 2/3，
 * 内部滚动），可折叠给批次区腾空间。
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
  // 日志面板非受控（同 BatchCard：SSE 快照高频重渲染下受控 open 会被拉回旧值打断动画）
  const logsPanelRef = useRef<M3eExpansionPanelElement>(null);
  useEffect(() => {
    // 日志默认展开
    if (logsPanelRef.current) logsPanelRef.current.open = true;
  }, []);

  // 倒序：最新批次在最上（批次快照按时间正序追加，同日志区倒序惯例）
  const filtered = [...snapshot.batches].reverse().filter((b) => {
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
      // 只响应 dialog 自身的关闭事件：expansion panel 收起时也会派发
      // bubbles 的 closed（冒泡到 dialog 宿主），不能误触发 onClose
      onClosed={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      // 尺寸对齐 MetadataEditDialog：小屏 95vw，lg 及以上 60vw，高度限 90dvh
      className={clsx(
        '[--m3e-dialog-min-width:95vw] [--m3e-dialog-max-width:95vw]',
        'lg:[--m3e-dialog-min-width:60vw] lg:[--m3e-dialog-max-width:60vw]',
        '[--m3e-dialog-max-height:90dvh]',
      )}
    >
      <span slot='header'>{t('tasks.title')}</span>
      <div className='flex h-[60dvh] flex-col gap-3 overflow-x-hidden'>
        {!connected && (
          <p className='m-0 shrink-0 text-xs opacity-60'>
            {t('tasks.disconnected')}
          </p>
        )}

        <div
          className='flex shrink-0 gap-1'
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

        {/* 批次区：单独滚动，不撑开 dialog */}
        <div className='flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1'>
          {filtered.length === 0 && manualPipelines.length === 0 && (
            <p className='m-0 text-sm opacity-60'>{t('tasks.no-active')}</p>
          )}
          {filtered.map((b) => (
            <BatchCard
              key={b.batchId}
              batch={b}
              pipelines={pipelinesOf(b.batchId)}
              onCancel={(id) => void cancelTask(id)}
            />
          ))}

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
        </div>

        {/* 日志面板：m3e expansion panel（同 BatchCard），默认展开，展开时内容区占 2/3；
            滚动在面板内容包裹层；动画时长显式恢复（dialog 动画压制块继承外溢） */}
        <M3eExpansionPanel
          ref={logsPanelRef}
          togglePosition='before'
          className={clsx(
            'shrink-0 rounded-md border border-[var(--md-sys-color-outline-variant)]',
            '[--m3e-expansion-header-padding-left:12px] [--m3e-expansion-header-padding-right:16px]',
            '[--m3e-collapsible-animation-duration:250ms]',
          )}
        >
          <span
            slot='header'
            className='text-xs font-semibold uppercase opacity-60'
          >
            {t('tasks.logs')}
          </span>
          <div className='flex h-[36dvh] flex-col p-2'>
            <div className='min-h-0 flex-1 overflow-y-auto'>
              <TaskLogList logs={snapshot.logs} />
            </div>
          </div>
        </M3eExpansionPanel>
      </div>
      <div slot='actions' className='flex justify-end'>
        <M3eButton variant='text' onClick={onClose}>
          {t('common.close')}
        </M3eButton>
      </div>
    </M3eDialog>
  );
}

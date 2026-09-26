import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { M3eDialog } from '@m3e/react/dialog';
import { M3eCard } from '@m3e/react/card';
import { M3eIcon } from '@m3e/react/icon';
import '@m3e/icons/outlined/check_circle';
import '@m3e/icons/outlined/error';
import '@m3e/icons/outlined/play_arrow';
import type { ScanLogPayload, ScanTaskPayload } from '../../types';

export type ScanState = 'idle' | 'running' | 'finished' | 'error';

/**
 * 扫描结果消息：存 key + 数值参数，渲染时经 t() 本地化
 * （避免语言切换后残留旧语言文案，handleEvent 依赖数组也无需引入 t）。
 */
export type ScanResultMessage = {
  key:
    | 'dashboard.scan.scan-ended'
    | 'dashboard.scan.finish-scan'
    | 'dashboard.scan.finish-update'
    | 'dashboard.scan.finish-scan-short'
    | 'dashboard.scan.finish-update-short';
  values?: Record<string, number>;
};

interface Props {
  open: boolean;
  onClose: () => void;
  logs: ScanLogPayload[];
  tasks: ScanTaskPayload[];
  failedTasks: ScanTaskPayload[];
  state: ScanState;
  resultMessage: ScanResultMessage | null;
  completedCount: number;
}

/**
 * 扫描详情弹窗：原 Scanner 状态卡片（头部 + 主日志 + 任务面板）整体迁入。
 *
 * - 主日志滚动区贴底逻辑随迁：用户滚动离开底部即暂停自动贴底，
 *   滚回底部（距底 < 40px）恢复。
 * - M3eDialog 用法对齐 MetadataEditDialog（open / onClosed / dismissible /
 *   closeLabel / slot='header'）；宽度 90vw 窄屏友好，限高交给 dialog
 *   内置滚动容器（内容区自带 max-h 的日志/任务面板）。
 */
export default function ScanDetailDialog({
  open,
  onClose,
  logs,
  tasks,
  failedTasks,
  state,
  resultMessage,
  completedCount,
}: Props) {
  const { t } = useTranslation();

  const logRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);

  // logs 变化或弹窗打开时，若用户仍贴底则滚动到底
  // （open 进依赖：首次打开时 logs 未必变化，需要挂载后贴底一次）
  useEffect(() => {
    if (!open) return;
    const el = logRef.current;
    if (el && stickToBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [logs, open]);

  function handleLogScroll() {
    const el = logRef.current;
    if (!el) return;
    stickToBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  }

  if (!open) return null;

  const isRunning = state === 'running';

  return (
    <M3eDialog
      className='[--m3e-dialog-min-width:90vw] [--m3e-dialog-max-width:90vw] [--m3e-dialog-max-height:90dvh]'
      open={open}
      onClosed={onClose}
      dismissible
      closeLabel={t('common.close')}
    >
      <span slot='header'>{t('dashboard.audio.scan-detail')}</span>
      <div className='flex flex-col gap-4'>
        {/* 状态卡片头部 + 主日志 */}
        <M3eCard>
          <div slot='header' className='flex items-center gap-3'>
            {isRunning && (
              <span className='inline-block h-5 w-5 animate-spin rounded-full border-2 border-[var(--md-sys-color-primary)] border-t-transparent' />
            )}
            {state === 'finished' && (
              <M3eIcon
                name='check_circle'
                className='text-[var(--md-sys-color-primary)]'
              />
            )}
            {state === 'error' && (
              <M3eIcon
                name='error'
                className='text-[var(--md-sys-color-error)]'
              />
            )}
            <span className='text-sm font-medium'>
              {isRunning && t('dashboard.scan.running')}
              {state === 'finished'
                && (resultMessage
                  ? t(resultMessage.key, resultMessage.values)
                  : t('dashboard.scan.finish-scan-short'))}
              {state === 'error' && t('dashboard.scan.error')}
            </span>
          </div>

          <div slot='content'>
            <div
              ref={logRef}
              onScroll={handleLogScroll}
              className='max-h-64 overflow-y-auto rounded-md p-3 font-mono text-xs'
              style={{
                background: 'var(--md-sys-color-surface-container-highest)',
              }}
            >
              {logs.map((log, i) => (
                <div
                  key={i}
                  className={
                    log.level === 'error'
                      ? 'text-[var(--md-sys-color-error)]'
                      : 'text-[var(--md-sys-color-on-surface)]'
                  }
                >
                  {log.message}
                </div>
              ))}
              {logs.length === 0 && (
                <div className='opacity-50'>
                  {t('dashboard.scan.waiting-logs')}
                </div>
              )}
            </div>
          </div>
        </M3eCard>

        {/* 处理中任务 */}
        {tasks.length > 0 && (
          <M3eCard>
            <div slot='header' className='flex items-center gap-2'>
              <M3eIcon
                name='play_arrow'
                className='text-[var(--md-sys-color-primary)]'
              />
              <span className='text-sm font-medium'>
                {t('dashboard.scan.in-progress', { n: tasks.length })}
              </span>
              {completedCount > 0 && (
                <span className='text-xs opacity-60'>
                  {t('dashboard.scan.completed', { n: completedCount })}
                </span>
              )}
            </div>
            <div slot='content'>
              <div className='max-h-80 overflow-y-auto'>
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className='border-b border-[var(--md-sys-color-outline-variant)] py-2 last:border-b-0'
                  >
                    <span className='text-sm'>{task.title}</span>
                    <span className='ml-2 text-xs opacity-50'>
                      {task.status === 'scanning'
                        ? t('dashboard.scan.task-scanning')
                        : t('dashboard.scan.task-waiting')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </M3eCard>
        )}

        {/* 失败任务 */}
        {failedTasks.length > 0 && (
          <M3eCard>
            <div slot='header' className='flex items-center gap-2'>
              <M3eIcon
                name='error'
                className='text-[var(--md-sys-color-error)]'
              />
              <span className='text-sm font-medium'>
                {t('dashboard.scan.failed-count', { n: failedTasks.length })}
              </span>
            </div>
            <div slot='content'>
              <div className='max-h-80 overflow-y-auto'>
                {failedTasks.map((task) => (
                  <div
                    key={task.id}
                    className='border-b border-[var(--md-sys-color-outline-variant)] py-2 last:border-b-0'
                  >
                    <span className='text-sm'>{task.title}</span>
                    {task.error && (
                      <div className='text-xs text-[var(--md-sys-color-error)]'>
                        {task.error}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </M3eCard>
        )}
      </div>
    </M3eDialog>
  );
}

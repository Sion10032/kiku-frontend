import { useState } from 'react';
import { M3eIcon } from '@m3e/react/icon';
import '@m3e/icons/outlined/check_circle';
import '@m3e/icons/outlined/error';
import '@m3e/icons/outlined/chevron_right';
import { useTranslation } from 'react-i18next';
import AnalysisDetailDialog from './AnalysisDetailDialog';
import type { AnalysisEvents } from './useAnalysisEvents';

/**
 * 响度分析面板（展示层）：非 idle 时显示指示器行（最新日志/汇总 + 计数徽标），
 * 点击打开详情弹窗（不自动弹窗，模态打断浏览）；ffmpeg 缺失时置顶安装指引。
 * SSE 状态与动作在 useAnalysisEvents，按钮行由音声管理页渲染。
 */
export default function AnalysisPanel({ ev }: { ev: AnalysisEvents }) {
  const { t } = useTranslation();
  const { state, snapshot, resultMessage, ffmpegMissing } = ev;
  const [detailOpen, setDetailOpen] = useState(false);

  const tasks = snapshot?.tasks ?? [];
  const failedTasks = snapshot?.failedTasks ?? [];
  const logs = snapshot?.logs ?? [];
  const isRunning = state === 'running';
  const lastLog = logs.length > 0 ? logs[logs.length - 1] : null;

  const detailDialog = (
    <AnalysisDetailDialog
      open={detailOpen}
      onClose={() => setDetailOpen(false)}
      logs={logs}
      tasks={tasks}
      failedTasks={failedTasks}
      state={state}
      resultMessage={resultMessage}
      completedCount={snapshot?.completed ?? 0}
    />
  );

  // idle 且无 ffmpeg 警告时无可见内容（弹窗入口只存在于指示器行，open 必为
  // false）：返回裸弹窗（渲染为 null），避免空 wrapper div 撑出多余 gap
  if (state === 'idle' && !ffmpegMissing) return detailDialog;

  return (
    <div className='flex flex-col gap-3'>
      {/* ffmpeg 缺失：置顶安装指引 */}
      {ffmpegMissing && (
        <div
          className='flex items-start gap-2 rounded-md border border-[var(--md-sys-color-error)] p-3 text-sm'
          style={{
            background: 'var(--md-sys-color-surface-container-highest)',
          }}
        >
          <M3eIcon name='error' className='text-[var(--md-sys-color-error)]' />
          <span>{t('dashboard.analysis.ffmpeg-missing')}</span>
        </div>
      )}

      {/* 指示器行：非 idle 时展示，整行可点开详情弹窗 */}
      {state !== 'idle' && (
        <button
          type='button'
          onClick={() => setDetailOpen(true)}
          className='flex w-full items-center gap-2 rounded-md border border-[var(--md-sys-color-outline-variant)] px-3 py-2 text-left'
        >
          {isRunning && (
            <span className='inline-block h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-[var(--md-sys-color-primary)] border-t-transparent' />
          )}
          {state === 'finished' && (
            <M3eIcon
              name='check_circle'
              className='shrink-0 text-[var(--md-sys-color-primary)]'
            />
          )}
          {state === 'error' && (
            <M3eIcon
              name='error'
              className='shrink-0 text-[var(--md-sys-color-error)]'
            />
          )}
          <span className='min-w-0 flex-1 truncate text-sm'>
            {isRunning
              && (lastLog?.message ?? t('dashboard.analysis.waiting-logs'))}
            {state === 'finished'
              && (resultMessage
                ? t(resultMessage.key, resultMessage.values)
                : t('dashboard.analysis.finish-short'))}
            {state === 'error' && t('dashboard.analysis.error')}
          </span>
          {tasks.length > 0 && (
            <span className='shrink-0 text-xs opacity-60'>
              {t('dashboard.analysis.in-progress', { n: tasks.length })}
            </span>
          )}
          {failedTasks.length > 0 && (
            <span className='shrink-0 text-xs text-[var(--md-sys-color-error)]'>
              {t('dashboard.analysis.failed-count', { n: failedTasks.length })}
            </span>
          )}
          {/* 纯装饰箭头，避免读屏念出 ligature 文本 */}
          <M3eIcon
            name='chevron_right'
            aria-hidden='true'
            className='shrink-0 opacity-60'
          />
        </button>
      )}

      {detailDialog}
    </div>
  );
}

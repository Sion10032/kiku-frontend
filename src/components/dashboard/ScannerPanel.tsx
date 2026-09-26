import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { M3eButton } from '@m3e/react/button';
import { M3eIcon } from '@m3e/react/icon';
import { M3eSnackbar } from '@m3e/react/snackbar';
import '@m3e/icons/outlined/play_arrow';
import '@m3e/icons/outlined/stop';
import '@m3e/icons/outlined/sync';
import '@m3e/icons/outlined/check_circle';
import '@m3e/icons/outlined/error';
import '@m3e/icons/outlined/chevron_right';
import { useSSE } from '../../hooks/useSSE';
import { startScan, killScan, type ScanMode } from '../../api/scanner';
import { showApiError } from '../../utils/apiError';
import type {
  ScanInitState,
  ScanLogPayload,
  ScanTaskPayload,
} from '../../types';
import ScanDetailDialog, {
  type ScanResultMessage,
  type ScanState,
} from './ScanDetailDialog';

/**
 * 扫描器面板（自包含，无 props）。
 *
 * - SSE 订阅 /api/scanner/events，实时接收日志与任务状态。
 * - 三按钮：扫描、更新（可选）、终止。
 * - 非 idle 时显示指示器行（最新日志/汇总 + 计数徽标），点击打开详情弹窗
 *   （不自动弹窗，模态打断浏览）。
 */
export default function ScannerPanel() {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<ScanTaskPayload[]>([]); // 仅 pending/scanning
  const [failedTasks, setFailedTasks] = useState<ScanTaskPayload[]>([]);
  const [mainLogs, setMainLogs] = useState<ScanLogPayload[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [state, setState] = useState<ScanState>('idle');
  const [resultMessage, setResultMessage] = useState<ScanResultMessage | null>(
    null,
  );
  const [detailOpen, setDetailOpen] = useState(false);
  // SCAN_RESULTS 先于 SCAN_FINISHED 到达，用 ref 规避 useCallback 闭包陈旧
  const resultsRef = useRef<{
    added: number;
    updated: number;
    failed: number;
    skipped: number;
  } | null>(null);
  const modeRef = useRef<ScanMode>('scan'); // SCAN_FINISHED 时区分文案

  // 用 ref 持有最新 state，避免 SSE 回调闭包陈旧；每次渲染后同步
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  const handleEvent = useCallback((event: string, data: unknown) => {
    const d = data as Record<string, unknown>;

    switch (event) {
      case 'SCAN_INIT_STATE': {
        const init = data as ScanInitState;
        if (init.isScanning) {
          setState('running');
          if (init.snapshot) {
            if (init.snapshot.mode) modeRef.current = init.snapshot.mode;
            setTasks(init.snapshot.tasks);
            setFailedTasks(init.snapshot.failedTasks);
            setMainLogs(init.snapshot.logs);
            setCompletedCount(init.snapshot.completed);
          }
        } else if (stateRef.current === 'running') {
          // 重连时后端已不在扫描（SCAN_FINISHED 在断线期间错过），
          // 复位本地 running 状态，避免永远停留在「扫描进行中…」
          setState('finished');
          setResultMessage({ key: 'dashboard.scan.scan-ended' });
        }
        break;
      }
      case 'SCAN_TASK': {
        const task = (d as { task: ScanTaskPayload }).task;
        if (task.status === 'completed') {
          setTasks((prev) => prev.filter((t) => t.id !== task.id));
          setCompletedCount((c) => c + 1);
        } else if (task.status === 'failed') {
          setTasks((prev) => prev.filter((t) => t.id !== task.id));
          setFailedTasks((prev) => [...prev, task]);
        } else {
          // pending/scanning：按 id upsert，保持顺序
          setTasks((prev) => {
            const i = prev.findIndex((t) => t.id === task.id);
            if (i === -1) return [...prev, task];
            const next = [...prev];
            next[i] = task;
            return next;
          });
        }
        if (stateRef.current !== 'running') setState('running');
        break;
      }
      case 'SCAN_LOG': {
        const payload = d as { log: ScanLogPayload };
        setMainLogs((prev) => [...prev, payload.log]);
        break;
      }
      case 'SCAN_RESULTS': {
        const r = d as {
          results: {
            added: number;
            updated: number;
            failed: number;
            skipped: number;
          };
        };
        resultsRef.current = r.results;
        break;
      }
      case 'SCAN_FINISHED': {
        const r = resultsRef.current;
        setState('finished');
        setResultMessage(
          r
            ? modeRef.current === 'update'
              ? {
                  key: 'dashboard.scan.finish-update',
                  values: { updated: r.updated, failed: r.failed },
                }
              : {
                  key: 'dashboard.scan.finish-scan',
                  values: {
                    added: r.added,
                    updated: r.updated,
                    failed: r.failed,
                    skipped: r.skipped,
                  },
                }
            : modeRef.current === 'update'
              ? { key: 'dashboard.scan.finish-update-short' }
              : { key: 'dashboard.scan.finish-scan-short' },
        );
        break;
      }
      case 'SCAN_ERROR': {
        setState('error');
        break;
      }
    }
  }, []);

  useSSE('/api/scanner/events', handleEvent);

  async function handleStart(mode: ScanMode) {
    modeRef.current = mode;
    setTasks([]);
    setFailedTasks([]);
    setMainLogs([]);
    setCompletedCount(0);
    setResultMessage(null);
    setState('running');
    resultsRef.current = null;
    try {
      await startScan(mode);
    } catch (err) {
      setState('error');
      showApiError(
        err,
        mode === 'update'
          ? t('dashboard.scan.start-update-failed')
          : t('dashboard.scan.start-scan-failed'),
      );
    }
  }

  async function handleKill() {
    try {
      await killScan();
      M3eSnackbar.open(t('dashboard.scan.kill-sent'));
    } catch (err) {
      showApiError(err, t('dashboard.scan.kill-failed'));
    }
  }

  const isRunning = state === 'running';
  const lastLog = mainLogs.length > 0 ? mainLogs[mainLogs.length - 1] : null;

  return (
    <div className='flex flex-col gap-3'>
      {/* 操作按钮 */}
      <div className='flex flex-wrap gap-3'>
        <M3eButton
          variant='filled'
          disabled={isRunning}
          onClick={() => handleStart('scan')}
        >
          <M3eIcon slot='leadingIcon' name='play_arrow' />
          {t('dashboard.scan.start-scan')}
        </M3eButton>
        <M3eButton
          variant='tonal'
          disabled={isRunning}
          onClick={() => handleStart('update')}
        >
          <M3eIcon slot='leadingIcon' name='sync' />
          {t('dashboard.scan.start-update')}
        </M3eButton>
        <M3eButton
          variant='outlined'
          className='text-[var(--md-sys-color-error)]'
          disabled={!isRunning}
          onClick={handleKill}
        >
          <M3eIcon slot='leadingIcon' name='stop' />
          {t('dashboard.scan.kill')}
        </M3eButton>
      </div>

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
              && (lastLog?.message ?? t('dashboard.scan.waiting-logs'))}
            {state === 'finished'
              && (resultMessage
                ? t(resultMessage.key, resultMessage.values)
                : t('dashboard.scan.finish-scan-short'))}
            {state === 'error' && t('dashboard.scan.error')}
          </span>
          {tasks.length > 0 && (
            <span className='shrink-0 text-xs opacity-60'>
              {t('dashboard.scan.in-progress', { n: tasks.length })}
            </span>
          )}
          {failedTasks.length > 0 && (
            <span className='shrink-0 text-xs text-[var(--md-sys-color-error)]'>
              {t('dashboard.scan.failed-count', { n: failedTasks.length })}
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

      <ScanDetailDialog
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        logs={mainLogs}
        tasks={tasks}
        failedTasks={failedTasks}
        state={state}
        resultMessage={resultMessage}
        completedCount={completedCount}
      />
    </div>
  );
}

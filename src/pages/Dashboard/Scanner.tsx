import { useCallback, useEffect, useRef, useState } from 'react';
import { M3eButton } from '@m3e/react/button';
import { M3eCard } from '@m3e/react/card';
import { M3eIcon } from '@m3e/react/icon';
import '@m3e/icons/outlined/play_arrow';
import '@m3e/icons/outlined/stop';
import '@m3e/icons/outlined/sync';
import '@m3e/icons/outlined/check_circle';
import '@m3e/icons/outlined/error';
import { useSSE } from '../../hooks/useSSE';
import { startScan, killScan, type ScanMode } from '../../api/scanner';
import DashboardPage from '../../components/dashboard/DashboardPage';
import type {
  ScanInitState,
  ScanLogPayload,
  ScanTaskPayload,
} from '../../types';
import { M3eSnackbar } from '@m3e/react/snackbar';
import { showApiError } from '../../utils/apiError';
import { useTranslation } from 'react-i18next';

type ScanState = 'idle' | 'running' | 'finished' | 'error';

/**
 * 扫描结果消息：存 key + 数值参数，渲染时经 t() 本地化
 * （避免语言切换后残留旧语言文案，handleEvent 依赖数组也无需引入 t）。
 */
type ScanResultMessage = {
  key:
    | 'dashboard.scan.scan-ended'
    | 'dashboard.scan.finish-scan'
    | 'dashboard.scan.finish-update'
    | 'dashboard.scan.finish-scan-short'
    | 'dashboard.scan.finish-update-short';
  values?: Record<string, number>;
};

/**
 * 扫描器页面。
 *
 * - SSE 订阅 /api/scanner/events，实时显示日志。
 * - 三按钮：扫描、更新（可选）、终止。
 * - 进行中/失败任务面板。
 */
export default function Scanner() {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<ScanTaskPayload[]>([]); // 仅 pending/scanning
  const [failedTasks, setFailedTasks] = useState<ScanTaskPayload[]>([]);
  const [mainLogs, setMainLogs] = useState<ScanLogPayload[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [state, setState] = useState<ScanState>('idle');
  const [resultMessage, setResultMessage] = useState<ScanResultMessage | null>(
    null,
  );
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

  const logRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);

  // mainLogs 变化时，若用户仍贴底则滚动到底
  useEffect(() => {
    const el = logRef.current;
    if (el && stickToBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [mainLogs]);

  function handleLogScroll() {
    const el = logRef.current;
    if (!el) return;
    stickToBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  }

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

  return (
    <DashboardPage title={t('dashboard.scan.title')}>
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

      {/* 状态指示 + 日志面板 */}
      {state !== 'idle' && (
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
            {/* 主日志 */}
            <div
              ref={logRef}
              onScroll={handleLogScroll}
              className='max-h-64 overflow-y-auto rounded-md p-3 font-mono text-xs'
              style={{
                background: 'var(--md-sys-color-surface-container-highest)',
              }}
            >
              {mainLogs.map((log, i) => (
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
              {mainLogs.length === 0 && (
                <div className='opacity-50'>
                  {t('dashboard.scan.waiting-logs')}
                </div>
              )}
            </div>
          </div>
        </M3eCard>
      )}

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
    </DashboardPage>
  );
}

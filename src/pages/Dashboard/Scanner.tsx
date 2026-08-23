import { useCallback, useRef, useState } from 'react';
import { M3eButton } from '@m3e/react/button';
import { M3eCard } from '@m3e/react/card';
import { M3eIcon } from '@m3e/react/icon';
import '@m3e/icons/outlined/play_arrow';
import '@m3e/icons/outlined/stop';
import '@m3e/icons/outlined/sync';
import '@m3e/icons/outlined/check_circle';
import '@m3e/icons/outlined/error';
import { useSSE } from '../../hooks/useSSE';
import { startScan, killScan } from '../../api/scanner';
import { M3eSnackbar } from '@m3e/react/snackbar';

/** 日志条目（与后端 MainLog 对齐）。 */
interface LogEntry {
  level: string;
  message: string;
  timestamp: string;
}

/** 任务条目（与后端 SCAN_TASKS / SCAN_FAILED_TASKS 对齐）。 */
interface TaskEntry {
  id: number;
  title: string;
  status: string;
  logs: LogEntry[];
}

type ScanState = 'idle' | 'running' | 'finished' | 'error';

/**
 * 扫描器页面。
 *
 * - SSE 订阅 /api/scanner/events，实时显示日志。
 * - 三按钮：扫描、更新（可选）、终止。
 * - 进行中/失败任务面板。
 */
export default function Scanner() {
  const [ state, setState ] = useState<ScanState>('idle');
  const [ tasks, setTasks ] = useState<TaskEntry[]>([]);
  const [ failedTasks, setFailedTasks ] = useState<TaskEntry[]>([]);
  const [ mainLogs, setMainLogs ] = useState<LogEntry[]>([]);
  const [ resultMessage, setResultMessage ] = useState('');

  // 用 ref 持有最新 state，避免 SSE 回调闭包陈旧
  const stateRef = useRef(state);
  stateRef.current = state;

  const handleEvent = useCallback((event: string, data: unknown) => {
    const d = data as Record<string, unknown>;

    switch (event) {
      case 'SCAN_INIT_STATE': {
        const init = d as { isScanning: boolean; };
        if (init.isScanning) {
          setState('running');
        }
        break;
      }
      case 'SCAN_TASKS': {
        const payload = d as { tasks: Array<{ id: number; title: string; status: string; }>; };
        setTasks(
          payload.tasks.map(t => ({
            ...t,
            logs: [],
          })),
        );
        if (stateRef.current !== 'running') setState('running');
        break;
      }
      case 'SCAN_FAILED_TASKS': {
        const payload = d as {
          failedTasks: Array<{ id: number; title: string; error: string; }>;
        };
        setFailedTasks(
          payload.failedTasks.map(t => ({
            id: t.id,
            title: t.title,
            status: 'failed',
            logs: [ { level: 'error', message: t.error, timestamp: '' } ],
          })),
        );
        break;
      }
      case 'SCAN_MAIN_LOGS': {
        const payload = d as { mainLogs: LogEntry[]; };
        setMainLogs([ ...payload.mainLogs ]);
        break;
      }
      case 'SCAN_FINISHED': {
        const payload = d as { message: string; };
        setState('finished');
        setResultMessage(payload.message);
        break;
      }
      case 'SCAN_ERROR': {
        setState('error');
        break;
      }
    }
  }, []);

  useSSE('/api/scanner/events', handleEvent);

  async function handleScan() {
    setTasks([]);
    setFailedTasks([]);
    setMainLogs([]);
    setResultMessage('');
    setState('running');
    try {
      await startScan();
    }
    catch (err) {
      setState('error');
      M3eSnackbar.open(err instanceof Error ? err.message : '扫描启动失败');
    }
  }

  async function handleKill() {
    try {
      await killScan();
      M3eSnackbar.open('已发送终止信号');
    }
    catch (err) {
      M3eSnackbar.open(err instanceof Error ? err.message : '终止失败');
    }
  }

  const isRunning = state === 'running';

  return (
    <div className='flex flex-col gap-4'>
      {/* 操作按钮 */}
      <div className='flex flex-wrap gap-3'>
        <M3eButton
          variant='filled'
          disabled={isRunning}
          onClick={handleScan}>
          <M3eIcon slot='leadingIcon' name='play_arrow' />
          扫描本地音声库
        </M3eButton>
        <M3eButton
          variant='tonal'
          disabled={isRunning}
          onClick={handleScan}>
          <M3eIcon slot='leadingIcon' name='sync' />
          刷新音声库信息
        </M3eButton>
        <M3eButton
          variant='outlined'
          className='text-[var(--md-sys-color-error)]'
          disabled={!isRunning}
          onClick={handleKill}>
          <M3eIcon slot='leadingIcon' name='stop' />
          终止扫描进程
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
              <M3eIcon name='check_circle' className='text-[var(--md-sys-color-primary)]' />
            )}
            {state === 'error' && (
              <M3eIcon name='error' className='text-[var(--md-sys-color-error)]' />
            )}
            <span className='text-sm font-medium'>
              {isRunning && '扫描进行中…'}
              {state === 'finished' && (resultMessage || '扫描完成')}
              {state === 'error' && '扫描出错'}
            </span>
          </div>

          <div slot='content'>
            {/* 主日志 */}
            <div className='max-h-64 overflow-y-auto rounded-md p-3 font-mono text-xs' style={{ background: 'var(--md-sys-color-surface-container-highest)' }}>
              {mainLogs.map((log, i) => (
                <div
                  key={i}
                  className={
                    log.level === 'error'
                      ? 'text-[var(--md-sys-color-error)]'
                      : 'text-[var(--md-sys-color-on-surface)]'
                  }>
                  {log.message}
                </div>
              ))}
              {mainLogs.length === 0 && (
                <div className='opacity-50'>等待日志…</div>
              )}
            </div>
          </div>
        </M3eCard>
      )}

      {/* 处理中任务 */}
      {tasks.length > 0 && (
        <M3eCard>
          <div slot='header' className='flex items-center gap-2'>
            <M3eIcon name='play_arrow' className='text-[var(--md-sys-color-primary)]' />
            <span className='text-sm font-medium'>处理中 ({tasks.length})</span>
          </div>
          <div slot='content'>
            <div className='max-h-80 overflow-y-auto'>
              {tasks.map(task => (
                <div
                  key={task.id}
                  className='border-b border-[var(--md-sys-color-outline-variant)] py-2 last:border-b-0'>
                  <span className='text-sm'>{task.title}</span>
                  <span className='ml-2 text-xs opacity-50'>{task.status}</span>
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
            <M3eIcon name='error' className='text-[var(--md-sys-color-error)]' />
            <span className='text-sm font-medium'>处理失败 ({failedTasks.length})</span>
          </div>
          <div slot='content'>
            <div className='max-h-80 overflow-y-auto'>
              {failedTasks.map(task => (
                <div
                  key={task.id}
                  className='border-b border-[var(--md-sys-color-outline-variant)] py-2 last:border-b-0'>
                  <span className='text-sm'>{task.title}</span>
                  {task.logs.map((log, i) => (
                    <div
                      key={i}
                      className='text-xs text-[var(--md-sys-color-error)]'>
                      {log.message}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </M3eCard>
      )}
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { M3eButton } from '@m3e/react/button';
import { M3eCard } from '@m3e/react/card';
import { M3eIcon } from '@m3e/react/icon';
import '@m3e/icons/outlined/play_arrow';
import '@m3e/icons/outlined/stop';
import '@m3e/icons/outlined/check_circle';
import '@m3e/icons/outlined/error';
import { useSSE } from '../../hooks/useSSE';
import {
  killAnalysis,
  startAnalysis,
  type AnalysisInitState,
  type AnalysisSnapshot,
} from '../../api/analysis';
import DashboardPage from '../../components/dashboard/DashboardPage';
import { M3eSnackbar } from '@m3e/react/snackbar';
import { showApiError } from '../../utils/apiError';
import { useTranslation } from 'react-i18next';

type AnalysisState = 'idle' | 'running' | 'finished' | 'error';

/** 日志条数上限（与后端快照补播的 SCAN_LOG_CAP 一致） */
const LOG_CAP = 500;

/** 空快照（启动后首个事件到达时初始化用） */
const EMPTY_SNAPSHOT: AnalysisSnapshot = {
  tasks: [],
  failedTasks: [],
  completed: 0,
  logs: [],
};

/**
 * 分析结果消息：存 key + 数值参数，渲染时经 t() 本地化
 * （避免语言切换后残留旧语言文案，handleEvent 依赖数组也无需引入 t）。
 */
type AnalysisResultMessage = {
  key:
    | 'dashboard.analysis.scan-ended'
    | 'dashboard.analysis.finish-short'
    | 'dashboard.analysis.finish';
  values?: Record<string, number>;
};

type AnalysisResults = {
  totalWorks: number;
  analyzedTracks: number;
  failedTracks: number;
  failedWorks: number;
};

/**
 * 响度分析页面（镜像扫描器页）。
 *
 * - SSE 订阅 /api/analysis/events，实时显示日志与任务进度。
 * - 两按钮：开始全量分析、终止。
 * - 进行中/失败任务面板；ffmpeg 缺失时置顶安装指引。
 */
export default function Analysis() {
  const { t } = useTranslation();
  const [snapshot, setSnapshot] = useState<AnalysisSnapshot | null>(null);
  const [state, setState] = useState<AnalysisState>('idle');
  const [resultMessage, setResultMessage] =
    useState<AnalysisResultMessage | null>(null);
  const [ffmpegMissing, setFfmpegMissing] = useState(false);

  // ANALYSIS_RESULTS 先于 ANALYSIS_FINISHED 到达，用 ref 规避 useCallback 闭包陈旧
  const resultsRef = useRef<AnalysisResults | null>(null);

  // 用 ref 持有最新 state，避免 SSE 回调闭包陈旧；每次渲染后同步
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  const logRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);

  // 日志变化时，若用户仍贴底则滚动到底
  const logs = snapshot?.logs ?? [];
  useEffect(() => {
    const el = logRef.current;
    if (el && stickToBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [logs]);

  function handleLogScroll() {
    const el = logRef.current;
    if (!el) return;
    stickToBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  }

  const handleEvent = useCallback((event: string, data: unknown) => {
    const d = data as Record<string, unknown>;

    switch (event) {
      case 'ANALYSIS_INIT_STATE': {
        const init = data as AnalysisInitState;
        if (init.isAnalyzing) {
          setState('running');
          if (init.snapshot) setSnapshot(init.snapshot);
        } else if (stateRef.current === 'running') {
          // 重连时后端已不在分析（ANALYSIS_FINISHED 在断线期间错过），
          // 复位本地 running 状态，避免永远停留在「分析进行中…」
          setState('finished');
          setResultMessage({ key: 'dashboard.analysis.scan-ended' });
        }
        break;
      }
      case 'ANALYSIS_TASK': {
        const task = (d as { task: AnalysisSnapshot['tasks'][number] }).task;
        setSnapshot((prev) => {
          const base = prev ?? EMPTY_SNAPSHOT;
          const tasks = [...base.tasks];
          const failedTasks = [...base.failedTasks];
          let completed = base.completed;
          if (task.status === 'completed') {
            const i = tasks.findIndex((tk) => tk.workId === task.workId);
            if (i !== -1) tasks.splice(i, 1);
            completed += 1;
          } else if (task.status === 'failed') {
            const i = tasks.findIndex((tk) => tk.workId === task.workId);
            if (i !== -1) tasks.splice(i, 1);
            failedTasks.push(task);
          } else {
            // pending/scanning：按 workId upsert，保持顺序
            const i = tasks.findIndex((tk) => tk.workId === task.workId);
            if (i === -1) tasks.push(task);
            else tasks[i] = task;
          }
          return { ...base, tasks, failedTasks, completed };
        });
        if (stateRef.current !== 'running') setState('running');
        break;
      }
      case 'ANALYSIS_LOG': {
        const log = d.log as AnalysisSnapshot['logs'][number];
        setSnapshot((prev) => {
          const base = prev ?? EMPTY_SNAPSHOT;
          const next =
            base.logs.length >= LOG_CAP
              ? [...base.logs.slice(-(LOG_CAP - 1)), log]
              : [...base.logs, log];
          return { ...base, logs: next };
        });
        break;
      }
      case 'ANALYSIS_RESULTS': {
        resultsRef.current = d.results as AnalysisResults;
        break;
      }
      case 'ANALYSIS_FINISHED': {
        const r = resultsRef.current;
        setState('finished');
        setResultMessage(
          r
            ? {
                key: 'dashboard.analysis.finish',
                values: {
                  totalWorks: r.totalWorks,
                  analyzedTracks: r.analyzedTracks,
                  failedTracks: r.failedTracks,
                },
              }
            : { key: 'dashboard.analysis.finish-short' },
        );
        break;
      }
      case 'ANALYSIS_ERROR': {
        setState('error');
        const message = String(d.error ?? '');
        if (message.includes('ffmpeg not found')) setFfmpegMissing(true);
        break;
      }
    }
  }, []);

  useSSE('/api/analysis/events', handleEvent);

  async function handleStart() {
    setSnapshot(null);
    setResultMessage(null);
    setFfmpegMissing(false);
    setState('running');
    resultsRef.current = null;
    try {
      await startAnalysis();
    } catch (err) {
      setState('error');
      showApiError(err, t('dashboard.analysis.start-failed'));
    }
  }

  async function handleKill() {
    try {
      await killAnalysis();
      M3eSnackbar.open(t('dashboard.analysis.kill-sent'));
    } catch (err) {
      showApiError(err, t('dashboard.analysis.kill-failed'));
    }
  }

  const isRunning = state === 'running';

  return (
    <DashboardPage title={t('dashboard.analysis.title')}>
      {/* 操作按钮 */}
      <div className='flex flex-wrap gap-3'>
        <M3eButton variant='filled' disabled={isRunning} onClick={handleStart}>
          <M3eIcon slot='leadingIcon' name='play_arrow' />
          {t('dashboard.analysis.start')}
        </M3eButton>
        <M3eButton
          variant='outlined'
          className='text-[var(--md-sys-color-error)]'
          disabled={!isRunning}
          onClick={handleKill}
        >
          <M3eIcon slot='leadingIcon' name='stop' />
          {t('dashboard.analysis.kill')}
        </M3eButton>
      </div>

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
              {isRunning && t('dashboard.analysis.running')}
              {state === 'finished'
                && (resultMessage
                  ? t(resultMessage.key, resultMessage.values)
                  : t('dashboard.analysis.finish-short'))}
              {state === 'error' && t('dashboard.analysis.error')}
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
                  {t('dashboard.analysis.waiting-logs')}
                </div>
              )}
            </div>
          </div>
        </M3eCard>
      )}

      {/* 处理中任务 */}
      {(snapshot?.tasks.length ?? 0) > 0 && (
        <M3eCard>
          <div slot='header' className='flex items-center gap-2'>
            <M3eIcon
              name='play_arrow'
              className='text-[var(--md-sys-color-primary)]'
            />
            <span className='text-sm font-medium'>
              {t('dashboard.analysis.in-progress', {
                n: snapshot?.tasks.length ?? 0,
              })}
            </span>
            {(snapshot?.completed ?? 0) > 0 && (
              <span className='text-xs opacity-60'>
                {t('dashboard.analysis.completed', {
                  n: snapshot?.completed ?? 0,
                })}
              </span>
            )}
          </div>
          <div slot='content'>
            <div className='max-h-80 overflow-y-auto'>
              {(snapshot?.tasks ?? []).map((task) => (
                <div
                  key={task.workId}
                  className='border-b border-[var(--md-sys-color-outline-variant)] py-2 last:border-b-0'
                >
                  <span className='text-sm'>{task.title}</span>
                  <span className='ml-2 text-xs opacity-50'>
                    {task.status === 'scanning'
                      ? t('dashboard.analysis.task-scanning')
                      : t('dashboard.analysis.task-waiting')}
                    {' · '}
                    {task.analyzed}/{task.total}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </M3eCard>
      )}

      {/* 失败任务 */}
      {(snapshot?.failedTasks.length ?? 0) > 0 && (
        <M3eCard>
          <div slot='header' className='flex items-center gap-2'>
            <M3eIcon
              name='error'
              className='text-[var(--md-sys-color-error)]'
            />
            <span className='text-sm font-medium'>
              {t('dashboard.analysis.failed-count', {
                n: snapshot?.failedTasks.length ?? 0,
              })}
            </span>
          </div>
          <div slot='content'>
            <div className='max-h-80 overflow-y-auto'>
              {(snapshot?.failedTasks ?? []).map((task) => (
                <div
                  key={task.workId}
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

import { useCallback, useEffect, useRef, useState } from 'react';
import { M3eSnackbar } from '@m3e/react/snackbar';
import { useTranslation } from 'react-i18next';
import { useSSE } from '../../hooks/useSSE';
import {
  killAnalysis,
  startAnalysis,
  type AnalysisInitState,
  type AnalysisSnapshot,
} from '../../api/analysis';
import { showApiError } from '../../utils/apiError';
import type {
  AnalysisResultMessage,
  AnalysisState,
} from './AnalysisDetailDialog';

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
 * 响度分析 SSE 状态与动作（供音声管理页与 AnalysisPanel 共用）。
 *
 * - 订阅 /api/analysis/events，实时接收日志与任务状态。
 * - start() / kill() 对应开始响度分析、终止按钮。
 *   按钮本体由音声管理页渲染（与扫描器按钮共享同一行），面板只负责展示。
 */
export function useAnalysisEvents() {
  const { t } = useTranslation();
  const [snapshot, setSnapshot] = useState<AnalysisSnapshot | null>(null);
  const [state, setState] = useState<AnalysisState>('idle');
  const [resultMessage, setResultMessage] =
    useState<AnalysisResultMessage | null>(null);
  const [ffmpegMissing, setFfmpegMissing] = useState(false);

  // ANALYSIS_RESULTS 先于 ANALYSIS_FINISHED 到达，用 ref 规避 useCallback 闭包陈旧
  const resultsRef = useRef<{
    totalWorks: number;
    analyzedTracks: number;
    failedTracks: number;
    failedWorks: number;
  } | null>(null);

  // 用 ref 持有最新 state，避免 SSE 回调闭包陈旧；每次渲染后同步
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

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
        resultsRef.current = d.results as NonNullable<
          typeof resultsRef.current
        >;
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

  async function start() {
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

  async function kill() {
    try {
      await killAnalysis();
      M3eSnackbar.open(t('dashboard.analysis.kill-sent'));
    } catch (err) {
      showApiError(err, t('dashboard.analysis.kill-failed'));
    }
  }

  return {
    state,
    snapshot,
    resultMessage,
    ffmpegMissing,
    start,
    kill,
  };
}

export type AnalysisEvents = ReturnType<typeof useAnalysisEvents>;

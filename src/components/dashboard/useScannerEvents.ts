import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { M3eSnackbar } from '@m3e/react/snackbar';
import { useSSE } from '../../hooks/useSSE';
import { startScan, killScan, type ScanMode } from '../../api/scanner';
import { showApiError } from '../../utils/apiError';
import type {
  ScanInitState,
  ScanLogPayload,
  ScanTaskPayload,
} from '../../types';
import type { ScanResultMessage, ScanState } from './ScanDetailDialog';

/**
 * 扫描器 SSE 状态与动作（供音声管理页与 ScannerPanel 共用）。
 *
 * - 订阅 /api/scanner/events，实时接收日志与任务状态。
 * - start(mode) / kill() 对应扫描、更新、终止按钮。
 *   按钮本体由音声管理页渲染（与响度分析按钮共享同一行），面板只负责展示。
 */
export function useScannerEvents() {
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

  async function start(mode: ScanMode) {
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

  async function kill() {
    try {
      await killScan();
      M3eSnackbar.open(t('dashboard.scan.kill-sent'));
    } catch (err) {
      showApiError(err, t('dashboard.scan.kill-failed'));
    }
  }

  return {
    state,
    tasks,
    failedTasks,
    mainLogs,
    completedCount,
    resultMessage,
    start,
    kill,
  };
}

export type ScannerEvents = ReturnType<typeof useScannerEvents>;

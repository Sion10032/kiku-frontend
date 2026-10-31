// wv 播放性能探针：识别低性能浏览器（wasm JIT 被降级，解码仅 ~3× 实时，
// 长时间播放易被节流击穿卡顿）并提示用户检查浏览器 JIT 设置或换 Chrome。
//
// 实测参考：同机型 Chrome ~55×、降级浏览器 ~3×、桌面 ~110×。
// 复用 bench-worker 拉 2MB 解码测 r；localStorage flag 每设备只提示一次；
// 延迟 15s 触发（避开起播期，此时队列已在填充，探针的短暂 CPU 抢占无感）；
// 探针任何失败静默（提示功能，绝不影响播放）。
import i18next from 'i18next';
import { M3eSnackbar } from '@m3e/react/snackbar';
import { getToken } from '../api/token';
import type { BenchMsg, BenchStartCmd } from './bench-worker';

// v2：旧 key（'kiku.wvperf.probed'）在调试期"先标记后跑"版本里可能残留且
// 语义不同，换 key 避免旧值永久吞掉提示
const PROBE_FLAG = 'kiku.wvperf.probed.v2';
const PROBE_DELAY_MS = 15_000;
const PROBE_BYTES = 2 * 1024 * 1024;
/** r 低于此值提示（正常浏览器几十倍，被播放抢占腰斩也远高于此） */
const LOW_PERF_THRESHOLD = 5;

/** 低性能判定（纯函数供测试）：r 有效且低于阈值 */
export function shouldWarnLowPerf(rate: number): boolean {
  return rate > 0 && rate < LOW_PERF_THRESHOLD;
}

/**
 * 每设备一次的 wv 解码性能探针。在 .wv 起播时调用（usePlayer），
 * 15s 后后台测当前曲目前 2MB 的解码速率，r < 5 时提示检查浏览器 JIT
 * 设置或换 Chrome。探针跑出结果（无论高低）才写一次性 flag；失败不标记，
 * 下次起播重试。
 */
export function maybeRunWvPerfProbe(streamUrl: string): void {
  try {
    if (localStorage.getItem(PROBE_FLAG)) return;
  } catch {
    // localStorage 不可用（隐私模式等）：照跑探针，只是每次起播都会重测
  }

  globalThis.setTimeout(() => {
    try {
      runProbe(streamUrl);
    } catch {
      // Worker 构造失败等：静默
    }
  }, PROBE_DELAY_MS);
}

function runProbe(streamUrl: string): void {
  const worker = new Worker(new URL('./bench-worker.ts', import.meta.url), {
    type: 'module',
  });
  const finish = () => worker.terminate();
  worker.onmessage = (e: MessageEvent<BenchMsg>) => {
    const m = e.data;
    if (m.type === 'done') {
      try {
        // 跑出结果才标记一次性（失败不标记，下次起播重试）
        localStorage.setItem(PROBE_FLAG, '1');
      } catch {
        // 忽略：仅多跑几次探针，无害
      }
      if (shouldWarnLowPerf(m.rate)) {
        M3eSnackbar.open(
          i18next.t('player.wavpack-low-perf', { rate: m.rate.toFixed(1) }),
        );
      }
      finish();
    } else if (m.type === 'error') {
      finish();
    }
  };
  worker.onerror = finish;
  const cmd: BenchStartCmd = {
    type: 'start',
    url: streamUrl,
    token: getToken(),
    maxBytes: PROBE_BYTES,
  };
  worker.postMessage(cmd);
}

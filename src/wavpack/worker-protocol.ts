// Worker 消息协议（任务 5 的 WasmWvPlayer 严格按此实现）。
// 消费时序：meta 到达前不应发其它指令——load 在途时 pause/stop 会经 gen 代数作废 load，
// 主线程将永远收不到该次 load 的 meta/error。

// main → worker
export type WorkerCmd =
  | { type: 'load'; url: string } // 拉首块→meta；缓存首块 PCM
  | { type: 'play'; fromSample: number } // fromSample==已喂末尾→续拉；否则 seek（定位+重建）
  | { type: 'pause' } // 停止拉流推送（decoder/索引保留）
  | { type: 'stop' }; // 释放 decoder + 中止 fetch

// worker → main
export type WorkerMsg =
  | { type: 'meta'; sampleRate: number; channels: number; durationSec: number }
  | { type: 'pcm'; startSample: number; channels: Float32Array[] } // transferable
  | { type: 'ended' } // 拉流 EOF 且输出帧数达 totalSamples
  | { type: 'error'; message: string; code: 'DECODE' | 'NETWORK' };

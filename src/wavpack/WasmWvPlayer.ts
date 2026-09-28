// .wv 曲目的 PlayerBackend：驱动解码 Worker（任务 4）并把推送的 PCM 块
// 交给 AudioChunkScheduler 链式调度输出。
//
// 与 worker 的配合边界（worker-protocol.ts 消费时序）：
// - meta 到达前不发任何指令（load 在途时其它指令会经 gen 代数作废 load）：
//   play/pause/seek 在 meta 前只记录意图，meta 到达后统一落地
// - worker ended 后 play(fromSample==outputSample) 是 no-op：自然结束后
//   再 play() 视为重播（等价 seek(0)+play），先走 seek 路径重建
// - worker error(NETWORK|DECODE) 后仍存活：console.warn + Snackbar 提示，
//   切曲（重建 backend）时经 load 恢复
import i18next from 'i18next';
import { M3eSnackbar } from '@m3e/react/snackbar';
import {
  AudioChunkScheduler,
  type AudioChunkSchedulerCallbacks,
} from './audio-chunk-scheduler';
import type { WorkerCmd, WorkerMsg } from './worker-protocol';

/** 播放后端接口：Howler 分支以适配器实现同一接口（usePlayer 消费）。 */
export interface PlayerBackend {
  play(): void;
  pause(): void;
  /** t 秒 */
  seek(t: number): void;
  /** 0-1（wv: GainNode） */
  volume(v: number): void;
  /** 秒 */
  duration(): number;
  /** 秒 */
  currentTime(): number;
  playing(): boolean;
  unload(): void;
}

export interface WasmWvPlayerCallbacks {
  /** worker meta 到达：时长已知（秒） */
  onLoad(durationSec: number): void;
  /** 自然结束（worker ended + 调度队列排空） */
  onEnd(): void;
}

export class WasmWvPlayer implements PlayerBackend {
  private readonly worker: Worker;
  private readonly scheduler: AudioChunkScheduler;
  private readonly onLoad: (durationSec: number) => void;
  private readonly onEnd: () => void;

  private rate = 0;
  private durationSec = 0;
  private metaReady = false;
  /** 实际播放态（meta 落地后的；wantPlay 是 meta 前的意图） */
  private isPlaying = false;
  private wantPlay = false;
  /** meta 前的 seek 意图（秒；meta 后换算成 sample 落地） */
  private pendingSeekSec: number | null = null;
  /** 暂停位置 / seek 目标（sample；play 指令的 fromSample） */
  private pausedAtSample = 0;
  private endedReceived = false;

  constructor(url: string, callbacks: WasmWvPlayerCallbacks) {
    this.onLoad = callbacks.onLoad;
    this.onEnd = callbacks.onEnd;
    const schedulerCb: AudioChunkSchedulerCallbacks = {
      onOverflow: () => {
        this.post({ type: 'pause' });
      },
      onUnderrun: (fromSample) => {
        if (this.isPlaying) this.post({ type: 'play', fromSample });
      },
      onEnd: () => {
        this.isPlaying = false;
        this.endedReceived = true;
        this.pausedAtSample = this.scheduler.lastFedSample;
        this.onEnd();
      },
    };
    this.scheduler = new AudioChunkScheduler(schedulerCb);
    this.worker = new Worker(new URL('./worker.ts', import.meta.url), {
      type: 'module',
    });
    this.worker.onmessage = (e: MessageEvent<WorkerMsg>) => this.handle(e.data);
    this.worker.onerror = (e) => {
      this.fail('NETWORK', e.message || 'worker 加载失败');
    };
    this.post({ type: 'load', url });
  }

  play(): void {
    if (this.isPlaying) return;
    if (!this.metaReady) {
      this.wantPlay = true;
      return;
    }
    // 自然结束后再 play：worker 对 ended 后的续拉是 no-op，走重播（seek 重建）
    if (
      this.endedReceived
      && this.pausedAtSample >= this.scheduler.lastFedSample
    ) {
      this.seekInternal(0);
    }
    this.start();
  }

  pause(): void {
    this.wantPlay = false;
    // meta 前不发指令（会作废 load）；此前的意图也不必落地（尚无声音输出）
    if (!this.metaReady || !this.isPlaying) return;
    this.pausedAtSample = this.scheduler.pause();
    this.isPlaying = false;
    this.post({ type: 'pause' });
  }

  seek(t: number): void {
    if (!this.metaReady) {
      this.pendingSeekSec = Math.max(0, t);
      return;
    }
    this.seekInternal(t);
  }

  volume(v: number): void {
    this.scheduler.setVolume(Math.min(1, Math.max(0, v)));
  }

  duration(): number {
    return this.durationSec;
  }

  currentTime(): number {
    return this.metaReady && this.rate > 0
      ? this.scheduler.currentTime() / this.rate
      : 0;
  }

  playing(): boolean {
    return this.isPlaying;
  }

  unload(): void {
    // worker-protocol 要求 meta 前不发其它指令（会经 gen 代数作废 load）；此处 stop
    // 仅防御性尽力通知——若 meta 未到，stop 确会作废 load，但随后立即 terminate，
    // 实例整个丢弃，无实害
    this.post({ type: 'stop' });
    this.worker.terminate();
    this.scheduler.dispose();
  }

  private start(): void {
    this.isPlaying = true;
    this.scheduler.resumeCtx();
    this.scheduler.play();
    this.post({ type: 'play', fromSample: this.pausedAtSample });
  }

  private seekInternal(t: number): void {
    const sample = Math.max(0, Math.round(t * this.rate));
    this.pausedAtSample = sample;
    this.endedReceived = false;
    this.scheduler.reset(sample);
    // 播放中：worker play(≠outputSample) 走 seek（定位+重建）推新 PCM；
    // 暂停中：不发指令，play() 时经 pausedAtSample 走同一路径
    if (this.isPlaying) this.post({ type: 'play', fromSample: sample });
  }

  private handle(msg: WorkerMsg): void {
    switch (msg.type) {
      case 'meta':
        this.rate = msg.sampleRate;
        this.durationSec = msg.durationSec;
        this.metaReady = true;
        this.scheduler.setSampleRate(msg.sampleRate);
        if (this.pendingSeekSec != null) {
          const t = this.pendingSeekSec;
          this.pendingSeekSec = null;
          this.pausedAtSample = Math.max(0, Math.round(t * this.rate));
          this.scheduler.reset(this.pausedAtSample);
        }
        this.onLoad(msg.durationSec);
        if (this.wantPlay) {
          this.wantPlay = false;
          this.start();
        }
        break;
      case 'pcm':
        if (!this.metaReady) return;
        this.scheduler.enqueue(msg.startSample, msg.channels);
        break;
      case 'ended':
        // 队列未排空时 scheduler 会在排空后触发 onEnd
        this.scheduler.notifyEnded();
        break;
      case 'seekfallback':
        // seek 被降级（流式文件等）：worker 实际从 actualSample 播，
        // 对齐调度器基线（fedSample）与暂停位置，使后续 pcm 衔接校验通过。
        // 到达时机：只可能出现在 play 指令之后、该次播放任何 pcm 之前，
        // 且此前 seekInternal/start 已把调度链排空，此处 reset 无副作用
        this.pausedAtSample = msg.actualSample;
        this.scheduler.reset(msg.actualSample);
        break;
      case 'error':
        this.fail(msg.code, msg.message);
        break;
    }
  }

  private fail(code: 'DECODE' | 'NETWORK', message: string): void {
    console.warn(`[WasmWvPlayer] ${code}: ${message}`);
    M3eSnackbar.open(i18next.t('player.wavpack-error', { message }));
    this.isPlaying = false;
    // 已排定的音频（最多 15s）立即停输出，与 UI 的暂停态一致；
    // 基线取当前音频位置，currentTime 不跳变
    this.scheduler.reset(this.scheduler.currentTime());
  }

  private post(cmd: WorkerCmd): void {
    this.worker.postMessage(cmd);
  }
}

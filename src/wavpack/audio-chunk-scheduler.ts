// AudioBuffer 链式调度器：把 worker 推送的 PCM 块接成无缝（gapless）的
// AudioBufferSourceNode 链，AudioContext / GainNode 惰性创建。
//
// 流控（与 worker 配合）：
// - 队列积压超过 MAX_QUEUED_SECONDS → onOverflow（消费方向 worker 发 pause 停止拉流推送）
// - 积压回落到 RESUME_SECONDS 以内 → onUnderrun(lastFedSample)（消费方向 worker 发
//   play(lastFedSample) 续拉，worker 侧 fromSample==outputSample 走不重建快路径）
// - worker 发出 ended 且队列排空 → onEnd（曲目自然结束）
//
// 纯逻辑部分（时间→sample 换算）拆为 computeCurrentSample 供单测；
// 类本体依赖 Web Audio API，仅在浏览器实例化。

/** 队列积压上限（秒）：超过即向 worker 发 pause，防止内存无限增长。 */
const MAX_QUEUED_SECONDS = 15;
/** 续拉阈值（秒）：积压回落到此值以内再让 worker 续拉，避免缓冲被打空出现可听间隙。 */
const RESUME_SECONDS = 2;

/**
 * 链式调度的时间→sample 换算：链起点 sample + 经过 ctx 时间 × 采样率。
 * 结果向下取整（sample 为整数帧位置），且不小于链起点（ctxNow 早于链起点时钳制）。
 * rate 非正时不外推，直接返回链起点。
 */
export function computeCurrentSample(
  chainStartCtxTime: number,
  chainStartSample: number,
  ctxNow: number,
  rate: number,
): number {
  const elapsed = rate > 0 ? (ctxNow - chainStartCtxTime) * rate : 0;
  return Math.floor(Math.max(chainStartSample, chainStartSample + elapsed));
}

/** 调度器回调：消费方（WasmWvPlayer）据此向 worker 发指令 / 通知曲目结束。 */
export interface AudioChunkSchedulerCallbacks {
  /** 队列积压超上限：应向 worker 发 pause 停止拉流推送 */
  onOverflow(): void;
  /** 积压回落：应向 worker 发 play(fromSample) 续拉（不重建） */
  onUnderrun(fromSample: number): void;
  /** worker 已报 ended 且队列排空：曲目自然结束 */
  onEnd(): void;
}

interface ChainEntry {
  source: AudioBufferSourceNode;
  /** 本块开始播放的 ctx 时间 */
  startTime: number;
  /** 本块播完的 ctx 时间（下一条的排定起点，保证 gapless） */
  endCtxTime: number;
  /** 本块起始 sample 位置 */
  startSample: number;
  /** 本块播完的 sample 位置 */
  endSample: number;
}

export class AudioChunkScheduler {
  private readonly cb: AudioChunkSchedulerCallbacks;
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private resumeBound = false;
  /** 已排定的链（按播放顺序，队首最先播完） */
  private entries: ChainEntry[] = [];
  /** 队列为空时 currentTime 的回退值（pause 位置 / seek 目标） */
  private baselineSample = 0;
  /** 已向链尾投递到的 sample 位置（worker 续拉点） */
  private fedSample = 0;
  /** PCM 采样率（worker meta 到达后由 setSampleRate 写入） */
  private rate = 0;
  /** pause() 后为 true：丢弃迟到 PCM，不再触发流控回调 */
  private paused = false;
  /** 已发过 onOverflow，等积压回落后恢复 */
  private overflowed = false;
  /** worker 已报 ended：队列排空即触发 onEnd */
  private endedReceived = false;
  private volume = 1;

  constructor(cb: AudioChunkSchedulerCallbacks) {
    this.cb = cb;
  }

  /** 已向链尾投递到的 sample 位置（worker 续拉点 / ended 后的终点）。 */
  get lastFedSample(): number {
    return this.fedSample;
  }

  /** PCM 采样率（worker meta；AudioBuffer 按此创建，播放时自动重采样到设备率）。 */
  setSampleRate(rate: number): void {
    this.rate = rate;
  }

  /** 音量 0-1（GainNode；ctx 未创建时记下，创建时应用）。 */
  setVolume(v: number): void {
    this.volume = v;
    if (this.gain) this.gain.gain.value = v;
  }

  /** 惰性创建 AudioContext + GainNode。 */
  private ensureCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.gain = this.ctx.createGain();
      this.gain.gain.value = this.volume;
      this.gain.connect(this.ctx.destination);
    }
    // 自动播放策略：play() 可能经由 store effect 丢失手势上下文，
    // 兜底绑一次性手势 resume（与 utils/normalizer.ts 同款）
    if (!this.resumeBound && this.ctx.state === 'suspended') {
      this.resumeBound = true;
      const resume = (): void => {
        this.ctx?.resume().catch(() => {});
      };
      window.addEventListener('pointerdown', resume, { once: true });
      window.addEventListener('keydown', resume, { once: true });
    }
    return this.ctx;
  }

  /** 恢复音频输出（应在用户手势调用链内；suspend 状态下 resume）。 */
  resumeCtx(): void {
    const ctx = this.ensureCtx();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  /** 解除 pause 状态（配合 worker 续拉，后续 enqueue 重新入链）。 */
  play(): void {
    this.paused = false;
  }

  /**
   * 暂停：停止并排空已排定的链，记录暂停位置。
   * @returns 暂停时的 sample 位置（worker resume/seek 起点）
   */
  pause(): number {
    const at = this.currentTime();
    this.baselineSample = at;
    this.stopAll();
    this.paused = true;
    this.overflowed = false;
    return at;
  }

  /** seek/重置：排空链并把 currentTime 基线设为指定 sample。 */
  reset(sample: number): void {
    this.baselineSample = sample;
    this.stopAll();
    this.overflowed = false;
  }

  /** worker 'ended' 已到达：若队列已排空立即触发 onEnd，否则等排空。 */
  notifyEnded(): void {
    this.endedReceived = true;
    if (!this.paused && this.entries.length === 0) this.drainEnded();
  }

  /** 当前播放位置（sample）：按链首外推，钳制在链首与链尾之间。 */
  currentTime(): number {
    const head = this.entries[0];
    if (!this.ctx || !head) return this.baselineSample;
    const s = computeCurrentSample(
      head.startTime,
      head.startSample,
      this.ctx.currentTime,
      this.rate,
    );
    return Math.min(Math.max(s, head.startSample), this.fedSample);
  }

  /**
   * 入链一个 PCM 块：创建 AudioBuffer，起点紧接链尾（gapless），
   * onended 前下一条已排定。积压超上限触发 onOverflow。
   */
  enqueue(startSample: number, channels: readonly Float32Array[]): void {
    if (this.paused || channels.length === 0 || this.rate <= 0) return;
    const frames = channels[0].length;
    if (frames === 0) return;
    // 衔接不变量：空链后的首块必须无缝续接 fedSample（reset/pause/排空后的期望位置）。
    // 合法流（首播 / seek 重建 / 暂停恢复 / underrun 续拉）的首块都恰好从 fedSample 起：
    // stopAll 把 fedSample 归位到基线，worker 侧 play(fromSample) 首块也从 fromSample 起。
    // 不符即 worker terminate 前在途的 stale 块（旧曲/旧 seek 位置），丢弃以免改写基线播出旧音频。
    if (this.entries.length === 0 && startSample !== this.fedSample) return;
    const ctx = this.ensureCtx();
    let buffer: AudioBuffer;
    try {
      buffer = ctx.createBuffer(channels.length, frames, this.rate);
    } catch (e) {
      // 采样率超出浏览器 createBuffer 支持范围等极端情况
      console.warn('[AudioChunkScheduler] createBuffer 失败：', e);
      return;
    }
    for (let i = 0; i < channels.length; i++) {
      // set 接受 ArrayLike<number>：避开 copyToChannel 的 ArrayBuffer 精确类型要求
      buffer.getChannelData(i).set(channels[i]);
    }
    const head = this.entries[0];
    const tail = this.entries[this.entries.length - 1];
    const startTime = tail ? tail.endCtxTime : ctx.currentTime;
    if (!head) {
      // 新链：currentTime 基线切换到链首
      this.baselineSample = startSample;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.gain!);
    const entry: ChainEntry = {
      source,
      startTime,
      endCtxTime: startTime + frames / this.rate,
      startSample,
      endSample: startSample + frames,
    };
    source.onended = () => this.handleEnded(entry);
    source.start(startTime);
    this.entries.push(entry);
    this.fedSample = entry.endSample;

    if (!this.overflowed && this.queuedSeconds() > MAX_QUEUED_SECONDS) {
      this.overflowed = true;
      this.cb.onOverflow();
    }
  }

  /** 释放全部资源（切曲/卸载）。 */
  dispose(): void {
    this.stopAll();
    this.endedReceived = false;
    this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.gain = null;
    this.resumeBound = false;
  }

  /** 当前队列积压秒数（链尾播完时刻 − 现在）。 */
  private queuedSeconds(): number {
    const ctx = this.ctx;
    const last = this.entries[this.entries.length - 1];
    if (!ctx || !last) return 0;
    return Math.max(0, last.endCtxTime - ctx.currentTime);
  }

  private handleEnded(entry: ChainEntry): void {
    // pause/reset 已把链排空（onended 已摘除）：迟到回调直接忽略
    if (!this.entries.includes(entry)) return;
    this.entries = this.entries.filter((e) => e !== entry);
    this.baselineSample = entry.endSample;
    if (this.paused) return;
    if (this.endedReceived && this.entries.length === 0) {
      // 曲目已到 EOF：无需再续拉，直接收尾
      this.drainEnded();
      return;
    }
    if (
      this.overflowed
      && (this.entries.length === 0 || this.queuedSeconds() <= RESUME_SECONDS)
    ) {
      this.overflowed = false;
      this.cb.onUnderrun(this.fedSample);
    }
  }

  private drainEnded(): void {
    this.endedReceived = false;
    this.cb.onEnd();
  }

  private stopAll(): void {
    for (const e of this.entries) {
      e.source.onended = null;
      try {
        e.source.stop();
      } catch {
        // 尚未 start 过等状态异常：忽略
      }
      e.source.disconnect();
    }
    this.entries = [];
    this.fedSample = this.baselineSample;
  }
}

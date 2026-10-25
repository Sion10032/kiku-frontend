/**
 * 音频链：media 元素（audio/video）→ MediaElementSource → EQ(biquad ×10)
 * → GainNode(响度) → destination。元素 volume（Howler/视频元素管，0..1）
 * × EQ（±12dB/段）× GainNode（均衡系数，可 >1）。
 * 同源媒体才允许 MediaElementSource；kiku 流媒体同源，成立。
 */
import { createEqChain, type EqChain } from './equalizer';
import { loudnessLinear } from './loudness';

let ctx: AudioContext | null = null;
let resumeBound = false;

/** 单元素链路句柄：响度增益节点与 EQ 链同元素幂等复用。 */
interface SourceChain {
  gain: GainNode;
  eq: EqChain;
}

const sources = new WeakMap<HTMLMediaElement, SourceChain>();

function ensureCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  // 自动播放策略：一次性手势 resume（页面加载即自动续播的场景）
  if (!resumeBound && ctx.state === 'suspended') {
    resumeBound = true;
    const resume = (): void => {
      ctx?.resume().catch(() => {});
    };
    window.addEventListener('pointerdown', resume, { once: true });
    window.addEventListener('keydown', resume, { once: true });
  }
  return ctx;
}

export function attachGainChain(el: HTMLMediaElement): {
  setGainDb(db: number): void;
  setEqBands(gains: number[], qs: number[], enabled: boolean): void;
} {
  const audioCtx = ensureCtx();
  let chain = sources.get(el);
  if (!chain) {
    const src = audioCtx.createMediaElementSource(el);
    const eq = createEqChain(audioCtx);
    const gain = audioCtx.createGain();
    gain.gain.value = 1;
    // 链路顺序：source → EQ.input，EQ.output → GainNode(响度) → destination
    // （EQ 排在响度增益之前，spec D2）
    src.connect(eq.input);
    eq.output.connect(gain);
    gain.connect(audioCtx.destination);
    chain = { gain, eq };
    sources.set(el, chain);
  }
  const { gain, eq } = chain;
  return {
    setGainDb(db: number): void {
      gain.gain.setTargetAtTime(
        loudnessLinear(db), // +20dB 防失控硬上限（helper 内 clamp）
        audioCtx.currentTime,
        0.05,
      );
    },
    setEqBands(gains: number[], qs: number[], enabled: boolean): void {
      eq.setBands(gains, qs, enabled);
    },
  };
}

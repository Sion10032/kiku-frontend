/**
 * 音量均衡增益链：audio 元素 → MediaElementSource → GainNode → destination。
 * 元素 volume（Howler 管，0..1）× GainNode（均衡系数，可 >1）。
 * 同源媒体才允许 MediaElementSource；kiku 流媒体同源，成立。
 */
let ctx: AudioContext | null = null;
let resumeBound = false;
const sources = new WeakMap<HTMLMediaElement, GainNode>();

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

export function attachGainChain(el: HTMLAudioElement): {
  setGainDb(db: number): void;
} {
  const audioCtx = ensureCtx();
  let gain = sources.get(el);
  if (!gain) {
    const src = audioCtx.createMediaElementSource(el);
    gain = audioCtx.createGain();
    gain.gain.value = 1;
    src.connect(gain).connect(audioCtx.destination);
    sources.set(el, gain);
  }
  return {
    setGainDb(db: number): void {
      const capped = Math.max(-60, Math.min(20, db)); // +20dB 防失控硬上限
      gain.gain.setTargetAtTime(
        10 ** (capped / 20),
        audioCtx.currentTime,
        0.05,
      );
    },
  };
}

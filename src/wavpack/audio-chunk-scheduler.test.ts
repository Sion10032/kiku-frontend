import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioChunkScheduler } from './audio-chunk-scheduler';

// node 环境无 Web Audio：注入可观测桩 AudioContext（与 utils/equalizer.chain.test.ts 同款思路）。
// 这里要验证的是三条后端之一（.wv）的接线：pending 复制语义、建链时应用 pending 初值、
// dispose 后 pending 保留。故障表现为「.wv 不生效」，只能靠测试而不是耳朵发现。

interface ParamMock {
  value: number;
  setTargetAtTime: ReturnType<typeof vi.fn>;
}

function param(value = 0): ParamMock {
  return { value, setTargetAtTime: vi.fn() };
}

class MockNode {
  targets: unknown[] = [];
  connect(dest: unknown): unknown {
    this.targets.push(dest);
    return dest;
  }
}

class MockBiquad extends MockNode {
  type = 'peaking';
  frequency = param();
  Q = param();
  gain = param();
}

class MockGain extends MockNode {
  gain = param(1);
}

class MockAudioContext {
  currentTime = 1;
  state = 'running';
  destination = { kind: 'destination' };
  filters: MockBiquad[] = [];
  gains: MockGain[] = [];

  createBiquadFilter(): MockBiquad {
    const filter = new MockBiquad();
    this.filters.push(filter);
    return filter;
  }

  createGain(): MockGain {
    const gain = new MockGain();
    this.gains.push(gain);
    return gain;
  }

  close(): Promise<void> {
    return Promise.resolve();
  }
}

/** 建过的所有 ctx（dispose + 重建场景要能拿到第二个）。 */
let created: MockAudioContext[] = [];

function latest(): MockAudioContext {
  const ctx = created[created.length - 1];
  if (!ctx) throw new Error('no AudioContext created');
  return ctx;
}

const gains10 = (v: number): number[] => new Array(10).fill(v);
const qs10 = (v: number): number[] => new Array(10).fill(v);

function makeScheduler(): AudioChunkScheduler {
  return new AudioChunkScheduler({
    onOverflow: () => {},
    onEnd: () => {},
  } as unknown as ConstructorParameters<typeof AudioChunkScheduler>[0]);
}

describe('AudioChunkScheduler 的 EQ / 响度接线', () => {
  afterEach(() => {
    created = [];
    vi.unstubAllGlobals();
  });

  it('setEqBands 复制入参：调用方后续原地改数组不影响 pending', () => {
    vi.stubGlobal(
      'AudioContext',
      class extends MockAudioContext {
        constructor() {
          super();
          created.push(this);
        }
      },
    );
    const scheduler = makeScheduler();
    const gains = gains10(0);
    const qs = qs10(1.4);
    scheduler.setEqBands(gains, qs, true);

    // 调用方改了入参数组（典型的「复用缓冲区」写法）
    gains[3] = 9;
    qs[3] = 7;
    scheduler.resumeCtx(); // 建链，应用 pending

    const ctx = latest();
    // band 3 拿到的应是 setEqBands 当时的 0 / 1.4，而不是 9 / 7
    expect(ctx.filters[3]!.gain.setTargetAtTime).toHaveBeenCalledWith(
      0,
      1,
      0.05,
    );
    expect(ctx.filters[3]!.Q.setTargetAtTime).toHaveBeenCalledWith(
      1.4,
      1,
      0.05,
    );
  });

  it('ctx 未创建时设置不抛，建链时按 pending 初值应用（含响度）', () => {
    vi.stubGlobal(
      'AudioContext',
      class extends MockAudioContext {
        constructor() {
          super();
          created.push(this);
        }
      },
    );
    const scheduler = makeScheduler();
    // 全部在 ensureCtx 之前调用：这是常态（store 初值早于首次播放）
    expect(() => {
      scheduler.setVolume(0.8);
      scheduler.setEqBands(gains10(6), qs10(2.5), true);
      scheduler.setLoudnessDb(-12);
    }).not.toThrow();
    expect(created).toHaveLength(0);

    scheduler.resumeCtx();

    const ctx = latest();
    // gain(音量) 用 pending 值
    expect(ctx.gains[0]!.gain.value).toBe(0.8);
    // EQ 每段都按 pending 下发了 gain
    const bandGains = ctx.filters.map(
      (f) => f.gain.setTargetAtTime.mock.calls[0]?.[0],
    );
    expect(bandGains).toEqual(gains10(6));
    // 响度 GainNode（第二个创建的 gain，前者是音量）拿到 -12dB → 线性 0.2512
    const loudness = ctx.gains[1]!.gain.setTargetAtTime;
    expect(loudness).toHaveBeenCalledTimes(1);
    expect(loudness.mock.calls[0]![0]).toBeCloseTo(10 ** (-12 / 20), 6);
  });

  it('关闭态下发全 0dB（链路常在，不重建）', () => {
    vi.stubGlobal(
      'AudioContext',
      class extends MockAudioContext {
        constructor() {
          super();
          created.push(this);
        }
      },
    );
    const scheduler = makeScheduler();
    scheduler.setEqBands(gains10(6), qs10(2.5), false);
    scheduler.resumeCtx();

    const ctx = latest();
    const bandGains = ctx.filters.map(
      (f) => f.gain.setTargetAtTime.mock.calls[0]?.[0],
    );
    expect(bandGains).toEqual(gains10(0));
  });

  it('dispose 后 pending 保留：重建 ctx 仍按最后设置建链', () => {
    vi.stubGlobal(
      'AudioContext',
      class extends MockAudioContext {
        constructor() {
          super();
          created.push(this);
        }
      },
    );
    const scheduler = makeScheduler();
    scheduler.setEqBands(gains10(-3), qs10(1.1), true);
    scheduler.setLoudnessDb(6);
    scheduler.resumeCtx();
    const first = latest();
    expect(first.filters[0]!.gain.setTargetAtTime).toHaveBeenCalledWith(
      -3,
      1,
      0.05,
    );

    scheduler.dispose();
    expect(created).toHaveLength(1);

    scheduler.resumeCtx(); // 重建
    expect(created).toHaveLength(2);
    const second = latest();
    expect(second).not.toBe(first);
    expect(second.filters[0]!.gain.setTargetAtTime).toHaveBeenCalledWith(
      -3,
      1,
      0.05,
    );
    expect(
      second.gains[1]!.gain.setTargetAtTime.mock.calls[0]?.[0],
    ).toBeCloseTo(10 ** (6 / 20), 6);
  });
});

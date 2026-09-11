import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// node 测试环境无 AudioContext/window：stub 全局后动态加载模块。
// 模块级单例（ctx / resumeBound / sources）需用 vi.resetModules 在用例间重置，
// 故每个用例都通过 load() 重新 import。

interface GainParamMock {
  value: number;
  setTargetAtTime: ReturnType<typeof vi.fn>;
}

class MockAudioContext {
  static instances: MockAudioContext[] = [];
  state: string;
  currentTime = 1.23;
  destination = { kind: 'destination' };
  sourceCount = 0;
  gainMocks: GainParamMock[] = [];
  resume = vi.fn((): Promise<void> => Promise.resolve());

  constructor(state = 'suspended') {
    this.state = state;
    MockAudioContext.instances.push(this);
  }

  createMediaElementSource(): { connect: (dest: unknown) => unknown } {
    this.sourceCount++;
    // connect 链：src.connect(gain).connect(destination) —— 返回目标以续链
    return { connect: (dest: unknown) => dest };
  }

  createGain(): { gain: GainParamMock; connect: (dest: unknown) => void } {
    const gain: GainParamMock = { value: 1, setTargetAtTime: vi.fn() };
    this.gainMocks.push(gain);
    return { gain, connect: () => {} };
  }
}

const windowMock = { addEventListener: vi.fn() };

async function load(): Promise<typeof import('./normalizer')> {
  vi.resetModules();
  return import('./normalizer');
}

beforeEach(() => {
  MockAudioContext.instances = [];
  windowMock.addEventListener.mockClear();
  vi.stubGlobal('AudioContext', MockAudioContext);
  vi.stubGlobal('window', windowMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const makeEl = (): HTMLAudioElement => ({}) as HTMLAudioElement;

describe('attachGainChain', () => {
  it('懒建 AudioContext 并连接 source → gain → destination', async () => {
    const { attachGainChain } = await load();
    attachGainChain(makeEl());
    expect(MockAudioContext.instances).toHaveLength(1);
    const ctx = MockAudioContext.instances[0]!;
    expect(ctx.sourceCount).toBe(1);
    expect(ctx.gainMocks).toHaveLength(1);
  });

  it('同一元素二次 attach 不重复 connect（WeakMap 命中），controller 作用于同一 gain', async () => {
    const { attachGainChain } = await load();
    const el = makeEl();
    const first = attachGainChain(el);
    const second = attachGainChain(el);
    const ctx = MockAudioContext.instances[0]!;
    expect(ctx.sourceCount).toBe(1);
    expect(ctx.gainMocks).toHaveLength(1);
    // 二次 attach 返回的 controller 仍作用于同一个 GainNode
    second.setGainDb(-6);
    expect(first).toBeDefined();
    expect(ctx.gainMocks[0]!.setTargetAtTime).toHaveBeenCalledTimes(1);
  });

  it('不同元素各自建 source（互不命中 WeakMap）', async () => {
    const { attachGainChain } = await load();
    attachGainChain(makeEl());
    attachGainChain(makeEl());
    const ctx = MockAudioContext.instances[0]!;
    expect(ctx.sourceCount).toBe(2);
    expect(ctx.gainMocks).toHaveLength(2);
  });

  it('setGainDb 换算 10^(db/20)：-6 dB ≈ 0.5012', async () => {
    const { attachGainChain } = await load();
    attachGainChain(makeEl()).setGainDb(-6);
    const gain = MockAudioContext.instances[0]!.gainMocks[0]!;
    expect(gain.setTargetAtTime).toHaveBeenCalledWith(
      10 ** (-6 / 20),
      1.23,
      0.05,
    );
  });

  it('setGainDb 正向上限 +20 dB（10 倍）', async () => {
    const { attachGainChain } = await load();
    attachGainChain(makeEl()).setGainDb(50);
    const gain = MockAudioContext.instances[0]!.gainMocks[0]!;
    expect(gain.setTargetAtTime).toHaveBeenCalledWith(10, 1.23, 0.05);
  });

  it('setGainDb 负向下限 -60 dB（0.001）', async () => {
    const { attachGainChain } = await load();
    attachGainChain(makeEl()).setGainDb(-100);
    const gain = MockAudioContext.instances[0]!.gainMocks[0]!;
    expect(gain.setTargetAtTime).toHaveBeenCalledWith(0.001, 1.23, 0.05);
  });

  it('AudioContext suspended 时绑定一次性手势 resume', async () => {
    const { attachGainChain } = await load();
    attachGainChain(makeEl());
    expect(MockAudioContext.instances[0]!.state).toBe('suspended');
    expect(windowMock.addEventListener).toHaveBeenCalledWith(
      'pointerdown',
      expect.any(Function),
      { once: true },
    );
    expect(windowMock.addEventListener).toHaveBeenCalledWith(
      'keydown',
      expect.any(Function),
      { once: true },
    );
  });

  it('AudioContext running 时不绑定 resume', async () => {
    vi.stubGlobal(
      'AudioContext',
      class extends MockAudioContext {
        constructor() {
          super('running');
        }
      },
    );
    const { attachGainChain } = await load();
    attachGainChain(makeEl());
    expect(windowMock.addEventListener).not.toHaveBeenCalled();
  });
});

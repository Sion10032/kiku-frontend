import { describe, expect, it, vi } from 'vitest';
import { createEqChain, EQ_BANDS, type EqChain } from './equalizer';

// node 测试环境无 Web Audio：注入可观测桩 AudioContext。
// createBiquadFilter 返回记录 type/frequency/Q/gain 与 connect 目标的假节点，
// createEqChain 只依赖这些成员，无需 jsdom。

interface ParamMock {
  value: number;
  setTargetAtTime: ReturnType<typeof vi.fn>;
}

class MockBiquad {
  type = 'peaking';
  frequency: ParamMock = { value: 0, setTargetAtTime: vi.fn() };
  Q: ParamMock = { value: 0, setTargetAtTime: vi.fn() };
  gain: ParamMock = { value: 0, setTargetAtTime: vi.fn() };
  /** connect 目标（按调用顺序） */
  targets: unknown[] = [];

  connect(dest: unknown): unknown {
    this.targets.push(dest);
    return dest;
  }
}

class MockAudioContext {
  currentTime = 1.23;
  filters: MockBiquad[] = [];
  /** 非 biquad 的 connect 目标（EQ 链不应连到它们） */
  destination = { kind: 'destination' };

  createBiquadFilter(): MockBiquad {
    const filter = new MockBiquad();
    this.filters.push(filter);
    return filter;
  }
}

function makeCtx(): MockAudioContext {
  return new MockAudioContext();
}

function build(): { ctx: MockAudioContext; chain: EqChain } {
  const ctx = makeCtx();
  const chain = createEqChain(ctx as unknown as AudioContext);
  return { ctx, chain };
}

describe('createEqChain 装配', () => {
  it('建 10 个 biquad：lowshelf ×1 + peaking ×8 + highshelf ×1，frequency 对应 EQ_BANDS', () => {
    const { ctx } = build();
    expect(ctx.filters).toHaveLength(10);
    expect(ctx.filters.map((f) => f.type)).toEqual([
      'lowshelf',
      ...new Array(8).fill('peaking'),
      'highshelf',
    ]);
    expect(ctx.filters.map((f) => f.frequency.value)).toEqual([...EQ_BANDS]);
  });

  it('串联顺序：input 为首节点、output 为末节点，节点 i connect 到节点 i+1', () => {
    const { ctx, chain } = build();
    expect(chain.input).toBe(ctx.filters[0]);
    expect(chain.output).toBe(ctx.filters[9]);
    for (let i = 0; i < 9; i++) {
      expect(ctx.filters[i]!.targets).toEqual([ctx.filters[i + 1]]);
    }
    // 末节点不外连（由调用方接下游）
    expect(ctx.filters[9]!.targets).toEqual([]);
  });

  it('setBands(gains, qs, true)：各节点 gain 收到对应传入值，时间常数 0.05', () => {
    const { ctx, chain } = build();
    const gains = [1, -2, 3.5, 0, -0.5, 6, -12, 12, 2.5, -7];
    const qs = [1.4, 0.5, 0.6, 0.7, 0.8, 1.1, 1.2, 1.3, 2.4, 8];
    chain.setBands(gains, qs, true);
    for (let i = 0; i < 10; i++) {
      const calls = ctx.filters[i]!.gain.setTargetAtTime.mock.calls;
      expect(calls).toHaveLength(1);
      expect(calls[0]).toEqual([gains[i], 1.23, 0.05]);
    }
  });

  it('setBands(…, false)：全部 gain 目标 0（恒等变换，链不断开）', () => {
    const { ctx, chain } = build();
    const gains = [12, -12, 6, 6, 6, 6, 6, 6, -6, -6];
    chain.setBands(gains, new Array(10).fill(2), false);
    for (let i = 0; i < 10; i++) {
      const calls = ctx.filters[i]!.gain.setTargetAtTime.mock.calls;
      expect(calls).toHaveLength(1);
      expect(calls[0]).toEqual([0, 1.23, 0.05]);
    }
  });
});

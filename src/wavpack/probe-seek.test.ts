import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import decodeWavpack, { decoder } from '@audio/decode-wavpack';
import { parseBlockHeader } from './block-header';
import type { IndexEntry } from './block-index';
import { locateBlock } from './probe-seek';
import type { RangeRead } from './probe-seek';
import { concatBlocks, makeBlock } from './__fixtures__/make-block';

const fixture = new Uint8Array(
  readFileSync(path.join(import.meta.dirname, '__fixtures__/test-6s.wv')),
);
const FILE_SIZE = fixture.length;
const TOTAL_SAMPLES = 264600;

/** 内存版 RangeRead：从 Uint8Array 切片，越界钳制 */
function memRead(u8: Uint8Array): RangeRead {
  return async (start, end) => {
    const s = Math.max(0, Math.min(start, u8.length));
    const e = Math.max(s, Math.min(end, u8.length));
    return u8.subarray(s, e);
  };
}

/** 统计 read 调用次数的内存版 */
function countingRead(u8: Uint8Array): {
  read: RangeRead;
  calls: Array<[number, number]>;
} {
  const calls: Array<[number, number]> = [];
  const read: RangeRead = async (start, end) => {
    calls.push([start, end]);
    return memRead(u8)(start, end);
  };
  return { read, calls };
}

/** 用 parseBlockHeader 全文件扫描出真实 entries（期望值基准） */
function scanFixture(): IndexEntry[] {
  const entries: IndexEntry[] = [];
  let pos = 0;
  while (pos + 32 <= fixture.length) {
    const h = parseBlockHeader(fixture, pos);
    if (!h) break;
    entries.push({
      offset: h.offset,
      sampleIndex: h.sampleIndex,
      blockSamples: h.blockSamples,
      flags: h.flags,
    });
    pos += h.blockSize;
  }
  return entries;
}

describe('locateBlock：fixture 探测命中', () => {
  it('中段 sample 130000 → 第 6 块（sampleIndex 110250）', async () => {
    const entry = await locateBlock(
      memRead(fixture),
      FILE_SIZE,
      TOTAL_SAMPLES,
      130000,
    );
    expect(entry).toEqual({
      offset: expect.any(Number),
      sampleIndex: 110250,
      blockSamples: 22050,
      flags: expect.any(Number),
    });
    // entry 必须真实落在该块上
    expect(entry!.offset).toBe(scanFixture()[5].offset);
  });

  it('末段 sample 264599 → 末块（sampleIndex 242550）', async () => {
    const entry = await locateBlock(
      memRead(fixture),
      FILE_SIZE,
      TOTAL_SAMPLES,
      264599,
    );
    expect(entry).not.toBeNull();
    expect(entry!.sampleIndex).toBe(242550);
    expect(entry!.offset).toBe(302878);
  });

  it('1 帧处 sample 1 → 首块', async () => {
    const entry = await locateBlock(
      memRead(fixture),
      FILE_SIZE,
      TOTAL_SAMPLES,
      1,
    );
    expect(entry).not.toBeNull();
    expect(entry!.offset).toBe(0);
    expect(entry!.sampleIndex).toBe(0);
  });

  it('sample 0 → 首块', async () => {
    const entry = await locateBlock(
      memRead(fixture),
      FILE_SIZE,
      TOTAL_SAMPLES,
      0,
    );
    expect(entry).not.toBeNull();
    expect(entry!.offset).toBe(0);
  });
});

describe('locateBlock：无魔数窗口仍收敛', () => {
  it('估算落在大块内部（64KB 窗口无魔数）时扩窗重试命中', async () => {
    // 3 个 ~120KB 的大块：窗口先落在块 1 内部（无魔数），扩窗后命中
    // 块 k 占 [k*120032, (k+1)*120032)，sampleIndex = k*30000
    const blocks = [0, 1, 2].map((k) =>
      makeBlock({
        sampleIndex: k * 30000,
        blockSamples: 30000,
        payloadBytes: 120000,
        flags: 0x820,
        totalSamples: k === 0 ? 90000 : 0,
      }),
    );
    const file = concatBlocks(...blocks);
    const entry = await locateBlock(
      memRead(file),
      file.length,
      90000,
      45000, // est ≈ 180048，落在块 1 内部
    );
    expect(entry).not.toBeNull();
    expect(entry!.offset).toBe(120032);
    expect(entry!.sampleIndex).toBe(30000);
  });
});

describe('locateBlock：组首回退', () => {
  it('命中组内非首块时回退到同 sampleIndex 的组首', async () => {
    // 两组、每组 2 块同 sampleIndex：组首带 INITIAL（0x820），组内后续块不带（0x020）；
    // 命中第 2 组的第二块（组首在窗口外）→ 回退到组首
    const g1head = makeBlock({
      sampleIndex: 0,
      blockSamples: 50000,
      payloadBytes: 60000,
      flags: 0x820, // INITIAL_BLOCK + 杂项
      totalSamples: 100000,
    });
    const g1second = makeBlock({
      sampleIndex: 0,
      blockSamples: 50000,
      payloadBytes: 60000,
      flags: 0x020,
    });
    const g2head = makeBlock({
      sampleIndex: 50000,
      blockSamples: 50000,
      payloadBytes: 60000,
      flags: 0x820, // INITIAL_BLOCK + 杂项
    });
    const g2second = makeBlock({
      sampleIndex: 50000,
      blockSamples: 50000,
      payloadBytes: 60000,
      flags: 0x020,
    });
    const file = concatBlocks(g1head, g1second, g2head, g2second);
    // target 75000：est ≈ 180096 = g2second 头部，g2head（offset 120064）在窗口外
    const entry = await locateBlock(memRead(file), file.length, 100000, 75000);
    expect(entry).not.toBeNull();
    expect(entry!.offset).toBe(2 * g1head.length);
    expect(entry!.sampleIndex).toBe(50000);
  });

  it('命中块带 INITIAL_BLOCK（0x800）标志时直接返回，不回退（仅 1 次 read）', async () => {
    const block = makeBlock({
      sampleIndex: 0,
      blockSamples: 1000,
      payloadBytes: 1000,
      flags: 0x800, // INITIAL_BLOCK
      totalSamples: 1000,
    });
    const { read, calls } = countingRead(block);
    const entry = await locateBlock(read, block.length, 1000, 500);
    expect(entry).not.toBeNull();
    expect(entry!.offset).toBe(0);
    expect(calls.length).toBe(1);
  });

  it('initial（仅 0x800）+ final（仅 0x1000）同 sampleIndex：命中 final 回退返回 initial', async () => {
    // 多声道单组两块：首块仅置 INITIAL_BLOCK（0x800），尾块仅置 FINAL_BLOCK（0x1000）。
    // 命中尾块时若误把 0x1000 当组首会直接返回 final 块，丢失 initial 块的声道数据。
    const initial = makeBlock({
      sampleIndex: 0,
      blockSamples: 50000,
      payloadBytes: 60000,
      flags: 0x800, // 仅 INITIAL_BLOCK
      totalSamples: 50000,
    });
    const final = makeBlock({
      sampleIndex: 0,
      blockSamples: 50000,
      payloadBytes: 60000,
      flags: 0x1000, // 仅 FINAL_BLOCK
    });
    const file = concatBlocks(initial, final);
    // target 25000：est = 60032 恰为 final 块头，initial（offset 0）在窗外 → 必须回退
    const entry = await locateBlock(memRead(file), file.length, 50000, 25000);
    expect(entry).not.toBeNull();
    expect(entry!.offset).toBe(0); // initial 块
    expect(entry!.sampleIndex).toBe(0);
  });

  it('initial（仅 0x800）+ final（仅 0x1000）：命中 initial 直接返回自身（仅 1 次 read）', async () => {
    const initial = makeBlock({
      sampleIndex: 0,
      blockSamples: 50000,
      payloadBytes: 60000,
      flags: 0x800, // 仅 INITIAL_BLOCK
      totalSamples: 50000,
    });
    const final = makeBlock({
      sampleIndex: 0,
      blockSamples: 50000,
      payloadBytes: 60000,
      flags: 0x1000, // 仅 FINAL_BLOCK
    });
    const file = concatBlocks(initial, final);
    // target 10000：est = 24013，窗口 [0, 56781] 含 initial 头 → 命中即返回
    const { read, calls } = countingRead(file);
    const entry = await locateBlock(read, file.length, 50000, 10000);
    expect(entry).not.toBeNull();
    expect(entry!.offset).toBe(0);
    expect(calls.length).toBe(1);
  });
});

describe('locateBlock：大块场景收敛（真实文件回归）', () => {
  // 真实 DLsite 高码率文件块均 136KB、最大 158KB（24000 samples/块），远超 64KB
  // 初始窗口。旧实现对这种情况会无限振荡：「扫到当前块头 → half 重置 →
  // est 算回同一点」直至探测耗尽返回 null。回归断言：命中 + read 次数有上界。
  // 5 个 128-160KB 大块，sampleIndex 每 24000 递增，总时长 120000 samples
  const payloadSizes = [
    128 * 1024,
    136 * 1024,
    150 * 1024,
    158 * 1024,
    140 * 1024,
  ];
  const blocks = payloadSizes.map((payloadBytes, k) =>
    makeBlock({
      sampleIndex: k * 24000,
      blockSamples: 24000,
      payloadBytes,
      flags: 0x820, // INITIAL_BLOCK + 杂项
      totalSamples: k === 0 ? 120000 : 0,
    }),
  );
  const file = concatBlocks(...blocks);
  const total = 5 * 24000;

  it('seek 目标落在第二块中部：命中正确块（旧实现死循环失败）', async () => {
    const { read, calls } = countingRead(file);
    const entry = await locateBlock(read, file.length, total, 36000);
    expect(entry).not.toBeNull();
    expect(entry!.sampleIndex).toBe(24000);
    expect(entry!.offset).toBe(blocks[0].length);
    expect(entry!.blockSamples).toBe(24000);
    // 大块场景收敛约需 4-5 次探测，上界防回归成低效收敛
    expect(calls.length).toBeLessThanOrEqual(6);
  });

  it('seek 目标在第一块内：正常命中', async () => {
    const { read, calls } = countingRead(file);
    const entry = await locateBlock(read, file.length, total, 12000);
    expect(entry).not.toBeNull();
    expect(entry!.sampleIndex).toBe(0);
    expect(entry!.offset).toBe(0);
    expect(calls.length).toBeLessThanOrEqual(6);
  });

  it('seek 目标在末块内：命中末块', async () => {
    const entry = await locateBlock(memRead(file), file.length, total, 110000);
    expect(entry).not.toBeNull();
    expect(entry!.sampleIndex).toBe(96000);
  });

  // blockSizeHint 窗口先验：真实大块文件（均 136KB）下 32KB 初始窗口首窗
  // 必不命中，需 3-4 次 RTT 收敛；传观测均值后 2×hint（~272KB）首窗即可
  // 覆盖命中块，read 次数降为 1（+组首回退最多 2）——一次大窗口换 RTT
  it('blockSizeHint 生效：首窗覆盖命中块，read ≤ 2', async () => {
    const { read, calls } = countingRead(file);
    const entry = await locateBlock(read, file.length, total, 36000, {
      blockSizeHint: 136 * 1024,
    });
    expect(entry).not.toBeNull();
    expect(entry!.sampleIndex).toBe(24000);
    expect(entry!.offset).toBe(blocks[0].length);
    expect(calls.length).toBeLessThanOrEqual(2);
  });

  it('对照：同一文件无 hint 时维持现有行为（命中正确 + read 次数不劣化）', async () => {
    const { read, calls } = countingRead(file);
    const entry = await locateBlock(read, file.length, total, 36000);
    expect(entry).not.toBeNull();
    expect(entry!.sampleIndex).toBe(24000);
    expect(entry!.offset).toBe(blocks[0].length);
    expect(calls.length).toBeLessThanOrEqual(6);
  });

  it('hint 带小数（running mean）：返回的 entry.offset 必须是整数', async () => {
    // 回归：hint 来自 running mean，必然带小数；不取整会透过
    // start/end 污染窗口偏移，返回带小数的 offset，并以小数字节偏移
    // 传进 HTTP Range 请求。真实文件验证（debug-seek3）曾暴露此缺陷
    const entry = await locateBlock(memRead(file), file.length, total, 110000, {
      blockSizeHint: 100 * 1024 + 0.5, // 首窗 start = est - half 为小数
    });
    expect(entry).not.toBeNull();
    expect(Number.isInteger(entry!.offset)).toBe(true);
    expect(entry!.sampleIndex).toBe(96000);
  });

  it('hint 异常值防御：0 / 负数 / NaN / Infinity 行为与无 hint 完全一致', async () => {
    const noHint = countingRead(file);
    await locateBlock(noHint.read, file.length, total, 36000);
    for (const hint of [0, -136 * 1024, NaN, Infinity]) {
      const { read, calls } = countingRead(file);
      const entry = await locateBlock(read, file.length, total, 36000, {
        blockSizeHint: hint,
      });
      expect(entry).not.toBeNull();
      expect(entry!.sampleIndex).toBe(24000);
      expect(calls.length).toBe(noHint.calls.length);
    }
  });
});

describe('locateBlock：探测失败返回 null', () => {
  it('target 超出 totalSamples → 曲末快筛直接返回 null', async () => {
    const entry = await locateBlock(
      memRead(fixture),
      FILE_SIZE,
      TOTAL_SAMPLES,
      300000,
    );
    expect(entry).toBeNull();
  });

  // 终审 I-1 边界：拖动进度到曲末算出的 sample == totalSamples，
  // 命中条件（target < sampleIndex+blockSamples）对其恒不成立，必须快速失败
  it('target = totalSamples（曲末）→ null', async () => {
    const entry = await locateBlock(
      memRead(fixture),
      FILE_SIZE,
      TOTAL_SAMPLES,
      TOTAL_SAMPLES,
    );
    expect(entry).toBeNull();
  });

  it('target = totalSamples - 1（末帧）→ 末块命中', async () => {
    const entry = await locateBlock(
      memRead(fixture),
      FILE_SIZE,
      TOTAL_SAMPLES,
      TOTAL_SAMPLES - 1,
    );
    expect(entry).not.toBeNull();
    expect(entry!.sampleIndex).toBe(242550);
  });

  it('纯垃圾文件（无 wvpk）→ null', async () => {
    const garbage = new Uint8Array(10000).fill(0xff);
    const entry = await locateBlock(
      memRead(garbage),
      garbage.length,
      1000,
      500,
    );
    expect(entry).toBeNull();
  });
});

describe('端到端 seek 一致性（真 decoder，Node 环境）', () => {
  // 真关卡：fixture 全量 decode 为基准 → locateBlock 定位 → 新 decoder 从块偏移喂入
  // → 输出与基准对应区间逐位一致（Object.is 级断言）
  const targets = [
    { name: '首帧', sample: 1 },
    { name: '中段', sample: 130000 },
    { name: '后段', sample: 200000 },
    { name: '末帧', sample: 264599 },
  ];

  it.each(targets)(
    '$name sample $sample：从定位块喂入与全量解码逐位一致',
    async ({ sample }) => {
      const baseline = await decodeWavpack(fixture);
      const entry = await locateBlock(
        memRead(fixture),
        FILE_SIZE,
        TOTAL_SAMPLES,
        sample,
      );
      expect(entry).not.toBeNull();
      expect(entry!.sampleIndex).toBeLessThanOrEqual(sample);
      expect(sample).toBeLessThan(entry!.sampleIndex + entry!.blockSamples);

      const dec = await decoder();
      let seeked: Awaited<ReturnType<typeof decodeWavpack>>;
      try {
        seeked = dec.decode(fixture.subarray(entry!.offset));
      } finally {
        dec.free();
      }

      const start = entry!.sampleIndex;
      expect(baseline.sampleRate).toBe(seeked.sampleRate);
      expect(seeked.channelData.length).toBe(baseline.channelData.length);
      for (let ch = 0; ch < baseline.channelData.length; ch++) {
        const a = baseline.channelData[ch].subarray(start);
        const b = seeked.channelData[ch];
        expect(b.length).toBe(a.length);
        for (let i = 0; i < a.length; i++) {
          if (!Object.is(a[i], b[i])) {
            throw new Error(
              `seek 输出与全量解码不一致：ch=${ch} i=${i} (${a[i]} vs ${b[i]})`,
            );
          }
        }
      }
    },
  );
});

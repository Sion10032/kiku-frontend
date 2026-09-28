// 运行时块大小统计：供 seek 探测窗口先验（blockSizeHint）。
// worker 拉流循环已在扫块头建增量索引，这里顺路以 O(1) running mean
// 收集音频块字节大小的均值——不引入任何对全索引的扫描。

export interface BlockSizeTracker {
  /** 记录一个块头：仅统计音频块（blockSamples > 0）且 blockSize > 0 的观测 */
  observe(blockSamples: number, blockSize: number): void;
  /** 已计入观测的音频块数 */
  readonly count: number;
  /** 已观测音频块的平均字节大小；无观测时为 0（调用方据此省略 hint） */
  readonly mean: number;
}

/** running mean：mean += (size - mean) / count。单变量累积、O(1)、无全量重算，
 *  百万级观测下浮点漂移可忽略（见 block-size-stats.test.ts） */
export function createBlockSizeTracker(): BlockSizeTracker {
  let count = 0;
  let mean = 0;
  return {
    observe(blockSamples, blockSize) {
      // 非音频块（blockSamples=0，如 66B metadata 杂块）会拉偏均值，跳过；
      // blockSize ≤ 0 为异常头，同样防御性跳过
      if (blockSamples <= 0 || blockSize <= 0) return;
      count++;
      mean += (blockSize - mean) / count;
    },
    get count() {
      return count;
    },
    get mean() {
      return mean;
    },
  };
}

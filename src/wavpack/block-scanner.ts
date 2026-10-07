// 跨 chunk 连续的顺序块扫描器：从文件 offset 0 起按块边界推进，把每个
// 合法块头追加进 BlockIndex（复用 appendEntry 的有序去重）。
//
// 与旧 per-chunk 扫描（每 chunk 从 0 重扫 + 逐字节跳垃圾）的差异：
// - 消费边界与 @audio/decode-wavpack 的 JS 包装层严格镜像（同一套
//   magic/ckSize 校验、垃圾即停语义），索引条目因此总是落在 decoder
//   实际消费的确切块边界上，seek 重建（doPlay）依赖这一对齐。
// - 块头跨 chunk 边界时携带 ≤31 字节悬垂 carry 续扫，不丢块、不误判垃圾。
// - 块 payload 跨 chunk 时按绝对偏移直接跳过，不重复解析。
//
// 垃圾（预期边界处无合法头，如尾部 APEv2 trailer）后 stopped=true，
// 与 decoder 包装层的「其后视为 inert trailer」语义一致；损坏文件中段
// 出现垃圾时 decoder 同样停止产出，索引停在断点处由错误路径兜底。

import { appendEntry, type BlockIndex, type IndexEntry } from './block-index';
import { parseBlockHeader, type WvBlockHeader } from './block-header';

/** 块头长（悬垂 carry 上限 = 头长 − 1） */
const HEADER_MIN = 32;

export interface BlockScanner {
  /** 喂入一个 chunk（chunkStart 为其在文件中的绝对字节偏移）。
   *  chunk 必须按文件顺序连续喂入。stopped 后为 no-op。 */
  feed(chunk: Uint8Array, chunkStart: number): void;
  /** 预期边界处无合法块头（trailer/垃圾）后为 true */
  readonly stopped: boolean;
}

/** 创建顺序块扫描器。onBlock 对每个新索引的块回调（含非音频块，
 *  header.offset 为文件绝对偏移），供调用方顺路做块大小统计等。 */
export function createBlockScanner(
  index: BlockIndex,
  onBlock?: (header: WvBlockHeader) => void,
): BlockScanner {
  /** 下一预期块边界的绝对偏移 */
  let nextOffset = 0;
  /** 上一 chunk 尾部悬垂的块头前缀（< 32 字节），与下个 chunk 拼接续扫 */
  let carry: Uint8Array = new Uint8Array(0);
  let stopped = false;

  return {
    get stopped() {
      return stopped;
    },
    feed(chunk: Uint8Array, chunkStart: number): void {
      if (stopped) return;
      let view = chunk;
      let base = chunkStart;
      if (carry.length > 0) {
        view = new Uint8Array(carry.length + chunk.length);
        view.set(carry);
        view.set(chunk, carry.length);
        base = chunkStart - carry.length;
      }
      let i = Math.max(0, nextOffset - base);
      while (i + HEADER_MIN <= view.length) {
        const h = parseBlockHeader(view, i);
        if (!h) {
          // 预期边界处非合法头：与 decoder 包装层一致，其后视为 trailer
          stopped = true;
          carry = new Uint8Array(0);
          return;
        }
        const entry: IndexEntry = {
          offset: base + i,
          sampleIndex: h.sampleIndex,
          blockSamples: h.blockSamples,
          flags: h.flags,
        };
        appendEntry(index, entry);
        onBlock?.({ ...h, offset: base + i });
        nextOffset = base + i + h.blockSize;
        i += h.blockSize;
      }
      // 尾部不足一个完整头：悬垂字节 carry 到下个 chunk（payload 跨界时
      // nextOffset 已越过 view 尾，dangling ≤ 0 → carry 清空）
      const dangling = view.length - i;
      carry =
        dangling > 0 && dangling < HEADER_MIN
          ? view.subarray(i).slice()
          : new Uint8Array(0);
    },
  };
}

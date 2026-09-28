// 插值探测 seek：在只支持 HTTP Range 拉流的远端 .wv 文件上，
// 用全局平均密度估算目标块位置，中心窗口扫描块头，未命中按差值平移重试。
import { INITIAL_BLOCK, parseBlockHeader } from './block-header';
import type { IndexEntry } from './block-index';

/** [start, end) 半开区间字节读取 */
export type RangeRead = (start: number, end: number) => Promise<Uint8Array>;

const WINDOW_HALF = 32 * 1024; // 中心窗口半径：64KB 窗口对 ~25KB 块必含 ≥2 个块头
const MAX_PROBES = 12; // 探测次数上限（小块实测 ≤2；真实大块文件收敛约 4-5 次，留余量）
const GROUP_BACKTRACK_LIMIT = 1024 * 1024; // 组首回拉上限 1MB

interface CandidateHeader {
  offset: number;
  blockSize: number;
  sampleIndex: number;
  blockSamples: number;
  flags: number;
}

/** 扫描窗口内全部块头（相对位置逐字节推进，魔数对齐后按 blockSize 跳跃） */
function scanWindow(win: Uint8Array, winStart: number): CandidateHeader[] {
  const headers: CandidateHeader[] = [];
  let pos = 0;
  while (pos + 32 <= win.length) {
    const h = parseBlockHeader(win, pos);
    if (h) {
      headers.push({
        offset: winStart + pos,
        blockSize: h.blockSize,
        sampleIndex: h.sampleIndex,
        blockSamples: h.blockSamples,
        flags: h.flags,
      });
      pos += h.blockSize;
    } else {
      pos++;
    }
  }
  return headers;
}

function toEntry(h: CandidateHeader): IndexEntry {
  return {
    offset: h.offset,
    sampleIndex: h.sampleIndex,
    blockSamples: h.blockSamples,
    flags: h.flags,
  };
}

/**
 * 组首回退：命中块不带 INITIAL_BLOCK 时，从命中块往回拉（步长 2×blockSize，
 * 上限 1MB），找同 sampleIndex 的更早块作为组首；遇到不同 sampleIndex 的块
 * （前一组）即停止。找不到更早同组块时，命中块自身就是组首。
 */
async function resolveGroupHead(
  read: RangeRead,
  hit: CandidateHeader,
): Promise<IndexEntry> {
  if (hit.flags & INITIAL_BLOCK) return toEntry(hit);
  let candidate = hit;
  let anchor = hit.offset;
  while (anchor > 0 && hit.offset - anchor < GROUP_BACKTRACK_LIMIT) {
    const start = Math.max(0, anchor - 2 * hit.blockSize);
    const win = await read(start, anchor);
    const headers = scanWindow(win, start);
    const h = headers[headers.length - 1]; // 紧邻 anchor 之前的块头
    if (!h) break; // 窗口内无更早块头：candidate 就是组首
    if (h.sampleIndex !== candidate.sampleIndex) {
      return toEntry(candidate); // 越过组边界：candidate 已是组首
    }
    if (h.flags & INITIAL_BLOCK) return toEntry(h);
    candidate = h;
    anchor = h.offset;
  }
  return toEntry(candidate);
}

/**
 * 插值探测 targetSample 所在块，返回组首块 entry。
 * ① est = target × fileSize/totalSamples（全局平均密度）
 * ② 中心窗口 [est−32KB, est+32KB) 扫块头
 * ③ sampleIndex ≤ target < sampleIndex+blockSamples → 命中
 * ④ 未命中：est = 最近块offset − (块sampleIndex − target) × 密度（差值平移）
 *    窗口内无块头：扩窗重试（不可只向右扩窗，估算超前时看不到前面的块头）
 *    扩窗一旦发生就保持窗口大小；平移后 est 未变化（新块头未提供新信息，
 *    大块场景下平移点常落回同一位置）时强制扩窗，避免无限振荡耗尽探测次数
 * ⑤ 上限 12 次；失败返回 null（交 error 路径）
 */
export async function locateBlock(
  read: RangeRead,
  fileSize: number,
  totalSamples: number,
  targetSample: number,
): Promise<IndexEntry | null> {
  if (fileSize <= 0 || totalSamples <= 0) return null;
  // 曲末快筛（终审 I-1）：命中条件对 target=totalSamples 恒不成立，
  // 直接失败避免 8 次无谓探测（调用方应在到达前钳制，此处是防御）
  if (targetSample >= totalSamples) return null;
  const density = fileSize / totalSamples;
  let est = Math.round(targetSample * density);
  let half = WINDOW_HALF;
  for (let attempt = 0; attempt < MAX_PROBES; attempt++) {
    est = Math.max(0, Math.min(est, fileSize - 1));
    const start = Math.max(0, est - half);
    const end = Math.min(fileSize, est + half);
    const win = await read(start, end);
    const headers = scanWindow(win, start);

    let hit: CandidateHeader | null = null;
    for (const h of headers) {
      if (
        h.blockSamples > 0
        && h.sampleIndex <= targetSample
        && targetSample < h.sampleIndex + h.blockSamples
      ) {
        hit = h;
        break; // 最低 offset 的命中块（组内即组首）
      }
    }
    if (hit) return resolveGroupHead(read, hit);

    if (headers.length > 0) {
      // 差值平移：取 sampleIndex 离 target 最近的块反推新估算
      let nearest = headers[0];
      for (const h of headers) {
        if (
          Math.abs(h.sampleIndex - targetSample)
          < Math.abs(nearest.sampleIndex - targetSample)
        ) {
          nearest = h;
        }
      }
      const shifted = Math.round(
        nearest.offset - (nearest.sampleIndex - targetSample) * density,
      );
      if (shifted === est) {
        // 平移失效：新块头推回同一点（大块场景下窗口只见到当前块的头部，
        // 平移又算回原处）。保持 est 不变，强制扩窗以覆盖前一块头
        half *= 2;
      } else {
        est = shifted;
      }
      // 注意：不再重置 half——扩窗进度必须保持，否则大块场景会在
      // 「扫到块头 → half 重置 → est 不变」间无限振荡
    } else {
      // 窗口落在块中间（无魔数）：向两侧扩窗重试
      half *= 2;
    }
  }
  return null;
}

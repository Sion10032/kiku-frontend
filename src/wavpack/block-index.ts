// WavPack 块索引：增量收集块 entry，支持二分定位 sample 所在块。
export interface IndexEntry {
  offset: number;
  sampleIndex: number;
  blockSamples: number;
  flags: number;
}

export interface BlockIndex {
  entries: IndexEntry[];
  totalSamples: number;
}

export function createIndex(totalSamples: number): BlockIndex {
  return { entries: [], totalSamples };
}

/** 按 sampleIndex 有序去重插入（同一 sampleIndex 只保留首个 entry） */
export function appendEntry(index: BlockIndex, e: IndexEntry): void {
  const { entries } = index;
  // 二分找到插入点
  let lo = 0;
  let hi = entries.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (entries[mid].sampleIndex < e.sampleIndex) lo = mid + 1;
    else hi = mid;
  }
  if (lo < entries.length && entries[lo].sampleIndex === e.sampleIndex) return;
  entries.splice(lo, 0, e);
}

/**
 * 二分定位 sample 所在块。
 * 返回 null：sample 落在未索引区域（首块之前、条目空洞、totalSamples 之后）。
 */
export function findBlockAt(
  index: BlockIndex,
  sample: number,
): { entry: IndexEntry; skipFrames: number } | null {
  const { entries } = index;
  // 找最右侧 sampleIndex ≤ sample 的 entry
  let lo = 0;
  let hi = entries.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (entries[mid].sampleIndex <= sample) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (found < 0) return null;
  const entry = entries[found];
  if (sample >= entry.sampleIndex + entry.blockSamples) return null;
  return { entry, skipFrames: sample - entry.sampleIndex };
}

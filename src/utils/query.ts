/**
 * 生成单字段 LQL 查询片段（chip/链接点击 → /works?q=…）。
 *
 * 永远双引号包裹：值含空格/特殊字符时保证 liqe 正确解析；
 * 引号语义为「精确匹配该完整名称」，正是点击 chip 的意图（见计划 D2/D7）。
 * 值内的 " 与 \ 按 liqe 文法转义。
 */
export function fieldQuery(
  field: 'circle' | 'tag' | 'va' | 'series',
  name: string,
): string {
  const escaped = name.replace(/["\\]/g, '\\$&');
  return `${field}:"${escaped}"`;
}

/** 快速筛选：分级取值域（与 LQL age 字段值一致）。 */
export type QuickFilterAge = 'all' | 'r15' | 'r18';

/** 快速筛选：收听状态取值域（URL search param progress 的值）。 */
export type QuickFilterProgress = 'read' | 'inprogress' | 'unread';

/** 快速筛选持久化状态（字段缺省 = 该维度不限）。 */
export interface QuickFilterState {
  age?: QuickFilterAge;
  progress?: QuickFilterProgress;
}

/** localStorage 存储键（快速筛选偏好） */
const QUICK_FILTER_KEY = 'kiku-works-quick-filters';

const AGE_VALUES: readonly QuickFilterAge[] = ['all', 'r15', 'r18'];
const PROGRESS_VALUES: readonly QuickFilterProgress[] = [
  'read',
  'inprogress',
  'unread',
];

/**
 * 读取快速筛选偏好；存储缺失/损坏（解析失败或值不在取值域）时忽略对应字段。
 * URL search param 优先级更高，此处仅作缺省回落。
 */
export function loadQuickFilters(): QuickFilterState {
  try {
    const raw = localStorage.getItem(QUICK_FILTER_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed == null) return {};
    const { age, progress } = parsed as Record<string, unknown>;
    return {
      age:
        typeof age === 'string' && AGE_VALUES.includes(age as QuickFilterAge)
          ? (age as QuickFilterAge)
          : undefined,
      progress:
        typeof progress === 'string'
        && PROGRESS_VALUES.includes(progress as QuickFilterProgress)
          ? (progress as QuickFilterProgress)
          : undefined,
    };
  } catch {
    return {};
  }
}

/**
 * 写入快速筛选偏好（undefined 字段经 JSON 序列化自然落盘为缺省）。
 * 写入失败（隐私模式/超额）吞异常，不影响调用方。
 */
export function saveQuickFilters(state: QuickFilterState): void {
  try {
    localStorage.setItem(QUICK_FILTER_KEY, JSON.stringify(state));
  } catch {
    /* localStorage 不可用时静默 */
  }
}

/**
 * 快速筛选条件 → 完整 LQL 查询：与已有 q（搜索框输入）用 AND 附加。
 *
 * 各状态映射为互斥桶（已读/进行中/未读三分全集）：
 * - read → read:true（有已读标记）
 * - inprogress → progress:true AND read:false（有进度且未标记已读）
 * - unread → read:false AND progress:false（无已读标记且无进度）
 *
 * 后端白名单需支持 read/progress 布尔字段（见 backend compiler.ts）。
 */
export function mergeWorksQuery(input: {
  q?: string;
  age?: QuickFilterAge;
  progress?: QuickFilterProgress;
}): string | undefined {
  const fragments: string[] = [];
  const base = input.q?.trim();
  if (base) fragments.push(base);
  if (input.age) fragments.push(`age:${input.age}`);
  switch (input.progress) {
    case 'read':
      fragments.push('read:true');
      break;
    case 'inprogress':
      fragments.push('progress:true AND read:false');
      break;
    case 'unread':
      fragments.push('read:false AND progress:false');
      break;
  }
  return fragments.length > 0 ? fragments.join(' AND ') : undefined;
}

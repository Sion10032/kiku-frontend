/**
 * DLsite 作品代码（workid）前端工具。
 *
 * 与后端 kiku-backend/src/utils/workcode.ts 的规则人工对齐（前端无法跨包复用），
 * 修改规则时两端需同步。
 *
 * 支持前缀：RJ（同人作品）/ VJ（商业作品）以及人工作品前缀（见
 * MANUAL_PREFIXES），大小写不敏感。
 */

export type WorkCodePrefix = 'RJ' | 'VJ';

const PREFIX_SOURCE = '([Rr][Jj]|[Vv][Jj])';

/** 任意两位字母前缀（与后端 workcode.ts 的大小写不敏感字符类对齐）。 */
const ANY_PREFIX_SOURCE = '([A-Za-z]{2})';

/**
 * 规范化作品 id 为完整代码（如 "RJ01173549" / "VJ01003042"）。
 *
 * 与后端 workcode.ts 的 parseWorkCode 规则对齐：前缀为任意两位字母（不限于
 * RJ/VJ，如人工作品 UW），数字部分必须恰好为 6 位或 8 位，一律不补零、原样
 * 保留（接受 "VJ01003042" / "vj01003042" / "UW00000001" / "231176" 等形式）；
 * 前缀大小写归一为大写，缺省时默认按 RJ 处理（保留既有宽松行为）；无法解析
 * 时抛错（走路由错误边界）。
 */
export function normalizeWorkId(raw: string): string {
  const match = raw.match(new RegExp(`^${ANY_PREFIX_SOURCE}?(\\d{6}|\\d{8})$`));
  if (!match?.[2]) {
    throw new Error(`Invalid work id: ${raw}`);
  }
  const prefix = (match[1]?.toUpperCase() ?? 'RJ') as WorkCodePrefix;
  return `${prefix}${match[2]}`;
}

/**
 * 人工作品（非 DLsite）代码前缀集合。
 *
 * 与后端 kiku-backend/src/infra/sources/manual.ts 的 MANUAL_PREFIXES 人工对齐，
 * 新增前缀时两处需同步。
 */
export const MANUAL_PREFIXES: readonly string[] = ['UW'];

/**
 * 判断作品 id 的来源：RJ/VJ → 'dlsite'；命中人工作品前缀（MANUAL_PREFIXES）
 * → 'manual'；其余（无法识别）返回 null。前缀大小写不敏感。
 */
export function classifyWorkSource(id: string): 'dlsite' | 'manual' | null {
  const match = id.match(new RegExp(`^${ANY_PREFIX_SOURCE}(\\d{6}|\\d{8})$`));
  if (!match) return null;
  const prefix = match[1].toUpperCase();
  if (prefix === 'RJ' || prefix === 'VJ') return 'dlsite';
  if ((MANUAL_PREFIXES as readonly string[]).includes(prefix)) return 'manual';
  return null;
}

/** 提取作品 id 的前缀（大写）；非 RJ/VJ 开头时返回 null。 */
export function getWorkCodePrefix(id: string): WorkCodePrefix | null {
  const match = id.match(new RegExp(`^${PREFIX_SOURCE}`));
  return match ? (match[1].toUpperCase() as WorkCodePrefix) : null;
}

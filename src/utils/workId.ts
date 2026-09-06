/**
 * DLsite 作品代码（workid）前端工具。
 *
 * 与后端 kiku-backend/src/utils/rjcode.ts 的规则人工对齐（前端无法跨包复用），
 * 修改规则时两端需同步。
 *
 * 支持前缀：RJ（同人作品）/ VJ（商业作品），大小写不敏感。
 */

export type WorkCodePrefix = 'RJ' | 'VJ';

const PREFIX_SOURCE = '([Rr][Jj]|[Vv][Jj])';

/**
 * 规范化作品 id 为完整代码（如 "RJ01173549" / "VJ01003042"）。
 *
 * 与后端 extractWorkCode/parseWorkCode 规则对齐：数字部分必须恰好为 6 位或
 * 8 位，一律不补零、原样保留（接受 "VJ01003042" / "vj01003042" / "231176"
 * 等形式）；前缀大小写归一为大写，缺省时默认按 RJ 处理（保留既有宽松行为）；
 * 无法解析时抛错（走路由错误边界）。
 */
export function normalizeWorkId(raw: string): string {
  const match = raw.match(new RegExp(`^${PREFIX_SOURCE}?(\\d{6}|\\d{8})$`));
  if (!match?.[2]) {
    throw new Error(`Invalid work id: ${raw}`);
  }
  const prefix = (match[1]?.toUpperCase() ?? 'RJ') as WorkCodePrefix;
  return `${prefix}${match[2]}`;
}

/** 提取作品 id 的前缀（大写）；非 RJ/VJ 开头时返回 null。 */
export function getWorkCodePrefix(id: string): WorkCodePrefix | null {
  const match = id.match(new RegExp(`^${PREFIX_SOURCE}`));
  return match ? (match[1].toUpperCase() as WorkCodePrefix) : null;
}

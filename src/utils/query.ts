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

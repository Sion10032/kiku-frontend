/**
 * 构建期注入的版本信息（见 vite.config.ts 的 define）。
 *
 * 两个常量各自独立兜底，便于区分「版本可信但 commit 未知」的构建：
 * 版本号与 commit 都只来自构建期注入（版本号通常是发布 tag），未注入时分别是
 * 'dev' 与 'unknown'，所以最坏情况渲染成 `dev-unknown`。
 */
export const APP_VERSION = __APP_VERSION__;
export const APP_COMMIT = __APP_COMMIT__;

/**
 * 拼成 `版本-commit`（`0.1.0-a1b2c3d`）。
 * commit 缺失 / 空白时兜底 'unknown'，不留裸连字符（旧后端不返回该字段时也走这里）。
 */
export function formatVersion(version: string, commit?: string | null): string {
  return `${version}-${commit?.trim() || 'unknown'}`;
}

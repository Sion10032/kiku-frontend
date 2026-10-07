// 取色 Worker 消息协议（一问一答，无状态）。
// 消费方 theme.ts 以 id 配对请求/响应；ok=false 表示提取失败（保持当前主题）。

/** main → worker：请求提取封面种子色 */
export interface SeedColorRequest {
  /** 主线程配对用的唯一 id */
  id: number;
  /** 封面 URL（缩略图优先，如 /api/cover/:id/file?type=240x240） */
  url: string;
}

/** worker → main：提取结果 */
export type SeedColorResponse =
  | { id: number; ok: true; color: string }
  | { id: number; ok: false };

/**
 * 封面状态角标（absolute 定位，置于 relative 封面容器右上角）。
 *
 * 仅登录用户显示（未登录时服务端恒返回 userProgress=null，无法区分未读）。
 * - 未读：无任何播放记录 → 红点（--m3e-error）
 * - 已读：存在播放记录 → 主题色点（--m3e-primary）
 */
const DOT_CLASS =
  'absolute right-2 top-2 z-10 size-3.5 rounded-full border-2 border-(--md-sys-color-outline-variant)/50';

export function UnreadDot() {
  return <span title='未读' className={`${DOT_CLASS} bg-(--md-sys-color-error)`} />;
}

export function ReadDot() {
  return <span title='已读' className={`${DOT_CLASS} bg-(--md-sys-color-primary)`} />;
}

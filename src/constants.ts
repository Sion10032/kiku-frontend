import type { PlayMode } from './stores/playerStore';

/** 播放模式 → 图标名。 */
export const PLAY_MODE_ICON: Record<PlayMode, string> = {
  order: 'playlist_play',
  allRepeat: 'repeat',
  repeatOne: 'repeat_one',
  shuffle: 'shuffle',
};

/** 播放模式 → 中文名（aria-label / 提示用）。 */
export const PLAY_MODE_LABEL: Record<
  PlayMode,
  | 'player.play-mode-order'
  | 'player.play-mode-all-repeat'
  | 'player.play-mode-repeat-one'
  | 'player.play-mode-shuffle'
> = {
  order: 'player.play-mode-order',
  allRepeat: 'player.play-mode-all-repeat',
  repeatOne: 'player.play-mode-repeat-one',
  shuffle: 'player.play-mode-shuffle',
};

/**
 * 响应式断点分层约定（对应 Tailwind 默认断点）：
 * - lg (64rem)：chrome 级布局——侧栏收起、全屏播放器双栏、页面级双栏。
 *   JS 侧单一真源见 layouts/MainLayout.tsx 的 WIDE_QUERY（与
 *   Tailwind --breakpoint-lg 字面同源，勿再另写 px 值）。
 * - sm (40rem)：内容级适配——设置行横排、网格密度、tabs 文字等，
 *   由容器内容宽度决定，不随 chrome 分界联动（<lg 时侧栏已收起，
 *   640px 视口内容区已有 ~592px，横排放得下）。
 */

/** 设置行容器：窄屏「标签上 / 控件下」堆叠，≥sm「标签左 / 控件右」横排。 */
export const SETTING_ROW_LAYOUT =
  'flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between';

/** 设置行控件：窄屏占满行宽，≥sm 恢复内容自适应宽（配合 SETTING_ROW_LAYOUT）。 */
export const SETTING_CONTROL_FILL = 'w-full sm:w-auto';

import type { PlayMode } from './stores/playerStore';

/** 播放模式 → 图标名。 */
export const PLAY_MODE_ICON: Record<PlayMode, string> = {
  order: 'playlist_play',
  allRepeat: 'repeat',
  repeatOne: 'repeat_one',
  shuffle: 'shuffle',
};

/** 播放模式 → 中文名（aria-label / 提示用）。 */
export const PLAY_MODE_LABEL: Record<PlayMode, string> = {
  order: '顺序播放',
  allRepeat: '列表循环',
  repeatOne: '单曲循环',
  shuffle: '随机播放',
};

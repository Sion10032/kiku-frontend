import type { Progress } from './types';
import type { PlayMode } from './stores/playerStore';

/** 进度状态 → 中文标签（对齐原 kikoeru-quasar 的进度筛选文案）。 */
export const PROGRESS_LABELS: Record<Progress, string> = {
  marked: '想听',
  listening: '在听',
  listened: '听过',
  replay: '重听',
  postponed: '搁置',
};

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

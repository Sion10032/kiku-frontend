import { M3eIconButton } from '@m3e/react/icon-button';
import { M3eIcon } from '@m3e/react/icon';
import '@m3e/icons/outlined/play_arrow';
import '@m3e/icons/outlined/pause';
import '@m3e/icons/outlined/skip_next';
import '@m3e/icons/outlined/keyboard_arrow_up';
import { usePlayerStore } from '../stores/playerStore';
import { formatDuration } from '../utils/format';
import LyricsBar from './LyricsBar';

/**
 * 迷你播放条：常驻 MainLayout 底部（grid 第三行）。
 *
 * - 队列为空时渲染 null（对应 grid 行高度为 0）
 * - 展示当前曲目、细进度条与时间，播放/暂停、下一首、展开全屏播放器
 * - 内部渲染 LyricsBar（悬浮于播放条上方的浮动歌词）
 */
export default function PlayerBar() {
  const queue = usePlayerStore((s) => s.queue);
  const queueIndex = usePlayerStore((s) => s.queueIndex);
  const playing = usePlayerStore((s) => s.playing);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const togglePlaying = usePlayerStore((s) => s.togglePlaying);
  const nextTrack = usePlayerStore((s) => s.nextTrack);
  const toggleHide = usePlayerStore((s) => s.toggleHide);

  if (queue.length === 0) return null;

  const track = queue[queueIndex];
  const progress =
    duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <footer
      className="[grid-area:player] relative flex items-center gap-2 border-t border-(--md-sys-color-outline-variant) bg-(--md-sys-color-surface-container) px-4 py-2"
    >
      {/* 浮动歌词（悬浮于播放条上方，绝对定位） */}
      <LyricsBar />
      <M3eIconButton
        aria-label={playing ? '暂停' : '播放'}
        onClick={togglePlaying}
      >
        <M3eIcon name={playing ? 'pause' : 'play_arrow'} />
      </M3eIconButton>
      <M3eIconButton aria-label="下一首" onClick={nextTrack}>
        <M3eIcon name="skip_next" />
      </M3eIconButton>

      <div className="mx-2 min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{track.title}</div>
        <div className="truncate text-xs opacity-70">{track.workTitle}</div>
        {/* 细进度条（不可交互，seek 在全屏播放器） */}
        <div className="mt-1 h-1 overflow-hidden rounded-full bg-(--md-sys-color-surface-container-highest)">
          <div
            className="h-full bg-(--md-sys-color-primary)"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <span className="shrink-0 text-xs tabular-nums opacity-70">
        {formatDuration(currentTime)} / {formatDuration(duration)}
      </span>

      <M3eIconButton aria-label="展开播放器" onClick={toggleHide}>
        <M3eIcon name="keyboard_arrow_up" />
      </M3eIconButton>
    </footer>
  );
}

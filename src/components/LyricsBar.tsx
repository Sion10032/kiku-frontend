import { usePlayerStore } from '../stores/playerStore';

/**
 * 浮动歌词条：有当前歌词行时悬浮于 PlayerBar 上方（水平居中胶囊）。
 *
 * 挂在 PlayerBar 内部，绝对定位在播放条上沿之上，跟随其位置。
 * - 订阅 currentLyric，空字符串渲染 null
 * - key 按行文本重挂载，触发 fade-in 淡入（keyframes 见 index.css）
 * - z-index 高于全屏播放器（z-40），全屏播放时同样可见
 */
export default function LyricsBar() {
  const currentLyric = usePlayerStore((s) => s.currentLyric);

  if (currentLyric === '') return null;

  return (
    <div
      key={currentLyric}
      role="status"
      className="absolute bottom-full left-1/2 z-50 mb-2 max-w-[min(80vw,560px)] -translate-x-1/2 truncate rounded-full bg-(--md-sys-color-surface-container-high) px-4 py-1.5 text-sm shadow-lg animate-[fade-in_0.3s_ease-out]"
    >
      {currentLyric}
    </div>
  );
}

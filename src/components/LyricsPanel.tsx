import { useEffect, useRef } from 'react';
import { usePlayerStore } from '../stores/playerStore';
import { seekTo } from '../hooks/usePlayer';

/**
 * 全屏播放器歌词面板。
 *
 * - 订阅 lyricLines + activeLyricIndex，当前行高亮并自动居中滚动
 * - 点击行 seekTo(line.start)
 * - 无歌词时由父组件决定占位（本组件仅在 lines 非空时渲染）
 */
export default function LyricsPanel() {
  const lyricLines = usePlayerStore((s) => s.lyricLines);
  const activeLyricIndex = usePlayerStore((s) => s.activeLyricIndex);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<HTMLLIElement | null>(null);

  // 上一次激活行号：-1（无/切曲重置）→ 有值时用瞬时定位，避免从顶部长距离动画滚动
  const prevIndexRef = useRef(-2);

  // 当前行变化 → 手动滚动容器使当前行居中。
  // 不用 scrollIntoView：它会沿祖先链滚动所有可滚动容器（波及外层布局）。
  useEffect(() => {
    const container = containerRef.current;
    const active = activeRef.current;
    const prev = prevIndexRef.current;
    prevIndexRef.current = activeLyricIndex;
    if (!container || !active) return;
    // 面板初挂载/切曲（prev === -1）或首次同步（-2）时直接跳转，仅行间连续变化才平滑滚动
    const instant = prev === -2 || prev === -1;
    container.scrollTo({
      top:
        active.offsetTop -
        (container.clientHeight - active.offsetHeight) / 2,
      behavior: instant ? 'auto' : 'smooth',
    });
  }, [activeLyricIndex]);

  return (
    <div ref={containerRef} className="min-h-0 w-full flex-1 overflow-y-auto">
      <ul className="mx-auto flex max-w-xl list-none flex-col items-center gap-4 px-4">
        {lyricLines.map((line, index) => {
          const active = index === activeLyricIndex;
          return (
            <li
              key={`${line.start}-${index}`}
              ref={active ? activeRef : undefined}
              onClick={() => seekTo(line.start)}
              className={[
                'cursor-pointer text-center leading-relaxed transition-all',
                active
                  ? 'text-xl font-medium text-(--md-sys-color-primary)'
                  : 'text-base text-(--md-sys-color-on-surface-variant) hover:text-(--md-sys-color-on-surface)',
              ].join(' ')}
            >
              {line.text}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

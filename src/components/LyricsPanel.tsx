import { useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { M3eIcon } from '@m3e/react/icon';
import '@m3e/icons/outlined/play_arrow';
import { usePlayerStore } from '../stores/playerStore';
import { seekTo } from '../hooks/usePlayer';
import { formatDuration } from '../utils/format';

/**
 * 全屏播放器歌词面板。
 *
 * - 订阅 lyricLines + activeLyricIndex，当前行高亮并自动居中滚动
 * - 两段式点击确认：首次点击标记待跳转行（左侧目标时间戳 +
 *   右侧 ▶ 小图标），再点同一行才 seekTo；点其他行仅移动标记；
 *   3 秒超时自动取消
 * - 行点击 stopPropagation，空白处点击由父组件处理（窄屏返回封面）
 * - 无歌词时由父组件隐藏本面板
 */
export default function LyricsPanel() {
  const lyricLines = usePlayerStore(s => s.lyricLines);
  const activeLyricIndex = usePlayerStore(s => s.activeLyricIndex);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<HTMLLIElement | null>(null);

  // 上一次激活行号：-1（无/切曲重置）→ 有值时用瞬时定位，避免从顶部长距离动画滚动
  const prevIndexRef = useRef(-2);

  // 待跳转行（两段式点击第一段）；null = 无标记
  const [ pendingIndex, setPendingIndex ] = useState<number | null>(null);
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 切曲（行数据更换）重置待跳转标记并取消超时
  useEffect(() => {
    setPendingIndex(null);
    if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
  }, [ lyricLines ]);

  // 卸载时清理定时器
  useEffect(
    () => () => {
      if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
    },
    [],
  );

  // 当前行变化 → 手动滚动容器使当前行居中。
  // 不用 scrollIntoView：它会沿祖先链滚动所有可滚动容器（波及外层布局）。
  useEffect(() => {
    const container = containerRef.current;
    const active = activeRef.current;
    const prev = prevIndexRef.current;
    prevIndexRef.current = activeLyricIndex;
    if (!container || !active) return;
    // 面板初挂载/切曲（prev === -1）、首次同步（-2）或非连续跳变
    // （暂停 seek 等，|Δ|>1）时直接跳转，仅行间连续变化才平滑滚动
    const instant =
      prev === -2 || prev === -1 || Math.abs(activeLyricIndex - prev) > 1;
    container.scrollTo({
      top:
        active.offsetTop
        - (container.clientHeight - active.offsetHeight) / 2,
      behavior: instant ? 'auto' : 'smooth',
    });
  }, [ activeLyricIndex ]);

  /** 两段式行点击：首次标记待跳转，再次点同一行才 seek；阻止冒泡
      以免触发父级（窄屏点歌词区域返回封面）。 */
  function handleLineClick(e: MouseEvent, index: number, start: number) {
    e.stopPropagation();
    if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
    if (pendingIndex === index) {
      setPendingIndex(null);
      seekTo(start);
      return;
    }
    setPendingIndex(index);
    pendingTimerRef.current = setTimeout(() => setPendingIndex(null), 3000);
  }

  return (
    <div ref={containerRef} className='min-h-0 w-full flex-1 overflow-y-auto'>
      <ul className='mx-auto flex max-w-xl list-none flex-col items-center gap-4 px-4'>
        {lyricLines.map((line, index) => {
          const active = index === activeLyricIndex;
          const pending = index === pendingIndex;
          return (
            <li
              key={`${line.start}-${index}`}
              ref={active ? activeRef : undefined}
              onClick={e => handleLineClick(e, index, line.start)}
              className={[
                'flex items-center justify-center gap-1 cursor-pointer text-center leading-relaxed transition-all',
                active || pending
                  ? 'text-xl font-medium text-(--md-sys-color-primary)'
                  : 'text-base text-(--md-sys-color-on-surface-variant) hover:text-(--md-sys-color-on-surface)',
              ].join(' ')}>
              {pending && (
                <span className='mr-1.5 shrink-0 text-xs tabular-nums opacity-70'>
                  {formatDuration(line.start)}
                </span>
              )}
              <span className='min-w-0'>{line.text}</span>
              {pending && (
                <M3eIcon
                  name='play_arrow'
                  className='flex shrink-0 items-center justify-center [--m3e-icon-size:1em]' />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

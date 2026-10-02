import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import clsx from 'clsx';
import { M3eIcon } from '@m3e/react/icon';
import '@m3e/icons/outlined/play_arrow';
import { useTranslation } from 'react-i18next';
import { usePlayerStore } from '../../stores/playerStore';
import { seekTo } from '../../hooks/usePlayer';
import { formatDuration } from '../../utils/format';
import { findCenteredLine } from './centeredLine';

/** 浏览状态（滚离播放行）停止操作后自动回中的超时。 */
const BROWSE_RETURN_DELAY_MS = 5000;

/**
 * 全屏播放器歌词面板。
 *
 * - 订阅 lyricLines + activeLyricIndex，当前行高亮并自动居中滚动
 * - 仅"视口中心行"可点击跳转：同步状态（中心 = 当前行，未测量时兜底
 *   为当前行）点击 seek 到本行起始；手动滚离播放行进入浏览状态，中心
 *   行加半透明背景并以时间戳（居左）/ ▶ 图标（居右）标记跳转目标，
 *   文字列自动避让两侧。其余行点击不拦截，冒泡给父容器（窄屏返回
 *   封面）
 * - 浏览状态暂停自动跟随（播放行推进不回拉）；滚回播放行（测量中心
 *   = 当前行）、点中心行 seek 或停止操作 5 秒超时后自动回中，恢复
 *   跟随。切曲重置回跟随
 * - 自动居中为 programmatic 滚动，期间抑制 scroll 判定，避免把自动
 *   滚动误认作用户滚动；用户按下/滚轮立即解除，1s 超时兜底
 * - 无歌词时由父组件隐藏本面板
 */
export default function LyricsPanel() {
  const { t } = useTranslation();
  const lyricLines = usePlayerStore((s) => s.lyricLines);
  const activeLyricIndex = usePlayerStore((s) => s.activeLyricIndex);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<HTMLLIElement | null>(null);

  // 上一次激活行号：-1（无/切曲重置）→ 有值时用瞬时定位，避免从顶部长距离动画滚动
  const prevIndexRef = useRef(-2);

  // 滚动位置派生的中心行号；null = 尚未测量（点击目标兜底为当前行）
  const [centeredIndex, setCenteredIndex] = useState<number | null>(null);
  // 浏览状态：用户手动滚离播放行；测量中心回到当前行 / 点中心行 seek
  // 即退出。独立 state（不派生自 centeredIndex）：自动跟随滚动后测量
  // 值存在滞后期，派生判定会误报
  const [browsing, setBrowsing] = useState(false);

  // 中心行号（未测量时兜底为当前行，保证同步状态语义一致）
  const centered = centeredIndex ?? activeLyricIndex;

  // 切曲（行数据更换）重置测量与浏览状态，恢复自动跟随（渲染期调整
  // state，替代 effect 中 setState）
  const [prevLines, setPrevLines] = useState(lyricLines);
  if (lyricLines !== prevLines) {
    setPrevLines(lyricLines);
    setCenteredIndex(null);
    setBrowsing(false);
  }

  // programmatic 滚动抑制：自动居中期间忽略 scroll 判定，直到到位 /
  // 超时兜底 / 用户交互打断
  const suppressRef = useRef(false);
  const targetTopRef = useRef<number | null>(null);
  const suppressTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  // 浏览超时自动回中计时器
  const browseTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  /** 解除 programmatic 抑制（只操作 ref，稳定引用）。 */
  const endSuppress = useCallback(() => {
    suppressRef.current = false;
    targetTopRef.current = null;
    clearTimeout(suppressTimerRef.current);
    suppressTimerRef.current = undefined;
  }, []);

  // 卸载时清理计时器
  useEffect(
    () => () => {
      clearTimeout(suppressTimerRef.current);
      clearTimeout(browseTimerRef.current);
    },
    [],
  );

  /** programmatic 滚动到指定行中心（带 scroll 判定抑制，1s 兜底解除）。 */
  const scrollToLine = useCallback(
    (li: HTMLLIElement, behavior: ScrollBehavior) => {
      const container = containerRef.current;
      if (!container) return;
      const top = li.offsetTop - (container.clientHeight - li.offsetHeight) / 2;
      suppressRef.current = true;
      targetTopRef.current = top;
      clearTimeout(suppressTimerRef.current);
      suppressTimerRef.current = setTimeout(endSuppress, 1000);
      container.scrollTo({ top, behavior });
    },
    [endSuppress],
  );

  /** 测量当前滚动位置的中心行，并据此维护浏览状态与超时回中计时。 */
  const measureCentered = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const centers = Array.from(
      container.querySelectorAll('li'),
      (li) => li.offsetTop + li.offsetHeight / 2,
    );
    const measured = findCenteredLine(
      centers,
      container.scrollTop,
      container.clientHeight,
    );
    const offPlayback =
      measured !== -1
      && measured !== usePlayerStore.getState().activeLyricIndex;
    setCenteredIndex(measured);
    setBrowsing(offPlayback);
    // 浏览中刷新超时回中计时；回到同步（或点行 seek）则取消
    clearTimeout(browseTimerRef.current);
    browseTimerRef.current = offPlayback
      ? setTimeout(() => {
          const active = activeRef.current;
          if (active) scrollToLine(active, 'smooth');
        }, BROWSE_RETURN_DELAY_MS)
      : undefined;
  }, [scrollToLine]);

  // scroll 事件天然按帧派发，无需 rAF 节流。抑制期间等到位后解除并
  // 复测，否则直接测量中心行。
  function handleScroll() {
    if (suppressRef.current) {
      const container = containerRef.current;
      const target = targetTopRef.current;
      const settled =
        container != null
        && target != null
        && Math.abs(container.scrollTop - target) < 2;
      if (settled) {
        endSuppress();
        measureCentered();
      }
      return;
    }
    measureCentered();
  }

  // 当前行变化 → 手动滚动容器使当前行居中（浏览状态下跳过，不回拉）。
  // 不用 scrollIntoView：它会沿祖先链滚动所有可滚动容器（波及外层布局）。
  // prev 未变（仅 browsing 翻转引发的重跑）时直接短路。
  useEffect(() => {
    const active = activeRef.current;
    const prev = prevIndexRef.current;
    prevIndexRef.current = activeLyricIndex;
    if (!active) return;
    if (prev === activeLyricIndex) return;
    if (browsing) return;
    // 面板初挂载/切曲（prev === -1）、首次同步（-2）或非连续跳变
    // （暂停 seek 等，|Δ|>1）时直接跳转，仅行间连续变化才平滑滚动
    const instant =
      prev === -2 || prev === -1 || Math.abs(activeLyricIndex - prev) > 1;
    scrollToLine(active, instant ? 'auto' : 'smooth');
  }, [activeLyricIndex, browsing, scrollToLine]);

  /** 中心行激活（点击 / Enter / Space）：seek 并恢复同步跟随。 */
  function activateCenteredLine(e: MouseEvent | KeyboardEvent, start: number) {
    e.stopPropagation();
    clearTimeout(browseTimerRef.current);
    browseTimerRef.current = undefined;
    setBrowsing(false);
    seekTo(start);
  }

  /** 行点击：仅中心行 seek（同步 = 本行起始，浏览 = 跳转目标）；其余行
      不拦截，冒泡到父容器（窄屏返回封面）。 */
  function handleLineClick(e: MouseEvent, index: number, start: number) {
    if (index === centered) activateCenteredLine(e, start);
  }

  /** 中心行键盘激活（role=button）。 */
  function handleLineKeyDown(e: KeyboardEvent, index: number, start: number) {
    if (index === centered && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      activateCenteredLine(e, start);
    }
  }

  return (
    // relative：让行 offsetTop 以本容器为基准（findCenteredLine 的坐标前提）
    <div
      ref={containerRef}
      onScroll={handleScroll}
      onPointerDown={endSuppress}
      onWheel={endSuppress}
      className='relative min-h-0 w-full flex-1 overflow-y-auto'
    >
      <ul className='mx-auto flex max-w-xl list-none flex-col items-center gap-4 px-4'>
        {lyricLines.map((line, index) => {
          const active = index === activeLyricIndex;
          const isCentered = index === centered;
          // 浏览状态中心行：半透明背景 + 左右时间戳/图标标记跳转目标
          const isBrowsingTarget = browsing && isCentered && !active;
          return (
            <li
              key={`${line.start}-${index}`}
              ref={active ? activeRef : undefined}
              role={isCentered ? 'button' : undefined}
              tabIndex={isCentered ? 0 : undefined}
              aria-label={
                isCentered
                  ? t('player.seek-to', { time: formatDuration(line.start) })
                  : undefined
              }
              onClick={(e) => handleLineClick(e, index, line.start)}
              onKeyDown={(e) => handleLineKeyDown(e, index, line.start)}
              className={clsx(
                'flex w-full items-center px-2 text-center leading-relaxed transition-all',
                isBrowsingTarget ? 'gap-2' : 'justify-center',
                isCentered ? 'cursor-pointer' : 'cursor-default',
                active
                  ? 'text-xl font-medium text-(--md-sys-color-primary)'
                  : 'text-base text-(--md-sys-color-on-surface-variant) hover:text-(--md-sys-color-on-surface)',
                isBrowsingTarget
                  && 'rounded-xl bg-(--md-sys-color-on-surface)/10',
              )}
            >
              {isBrowsingTarget && (
                <span className='shrink-0 text-xs tabular-nums opacity-70'>
                  {formatDuration(line.start)}
                </span>
              )}
              <span className='min-w-0 flex-1'>{line.text}</span>
              {isBrowsingTarget && (
                <M3eIcon
                  name='play_arrow'
                  className='flex shrink-0 items-center justify-center [--m3e-icon-size:1em]'
                />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

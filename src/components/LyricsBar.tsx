import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { usePlayerStore } from '../stores/playerStore';
import { useSettingsStore } from '../stores/settingsStore';

/** 单行滚动速度（px/s）：无行时长数据时的兜底，与短促行的上限。 */
const FALLBACK_SPEED = 40;
const MAX_SPEED = 150;
/** 滚动时长上限（s）：超长行滚完即静止，不做 2px/s 爬行。 */
const MAX_DURATION = 15;
/** 视口两侧文字渐隐：配合胶囊 px-3 实底，滚动文字不碰边。 */
const EDGE_FADE =
  'linear-gradient(to right, transparent 0, black 10px, black calc(100% - 10px), transparent 100%)';

/**
 * 浮动歌词条：有当前歌词行时悬浮于 PlayerBar 上方（水平居中胶囊）。
 *
 * 挂在 PlayerBar 内部，绝对定位在播放条上沿之上，跟随其位置。
 * - 订阅 currentLyric，空字符串渲染 null
 * - 全屏播放器展开时（hide=false）不渲染（全屏内已有歌词面板）
 * - key 按行号重挂载，触发 fade-in 淡入（顺带修复两行相同歌词连播不重挂）
 * - 样式读 settingsStore.floatingLyrics：字体大小 / 换行行数上限 /
 *   背景透明度（color-mix 仅稀释背景色，文字保持清晰）；关闭时不渲染
 * - lines=1 且溢出时缓慢滚动整句：时长≈当前行歌词时长（限速 150px/s、
 *   上限 15s，无行时长兜底 40px/s），暂停时 animation-play-state 同步暂停；
 *   lines>1 维持 line-clamp 截断不滚动
 */
export default function LyricsBar() {
  const currentLyric = usePlayerStore((s) => s.currentLyric);
  const hide = usePlayerStore((s) => s.hide);
  const playing = usePlayerStore((s) => s.playing);
  const activeLyricIndex = usePlayerStore((s) => s.activeLyricIndex);
  const lyricLines = usePlayerStore((s) => s.lyricLines);
  const { enabled, fontSize, lines, opacity } = useSettingsStore(
    (s) => s.floatingLyrics,
  );
  const outerRef = useRef<HTMLDivElement>(null);
  const [scrollDist, setScrollDist] = useState(0);

  // 溢出量实测：换行/字号/行数变化后（key 重挂载后）重测，
  // 字体加载与窗口缩放经 ResizeObserver 复测（同 MarqueeText）
  useLayoutEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const check = () =>
      setScrollDist(Math.max(0, el.scrollWidth - el.clientWidth));
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [currentLyric, fontSize, lines]);

  if (!enabled || !hide || currentLyric === '') return null;

  // 当前行时长（LRC 末行 end 为 null → 走兜底速度）
  const line = lyricLines[activeLyricIndex];
  const lineDuration = line?.end != null ? line.end - line.start : null;

  const scrolling = lines === 1 && scrollDist > 0;
  const duration =
    lineDuration && lineDuration > 0
      ? Math.min(Math.max(lineDuration, scrollDist / MAX_SPEED), MAX_DURATION)
      : Math.min(scrollDist / FALLBACK_SPEED, MAX_DURATION);

  return (
    <div
      key={activeLyricIndex}
      role="status"
      style={{
        fontSize: `${fontSize}px`,
        backgroundColor: `color-mix(in srgb, var(--md-sys-color-surface-container-high) ${Math.round(opacity * 100)}%, transparent)`,
        ...(lines > 1 && {
          // 行数上限：line-clamp 截断超出行（1 行走滚动逻辑）
          display: '-webkit-box',
          WebkitBoxOrient: 'vertical',
          WebkitLineClamp: lines,
        }),
      }}
      className={`absolute inset-x-0 bottom-full mx-auto mb-2 w-max max-w-[min(90vw,560px)] rounded-full py-1.5 shadow-lg animate-[fade-in_0.3s_ease-out] ${
        scrolling ? 'flex px-3' : 'overflow-hidden px-4 text-center'
      }`}
    >
      {lines === 1 ? (
        /* 裁切/渐隐都在这层视口（无 padding），胶囊 px-3 保持实底；
           overflow 按 padding box 裁切，溢出内容会画进 padding，
           放同一层时 padding 挡不住碰边 */
        <div
          ref={outerRef}
          className={scrolling ? 'min-w-0 overflow-hidden' : 'min-w-0'}
          style={
            scrolling ? { maskImage: EDGE_FADE, WebkitMaskImage: EDGE_FADE } : undefined
          }
        >
          <span
            className="block w-max mx-auto whitespace-nowrap"
            style={
              scrolling
                ? ({
                    '--lyrics-scroll-dist': `${scrollDist}px`,
                    animationName: 'lyrics-scroll',
                    animationDuration: `${duration}s`,
                    animationTimingFunction: 'linear',
                    animationFillMode: 'forwards',
                    animationPlayState: playing ? 'running' : 'paused',
                  } as CSSProperties)
                : undefined
            }
          >
            {currentLyric}
          </span>
        </div>
      ) : (
        currentLyric
      )}
    </div>
  );
}

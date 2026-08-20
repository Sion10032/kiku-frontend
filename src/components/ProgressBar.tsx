import { useRef, useState } from 'react';
import { usePlayerStore } from '../stores/playerStore';
import { seekTo } from '../hooks/usePlayer';
import { formatDuration } from '../utils/format';

/**
 * 底栏进度条：h-1.5 轨道，hover/拖拽时加粗至 h-2.5；
 * 拖拽中仅预览位置，释放（pointerup）时才 seekTo(ratio * duration)；
 * hover 显示对应时间气泡。所有事件 stopPropagation 防止冒泡到展开热区。
 */
export default function ProgressBar() {
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const barRef = useRef<HTMLDivElement>(null);
  const [hoverRatio, setHoverRatio] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;
  // 拖拽/hover 时预览位置优先，否则显示实际播放进度
  const display = dragging || hoverRatio != null ? hoverRatio ?? progress : progress;

  const ratioFromEvent = (e: React.PointerEvent) => {
    const rect = barRef.current!.getBoundingClientRect();
    return Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
  };

  return (
    <div
      ref={barRef}
      role="slider"
      aria-label="播放进度"
      aria-valuemin={0}
      aria-valuemax={Math.floor(duration)}
      aria-valuenow={Math.floor(currentTime)}
      tabIndex={0}
      className="group/bar relative h-1.5 w-full min-w-0 cursor-pointer transition-[height] hover:h-2.5"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => {
        e.stopPropagation();
        setDragging(true);
        e.currentTarget.setPointerCapture(e.pointerId);
        // 拖拽中仅预览位置，释放时才 seek
        setHoverRatio(ratioFromEvent(e));
      }}
      onPointerMove={(e) => {
        if (dragging) {
          e.stopPropagation();
          setHoverRatio(ratioFromEvent(e));
        } else {
          setHoverRatio(ratioFromEvent(e));
        }
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        setDragging(false);
        e.currentTarget.releasePointerCapture(e.pointerId);
        // 释放时一次性 seek 到预览位置
        const ratio = ratioFromEvent(e);
        setHoverRatio(ratio);
        seekTo(ratio * duration);
      }}
      onPointerLeave={() => {
        if (!dragging) setHoverRatio(null);
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'ArrowLeft') {
          seekTo(currentTime - 5);
        } else if (e.key === 'ArrowRight') {
          seekTo(currentTime + 5);
        } else {
          return;
        }
        e.preventDefault();
      }}
    >
      {/* 轨道（填充整条热区，hover 时容器自身加粗） */}
      <div className="absolute inset-0 overflow-hidden bg-(--md-sys-color-surface-container-highest)">
        {/* 已播放 */}
        <div
          className="h-full bg-(--md-sys-color-primary)"
          style={{ width: `${display * 100}%` }}
        />
      </div>
      {/* hover 时间气泡 */}
      {hoverRatio != null && (
        <span
          className="pointer-events-none absolute top-0 -translate-x-1/2 rounded bg-(--md-sys-color-inverse-surface) px-1.5 py-0.5 text-[10px] tabular-nums text-(--md-sys-color-inverse-on-surface)"
          style={{ left: `${hoverRatio * 100}%` }}
        >
          {formatDuration(hoverRatio * duration)}
        </span>
      )}
    </div>
  );
}

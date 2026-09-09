import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { M3eIconButton } from '@m3e/react/icon-button';
import { M3eIcon } from '@m3e/react/icon';
import { M3eCircularProgressIndicator } from '@m3e/react/progress-indicator';
import '@m3e/icons/outlined/zoom_in';
import '@m3e/icons/outlined/zoom_out';
import '@m3e/icons/outlined/rotate_right';
import '@m3e/icons/outlined/fit_screen';
import '@m3e/icons/outlined/refresh';
import { streamUrl } from '../../api/media';
import type { PreviewerProps } from './types';
import { M3eCard } from '@m3e/react/card';

/** 缩放范围与步进（几何级 ×1.25）。 */
const MIN_SCALE = 0.2;
const MAX_SCALE = 8;
const SCALE_STEP = 1.25;

/**
 * 图片预览器：滚轮/按钮缩放、拖拽平移（放大时）、90° 旋转、
 * 双击 fit↔2x、重置视图。缩放旋转是瞬时交互态，不持久化。
 * 壳以 file.hash 为 key 重挂组件，翻页时状态天然重置。
 */
export function ImagePreview({ file }: PreviewerProps) {
  const { t } = useTranslation();
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [status, setStatus] = useState<'loading' | 'error' | 'done'>('loading');
  // 重试计数：拼进 img src 绕过失败缓存
  const [attempt, setAttempt] = useState(0);
  // 拖拽中是否禁用过渡（transition 渲染依赖，用 state 而非 ref）
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  // 拖拽基准点（pointermove 高频，ref 避免渲染依赖）
  const dragRef = useRef<{
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
  } | null>(null);

  const url = streamUrl(file.workId, file.hash);

  function reset() {
    setScale(1);
    setRotation(0);
    setOffset({ x: 0, y: 0 });
  }

  function zoomBy(factor: number) {
    setScale((s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s * factor)));
  }

  // 滚轮缩放需 preventDefault（non-passive），React onWheel 不保证，手动挂载
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      zoomBy(e.deltaY < 0 ? SCALE_STEP : 1 / SCALE_STEP);
    }
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (scale <= 1) return; // 未放大时无需平移
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      baseX: offset.x,
      baseY: offset.y,
    };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    setOffset({
      x: drag.baseX + e.clientX - drag.startX,
      y: drag.baseY + e.clientY - drag.startY,
    });
  }

  function onPointerUp() {
    dragRef.current = null;
    setDragging(false);
  }

  return (
    <div className='flex h-full min-h-0 flex-col'>
      {/* 画布 */}
      <M3eCard className='min-h-0 flex-1'>
        <div
          ref={containerRef}
          className='relative min-h-0 flex-1 overflow-hidden'
          style={{ cursor: scale > 1 ? 'grab' : 'default' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={() => (scale === 1 ? zoomBy(2) : reset())}
        >
          {status === 'loading' && (
            <div className='absolute inset-0 flex items-center justify-center'>
              <M3eCircularProgressIndicator />
            </div>
          )}
          {status === 'error' && (
            <div className='absolute inset-0 flex flex-col items-center justify-center gap-3 opacity-70'>
              <span>{t('works.preview.image-load-failed')}</span>
              <M3eIconButton
                aria-label={t('works.preview.retry')}
                onClick={() => {
                  reset();
                  setStatus('loading');
                  setAttempt((a) => a + 1);
                }}
              >
                <M3eIcon name='refresh' />
              </M3eIconButton>
            </div>
          )}
          <img
            src={`${url}${url.includes('?') ? '&' : '?'}_=${attempt}`}
            alt={file.title}
            draggable={false}
            className={
              status === 'done'
                ? 'absolute inset-0 m-auto max-h-full max-w-full select-none object-contain'
                : 'hidden'
            }
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale}) rotate(${rotation}deg)`,
              transformOrigin: 'center center',
              // 拖拽中禁用过渡，避免平移滞后；松手/缩放恢复平滑
              transition: dragging ? 'none' : 'transform 0.15s ease-out',
            }}
            onLoad={() => setStatus('done')}
            onError={() => setStatus('error')}
          />
        </div>
      </M3eCard>

      {/* 工具条 */}
      <div className='flex items-center gap-1 pt-2'>
        <M3eIconButton
          aria-label={t('works.preview.zoom-out')}
          onClick={() => zoomBy(1 / SCALE_STEP)}
        >
          <M3eIcon name='zoom_out' />
        </M3eIconButton>
        <span className='w-12 text-center text-xs tabular-nums opacity-60'>
          {Math.round(scale * 100)}%
        </span>
        <M3eIconButton
          aria-label={t('works.preview.zoom-in')}
          onClick={() => zoomBy(SCALE_STEP)}
        >
          <M3eIcon name='zoom_in' />
        </M3eIconButton>
        <M3eIconButton
          aria-label={t('works.preview.rotate-cw')}
          onClick={() => setRotation((r) => r + 90)}
        >
          <M3eIcon name='rotate_right' />
        </M3eIconButton>
        <M3eIconButton
          aria-label={t('works.preview.reset-view')}
          onClick={reset}
        >
          <M3eIcon name='fit_screen' />
        </M3eIconButton>
      </div>
    </div>
  );
}

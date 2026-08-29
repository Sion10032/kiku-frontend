import { useState } from 'react';
import clsx from 'clsx';
import { M3eIconButton } from '@m3e/react/icon-button';
import { M3eIcon } from '@m3e/react/icon';
import { M3eSlider, M3eSliderThumb } from '@m3e/react/slider';
import type { M3eSliderThumbElement } from '@m3e/react/slider';
import '@m3e/icons/outlined/play_arrow';
import '@m3e/icons/outlined/pause';
import '@m3e/icons/outlined/skip_previous';
import '@m3e/icons/outlined/skip_next';
import '@m3e/icons/outlined/queue_music';
import '@m3e/icons/outlined/music_note';
import '@m3e/icons/outlined/volume_up';
import '@m3e/icons/outlined/volume_off';
import { usePlayerStore, selectCurrentTrack } from '../../stores/playerStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { mediaUrl } from '../../api/client';
import { formatDuration, formatRemaining } from '../../utils/format';
import LyricsBar from './LyricsBar';
import MarqueeText from './MarqueeText';
import ProgressBar from './ProgressBar';
import QueueDialog from './QueueDialog';
import { PLAY_MODE_ICON, PLAY_MODE_LABEL } from '../../constants';

/** 包装 onClick：阻止冒泡到信息区展开热区后执行 action（M3e 组件回调为原生 Event）。 */
function stopAnd(fn: () => void) {
  return (e: Event) => {
    e.stopPropagation();
    fn();
  };
}

/**
 * 迷你播放条：常驻 MainLayout 底部（grid 第三行）。
 *
 * - 队列为空时渲染 null（对应 grid 行高度为 0）
 * - 信息区（封面/标题/作品名）整块点击 → toggleHide 展开全屏播放器
 * - 进度条可拖拽 seek；标题溢出 hover 跑马灯
 * - 宽屏：上一首/播放/下一首 + 播放模式/音量/播放列表/展开
 * - 窄屏（<md）：仅播放/暂停 + 播放列表
 * - 内部渲染 LyricsBar（悬浮于播放条上方的浮动歌词）
 */
export default function PlayerBar() {
  const track = usePlayerStore(selectCurrentTrack);
  const playing = usePlayerStore((s) => s.playing);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const playMode = usePlayerStore((s) => s.playMode);
  const togglePlaying = usePlayerStore((s) => s.togglePlaying);
  const previousTrack = usePlayerStore((s) => s.previousTrack);
  const nextTrack = usePlayerStore((s) => s.nextTrack);
  const changePlayMode = usePlayerStore((s) => s.changePlayMode);
  const toggleHide = usePlayerStore((s) => s.toggleHide);
  const timeDisplayMode = useSettingsStore((s) => s.timeDisplayMode);

  const [queueOpen, setQueueOpen] = useState(false);
  const [coverFailed, setCoverFailed] = useState(false);

  // 切曲后重置封面失败标记（渲染期调整 state，替代 effect 中 setState）
  const coverKey = track?.workId ?? track?.hash;
  const [prevCoverKey, setPrevCoverKey] = useState(coverKey);
  if (coverKey !== prevCoverKey) {
    setPrevCoverKey(coverKey);
    setCoverFailed(false);
  }

  if (!track) return null;

  return (
    <footer className='[grid-area:player] relative flex min-w-0 w-full flex-col border-t border-(--md-sys-color-outline-variant) bg-(--md-sys-color-surface-container)'>
      {/* 浮动歌词（悬浮于播放条上方，绝对定位） */}
      <LyricsBar />

      {/* ── 顶部：全宽进度条 ── */}
      <ProgressBar />

      {/* ── 主体：信息区 + 控制区 ── */}
      <div className='flex min-w-0 w-full items-center gap-3 px-4 py-2'>
        {/* ── 信息区：整块 = 展开热区（div 而非 button） ── */}
        <div
          role='button'
          tabIndex={0}
          aria-label='展开播放器'
          onClick={toggleHide}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.stopPropagation();
              toggleHide();
            }
          }}
          className='group flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left'
        >
          {/* 封面 48px：workId 缺失或加载失败用占位 */}
          {track.workId && !coverFailed ? (
            <img
              src={mediaUrl(`/api/cover/${track.workId}/file?type=sam`)}
              alt=''
              loading='lazy'
              onError={() => setCoverFailed(true)}
              className='h-12 w-12 shrink-0 rounded-md object-cover'
            />
          ) : (
            <span className='flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-(--md-sys-color-surface-container-high)'>
              <M3eIcon name='music_note' />
            </span>
          )}
          <div className='min-w-0 flex-1'>
            <MarqueeText text={track.title} className='text-sm font-medium' />
            <div className='truncate text-xs opacity-70'>{track.workTitle}</div>
          </div>
        </div>

        {/* ── 控制区 ── */}
        <div className='flex shrink-0 items-center'>
          {/* 时间 */}
          <span className='mr-1 shrink-0 text-xs tabular-nums opacity-70'>
            {formatDuration(currentTime)} /{' '}
            {timeDisplayMode === 'remaining'
              ? formatRemaining(currentTime, duration)
              : formatDuration(duration)}
          </span>
          {/* 核心组：窄屏保留 ▶/⏸ + ☰，其余 md: 起显示 */}
          <M3eIconButton
            className='hidden md:inline-flex'
            aria-label='上一首'
            onClick={stopAnd(previousTrack)}
          >
            <M3eIcon name='skip_previous' />
          </M3eIconButton>
          <M3eIconButton
            aria-label={playing ? '暂停' : '播放'}
            onClick={stopAnd(togglePlaying)}
          >
            <M3eIcon name={playing ? 'pause' : 'play_arrow'} />
          </M3eIconButton>
          <M3eIconButton
            className='hidden md:inline-flex'
            aria-label='下一首'
            onClick={stopAnd(nextTrack)}
          >
            <M3eIcon name='skip_next' />
          </M3eIconButton>

          <span className='mx-1 hidden h-6 w-px bg-(--md-sys-color-outline-variant) md:block' />

          {/* 次要组：全部 md: 起显示 */}
          <M3eIconButton
            className='hidden md:inline-flex'
            aria-label={`播放模式：${PLAY_MODE_LABEL[playMode]}`}
            onClick={stopAnd(changePlayMode)}
          >
            <M3eIcon name={PLAY_MODE_ICON[playMode]} />
          </M3eIconButton>
          <VolumeControl className='hidden md:block' />
          <M3eIconButton
            aria-label='播放列表'
            onClick={stopAnd(() => setQueueOpen(true))}
          >
            <M3eIcon name='queue_music' />
          </M3eIconButton>
        </div>
      </div>

      <QueueDialog open={queueOpen} onClose={() => setQueueOpen(false)} />
    </footer>
  );
}

/**
 * 音量按钮：点击静音；悬停于上方弹出横向滑条（纯 CSS group-hover）。
 */
function VolumeControl({ className = '' }: { className?: string }) {
  const volume = usePlayerStore((s) => s.volume);
  const muted = usePlayerStore((s) => s.muted);
  const toggleMuted = usePlayerStore((s) => s.toggleMuted);
  const setVolume = usePlayerStore((s) => s.setVolume);

  /** 音量拖动：thumb 为 0–100，写回 0–1。 */
  function handleVolume(e: Event) {
    const value = (e.target as M3eSliderThumbElement).value;
    if (value != null) setVolume(value / 100);
  }

  return (
    <div className={clsx('group/vol relative', className)}>
      <M3eIconButton
        aria-label={muted ? '取消静音' : '静音'}
        onClick={(e) => {
          e.stopPropagation();
          toggleMuted();
        }}
      >
        <M3eIcon name={muted || volume === 0 ? 'volume_off' : 'volume_up'} />
      </M3eIconButton>
      <div
        className='pointer-events-none absolute bottom-full right-[-50px] z-50 mb-1 rounded-full bg-(--md-sys-color-surface-container-high) px-4 py-2 opacity-0 shadow-lg transition-opacity group-hover/vol:pointer-events-auto group-hover/vol:opacity-100'
        onClick={(e) => e.stopPropagation()}
      >
        <M3eSlider
          min={0}
          max={100}
          step={1}
          onInput={handleVolume}
          className='w-28'
        >
          <M3eSliderThumb value={Math.round(volume * 100)} />
        </M3eSlider>
      </div>
    </div>
  );
}

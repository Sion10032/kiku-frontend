import { useState } from 'react';
import clsx from 'clsx';
import { M3eIconButton } from '@m3e/react/icon-button';
import { M3eIcon } from '@m3e/react/icon';
import { M3eSlider, M3eSliderThumb } from '@m3e/react/slider';
import type { M3eSliderThumbElement } from '@m3e/react/slider';
import '@m3e/icons/outlined/keyboard_arrow_down';
import '@m3e/icons/outlined/queue_music';
import '@m3e/icons/outlined/bedtime';
import '@m3e/icons/outlined/fast_rewind';
import '@m3e/icons/outlined/fast_forward';
import '@m3e/icons/outlined/skip_previous';
import '@m3e/icons/outlined/skip_next';
import '@m3e/icons/outlined/play_arrow';
import '@m3e/icons/outlined/pause';
import '@m3e/icons/outlined/playlist_play';
import '@m3e/icons/outlined/repeat';
import '@m3e/icons/outlined/repeat_one';
import '@m3e/icons/outlined/shuffle';
import '@m3e/icons/outlined/volume_up';
import '@m3e/icons/outlined/volume_off';
import '@m3e/icons/outlined/music_note';
import SleepMode from './SleepMode';
import LyricsPanel from './LyricsPanel';
import QueueDialog from './QueueDialog';
import { PLAY_MODE_ICON, PLAY_MODE_LABEL } from '../../constants';
import { usePlayerStore, selectCurrentTrack } from '../../stores/playerStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { mediaUrl } from '../../api/client';
import { seekTo } from '../../hooks/usePlayer';
import { formatDuration, formatRemaining } from '../../utils/format';

/**
 * 全屏播放器覆盖层：hide=false 时显示。
 *
 * - 顶栏仅折叠按钮；底部控制区自上而下：进度条（M3eSlider，拖动实时
 *   seek）、传输控制（快退/上一首/播放/下一首/快进）、辅助开关
 *   （播放模式/播放列表/睡眠定时）、音量滑块 + 静音
 * - 中部宽屏封面/歌词双栏自动显示；窄屏点击封面↔点歌词空白处切换
 *   （交叉淡化 300ms）；歌词行两段式点击确认 seek（见 LyricsPanel）
 * - 窄屏（<640px）覆盖 M3E 按钮 token 缩小尺寸，防止控制行溢出
 * - 播放列表对话框（dnd-kit 拖拽排序）、睡眠定时器
 */
export default function AudioPlayer() {
  const hide = usePlayerStore((s) => s.hide);
  const currentUid = usePlayerStore((s) => s.currentUid);
  const track = usePlayerStore(selectCurrentTrack);
  const playing = usePlayerStore((s) => s.playing);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const playMode = usePlayerStore((s) => s.playMode);
  const volume = usePlayerStore((s) => s.volume);
  const muted = usePlayerStore((s) => s.muted);
  const rewindSeekTime = usePlayerStore((s) => s.rewindSeekTime);
  const forwardSeekTime = usePlayerStore((s) => s.forwardSeekTime);
  const togglePlaying = usePlayerStore((s) => s.togglePlaying);
  const previousTrack = usePlayerStore((s) => s.previousTrack);
  const nextTrack = usePlayerStore((s) => s.nextTrack);
  const changePlayMode = usePlayerStore((s) => s.changePlayMode);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const toggleMuted = usePlayerStore((s) => s.toggleMuted);
  const triggerRewind = usePlayerStore((s) => s.triggerRewind);
  const triggerForward = usePlayerStore((s) => s.triggerForward);
  const toggleHide = usePlayerStore((s) => s.toggleHide);
  const lyricLines = usePlayerStore((s) => s.lyricLines);
  const timeDisplayMode = useSettingsStore((s) => s.timeDisplayMode);

  const [queueOpen, setQueueOpen] = useState(false);
  const [sleepOpen, setSleepOpen] = useState(false);
  /** 窄屏歌词视图（宽屏双栏常显，状态无效）；切曲自动回封面视图 */
  const [showLyrics, setShowLyrics] = useState(false);
  // 切曲时重置窄屏歌词视图（渲染期调整 state，替代 effect 中 setState）
  const [prevUid, setPrevUid] = useState(currentUid);
  if (currentUid !== prevUid) {
    setPrevUid(currentUid);
    setShowLyrics(false);
  }

  if (hide || !track) return null;

  const hasLyrics = lyricLines.length > 0;

  /** 进度条拖动：thumb 值实时写回（seekTo 内部 clamp）。 */
  function handleSeek(e: Event) {
    const value = (e.target as M3eSliderThumbElement).value;
    if (value != null) seekTo(value);
  }

  /** 音量拖动：thumb 为 0–100，写回 0–1。 */
  function handleVolume(e: Event) {
    const value = (e.target as M3eSliderThumbElement).value;
    if (value != null) setVolume(value / 100);
  }

  return (
    <div className='fixed inset-0 z-40 flex flex-col bg-(--md-sys-color-surface)'>
      {/* 顶栏：仅折叠（播放列表/睡眠定时移至底部辅助行） */}
      <div className='flex items-center p-4'>
        <M3eIconButton aria-label='折叠播放器' onClick={toggleHide}>
          <M3eIcon name='keyboard_arrow_down' />
        </M3eIconButton>
      </div>

      {/* 中部：宽屏封面/歌词左右双栏自动显示；窄屏两视图绝对定位叠放，
          opacity 交叉淡化切换（点封面→歌词，点歌词空白→封面；
          无歌词时仅封面） */}
      <div className='relative flex min-h-0 flex-1 gap-4 overflow-hidden lg:flex-row lg:items-stretch lg:px-6'>
        {/* 封面 + 曲目信息：窄屏为查看歌词热区（有歌词时整块可点） */}
        <div
          role={hasLyrics ? 'button' : undefined}
          tabIndex={hasLyrics ? 0 : undefined}
          aria-label={hasLyrics ? '查看歌词' : undefined}
          onClick={hasLyrics ? () => setShowLyrics(true) : undefined}
          onKeyDown={
            hasLyrics
              ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setShowLyrics(true);
                  }
                }
              : undefined
          }
          className={clsx(
            'flex flex-col items-center justify-center gap-4 overflow-y-auto transition-opacity duration-300',
            'max-lg:absolute max-lg:inset-0 max-lg:px-6 max-lg:pb-6 lg:flex-1',
            showLyrics
              ? 'max-lg:pointer-events-none max-lg:opacity-0'
              : 'max-lg:opacity-100',
          )}
        >
          {track.workId ? (
            <img
              src={mediaUrl(`/api/cover/${track.workId}/file`)}
              alt={track.workTitle}
              className='max-h-[38vh] w-auto max-w-[min(80vw,420px)] rounded-2xl object-contain lg:max-h-[60vh]'
            />
          ) : (
            <div className='flex aspect-square w-[min(50vw,240px)] items-center justify-center rounded-2xl bg-(--md-sys-color-surface-container) text-(--md-sys-color-on-surface-variant)'>
              <M3eIcon name='music_note' />
            </div>
          )}
          <div className='max-w-full text-center'>
            <h2 className='truncate text-xl font-medium'>{track.title}</h2>
            <p className='mt-1 text-sm opacity-70'>{track.workTitle}</p>
          </div>
        </div>

        {/* 歌词面板：宽屏常驻（无歌词时隐藏）；窄屏点空白处返回封面 */}
        <div
          onClick={() => setShowLyrics(false)}
          className={clsx(
            'flex min-h-0 flex-col transition-opacity duration-300',
            'max-lg:absolute max-lg:inset-0 max-lg:px-6 max-lg:pt-8 max-lg:pb-6',
            'lg:flex-1 lg:py-8',
            showLyrics && hasLyrics
              ? 'max-lg:opacity-100'
              : 'max-lg:pointer-events-none max-lg:opacity-0',
            hasLyrics ? 'lg:flex' : 'lg:hidden',
          )}
        >
          <LyricsPanel />
        </div>
      </div>

      {/* 底部：进度条 + 控制区（不随歌词滚动）；窄屏覆盖按钮 token 缩为
          medium 40px，宽度经 leading/trailing space 保持方形 */}
      <div className='flex shrink-0 flex-col items-center gap-2 p-4 max-sm:[--m3e-icon-button-medium-container-height:2.5rem] max-sm:[--m3e-icon-button-medium-default-leading-space:0.5rem] max-sm:[--m3e-icon-button-medium-default-trailing-space:0.5rem]'>
        <div className='flex w-full max-w-xl items-center gap-3'>
          <span className='shrink-0 text-xs tabular-nums opacity-70'>
            {formatDuration(currentTime)}
          </span>
          <M3eSlider
            min={0}
            max={Math.max(1, Math.floor(duration))}
            step={1}
            onInput={handleSeek}
            className='min-w-0 flex-1'
          >
            <M3eSliderThumb value={Math.floor(currentTime)} />
          </M3eSlider>
          <span className='shrink-0 text-xs tabular-nums opacity-70'>
            {timeDisplayMode === 'remaining'
              ? formatRemaining(currentTime, duration)
              : formatDuration(duration)}
          </span>
        </div>

        {/* 传输控制 */}
        <div className='flex items-center gap-2'>
          {/* ⏪⏩ glyph 天生比 ⏮⏭ 宽 ~50%（808/753 vs 520 网格），
              scale 2/3 拉齐视觉宽度（盒尺寸不变） */}
          <M3eIconButton
            className='[&>m3e-icon]:scale-2/3'
            aria-label={`快退 ${rewindSeekTime} 秒`}
            onClick={triggerRewind}
          >
            <M3eIcon name='fast_rewind' />
          </M3eIconButton>
          <M3eIconButton aria-label='上一首' onClick={previousTrack}>
            <M3eIcon name='skip_previous' />
          </M3eIconButton>
          <M3eIconButton
            variant='filled'
            aria-label={playing ? '暂停' : '播放'}
            onClick={togglePlaying}
            size='medium'
          >
            <M3eIcon name={playing ? 'pause' : 'play_arrow'} />
          </M3eIconButton>
          <M3eIconButton aria-label='下一首' onClick={nextTrack}>
            <M3eIcon name='skip_next' />
          </M3eIconButton>
          <M3eIconButton
            className='[&>m3e-icon]:scale-2/3'
            aria-label={`快进 ${forwardSeekTime} 秒`}
            onClick={triggerForward}
          >
            <M3eIcon name='fast_forward' />
          </M3eIconButton>
        </div>

        {/* 辅助开关：播放模式 / 播放列表 / 睡眠定时 */}
        <div className='flex items-center gap-4'>
          <M3eIconButton
            aria-label={`播放模式：${PLAY_MODE_LABEL[playMode]}`}
            onClick={changePlayMode}
          >
            <M3eIcon name={PLAY_MODE_ICON[playMode]} />
          </M3eIconButton>
          <M3eIconButton
            aria-label='播放列表'
            onClick={() => setQueueOpen(true)}
          >
            <M3eIcon name='queue_music' />
          </M3eIconButton>
          <M3eIconButton
            aria-label='睡眠定时器'
            onClick={() => setSleepOpen(true)}
          >
            <M3eIcon name='bedtime' />
          </M3eIconButton>
        </div>

        {/* 音量 */}
        <div className='flex w-full max-w-sm items-center gap-3'>
          <M3eIconButton
            aria-label={muted ? '取消静音' : '静音'}
            onClick={toggleMuted}
          >
            <M3eIcon
              name={muted || volume === 0 ? 'volume_off' : 'volume_up'}
            />
          </M3eIconButton>
          <M3eSlider
            min={0}
            max={100}
            step={1}
            onInput={handleVolume}
            className='min-w-0 flex-1'
          >
            <M3eSliderThumb value={Math.round(volume * 100)} />
          </M3eSlider>
        </div>
      </div>

      {/* 播放列表（dnd-kit 拖拽排序） */}
      <QueueDialog open={queueOpen} onClose={() => setQueueOpen(false)} />

      {/* 睡眠定时器 */}
      <SleepMode open={sleepOpen} onClose={() => setSleepOpen(false)} />
    </div>
  );
}

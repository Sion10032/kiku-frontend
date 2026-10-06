import { useState } from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { M3eSwipeGesture } from '@m3e/react/gestures';
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
import GainIndicator from './GainIndicator';
import QueueDialog from './QueueDialog';
import VideoSurface from './VideoSurface';
import './AudioPlayer.css';
import { PLAY_MODE_ICON, PLAY_MODE_LABEL } from '../../constants';
import { usePlayerStore, selectCurrentTrack } from '../../stores/playerStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { mediaUrl } from '../../api/client';
import { seekTo } from '../../hooks/usePlayer';
import { useSwipeHide } from '../../hooks/useSwipeHide';
import { formatDuration, formatRemaining } from '../../utils/format';
import { isVideoTrack } from '../../utils/track';

/**
 * 全屏播放器覆盖层：hide=false 时显示。
 *
 * - 顶栏仅折叠按钮；底部控制区自上而下：进度条（M3eSlider，拖动实时
 *   seek）、传输控制（快退/上一首/播放/下一首/快进）、辅助开关
 *   （播放模式/播放列表/睡眠定时）、音量滑块 + 静音
 * - 中部宽屏封面/歌词双栏自动显示；窄屏点击封面↔歌词非中心行/空白
 *   处切换（交叉淡化 300ms）；歌词仅中心行可点击 seek（见 LyricsPanel）
 * - 窄屏（<640px）覆盖 M3E 按钮 token 缩小尺寸，防止控制行溢出
 * - 封面区块下滑快扫收起播放器（useSwipeHide + m3e-swipe-gesture）
 * - 播放列表对话框（dnd-kit 拖拽排序）、睡眠定时器
 * - 首挂载自底部滑入；hide 时滑回底部但不卸载（translate 过渡 + inert）
 */
export default function AudioPlayer() {
  const { t } = useTranslation();
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
  const videoActive = usePlayerStore((s) => s.videoActive);
  const timeDisplayMode = useSettingsStore((s) => s.timeDisplayMode);

  const [queueOpen, setQueueOpen] = useState(false);
  const [sleepOpen, setSleepOpen] = useState(false);
  // 封面下滑收起 + 尾随 click 抑制（共享逻辑见 useSwipeHide）
  const { handleGesture: handleSwipeGesture, swallowSwipeClick } =
    useSwipeHide('down');
  /** 窄屏歌词视图（宽屏双栏常显，状态无效）；切曲自动回封面视图 */
  const [showLyrics, setShowLyrics] = useState(false);
  // 切曲时重置窄屏歌词视图（渲染期调整 state，替代 effect 中 setState）
  const [prevUid, setPrevUid] = useState(currentUid);
  if (currentUid !== prevUid) {
    setPrevUid(currentUid);
    setShowLyrics(false);
  }

  if (!track) return null;

  // 视频曲目：歌词整体不参与（所有播放模式下均如此——面板不显示、
  // 窄屏入口禁用）；画面层按 videoActive 渲染（usePlayer 按视频模式
  // 分流后写入，切曲生效——当前曲目不因设置变更重建后端）
  const isVideo = isVideoTrack(track);
  const hasLyrics = lyricLines.length > 0 && !isVideo;

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
    // 首挂载 animate-player-in 自底部滑入；hide 仅切换位移类（不卸载），
    // 展开/折叠为 translate-y 过渡；inert 保证隐藏期不可聚焦/交互
    <div
      inert={hide || undefined}
      className={clsx(
        'fixed inset-0 z-40 flex flex-col bg-(--md-sys-color-surface)',
        'animate-[player-in_300ms_cubic-bezier(0.2,0,0,1)]',
        'transition-transform duration-300 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none motion-reduce:animate-none',
        hide ? 'translate-y-full' : 'translate-y-0',
      )}
    >
      {/* 顶栏：仅折叠（播放列表/睡眠定时移至底部辅助行） */}
      <div className='flex items-center p-4'>
        <M3eIconButton aria-label={t('player.collapse')} onClick={toggleHide}>
          <M3eIcon name='keyboard_arrow_down' />
        </M3eIconButton>
      </div>

      {/* 中部：默认（<lg）封面/歌词两视图绝对定位叠放，opacity 交叉淡化
          切换（点封面→歌词，点歌词空白→封面；无歌词时仅封面）；
          ≥lg 恢复左右双栏常驻 */}
      <div className='relative flex min-h-0 flex-1 gap-4 overflow-hidden lg:flex-row lg:items-stretch lg:px-6'>
        {/* 封面 + 曲目信息：窄屏为查看歌词热区（有歌词时整块可点）
            touch-none：阻止浏览器把下滑当作页面滚动（pointercancel 打断
            手势识别并触发下拉刷新）；代价是本块自身 overflow-y-auto 滚动
            失效（内容极少溢出，可接受）；固定 id 供下滑手势的 for 绑定
            （querySelector 解析，不能用 useId） */}
        <div
          id='player-cover'
          role={hasLyrics ? 'button' : undefined}
          tabIndex={hasLyrics ? 0 : undefined}
          aria-label={hasLyrics ? t('player.show-lyrics') : undefined}
          onClick={swallowSwipeClick(() => {
            if (hasLyrics) setShowLyrics(true);
          })}
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
            // 窄屏叠放层：绝对定位 + 交叉淡化；≥lg 恢复正常流双栏
            'absolute inset-0 flex flex-col items-center justify-center gap-4 overflow-y-auto px-6 pb-6 transition-opacity duration-300 touch-none',
            'lg:static lg:flex-1 lg:px-0 lg:pb-0',
            showLyrics
              ? 'pointer-events-none opacity-0 lg:pointer-events-auto lg:opacity-100'
              : 'opacity-100',
          )}
        >
          {/* 封面/视频：占标题以外全部高度（min-h-0 允许收缩） */}
          <div className='flex min-h-0 w-full flex-1 items-center justify-center'>
            {videoActive ? (
              <VideoSurface workId={track.workId} />
            ) : track.workId ? (
              <img
                src={mediaUrl(`/api/cover/${track.workId}/file`)}
                alt={track.workTitle}
                className='max-h-full max-w-full rounded-2xl object-contain'
              />
            ) : (
              <div className='flex aspect-square w-[min(50vw,240px)] items-center justify-center rounded-2xl bg-(--md-sys-color-surface-container) text-(--md-sys-color-on-surface-variant)'>
                <M3eIcon name='music_note' />
              </div>
            )}
          </div>
          <div className='max-w-full text-center'>
            <h2 className='truncate text-xl font-medium'>{track.title}</h2>
            <p className='mt-1 text-sm opacity-70'>{track.workTitle}</p>
          </div>
        </div>

        {/* 封面下滑快扫识别（non-visual 元素，仅限 down 方向；
            end 时收起播放器，与点按看歌词靠位移阈值区分；htmlFor 写入 for attribute） */}
        <M3eSwipeGesture
          htmlFor='player-cover'
          directions={['down']}
          onGesture={handleSwipeGesture}
        />

        {/* 歌词面板：宽屏常驻（无歌词时隐藏）；窄屏点非中心行/空白处
            返回封面（中心行点击为 seek，见 LyricsPanel） */}
        <div
          onClick={() => setShowLyrics(false)}
          className={clsx(
            // 窄屏叠放层：绝对定位 + 交叉淡化；≥lg 恢复正常流双栏常驻
            'absolute inset-0 flex min-h-0 flex-col px-6 pt-8 pb-6 transition-opacity duration-300',
            'lg:static lg:flex-1 lg:px-0 lg:py-8',
            showLyrics && hasLyrics
              ? 'opacity-100'
              : 'pointer-events-none opacity-0 lg:pointer-events-auto lg:opacity-100',
            hasLyrics ? 'lg:flex' : 'lg:hidden',
          )}
        >
          <LyricsPanel />
        </div>
      </div>

      {/* 底部：进度条 + 控制区（不随歌词滚动）；窄屏覆盖按钮 token 缩为
          medium 40px，宽度经 leading/trailing space 保持方形 */}
      <div className='flex shrink-0 flex-col items-center gap-3 p-4 max-sm:[--m3e-icon-button-medium-container-height:2.5rem] max-sm:[--m3e-icon-button-medium-default-leading-space:0.5rem] max-sm:[--m3e-icon-button-medium-default-trailing-space:0.5rem]'>
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
          <M3eIconButton
            aria-label={t('player.previous-track')}
            onClick={previousTrack}
          >
            <M3eIcon name='skip_previous' />
          </M3eIconButton>
          <M3eIconButton
            aria-label={t('player.rewind', { count: rewindSeekTime })}
            onClick={triggerRewind}
          >
            <M3eIcon name='fast_rewind' />
          </M3eIconButton>
          <M3eIconButton
            className='zoom-150'
            variant='filled'
            aria-label={playing ? t('player.pause') : t('player.play')}
            onClick={togglePlaying}
          >
            <M3eIcon name={playing ? 'pause' : 'play_arrow'} />
          </M3eIconButton>
          <M3eIconButton
            aria-label={t('player.forward', { count: forwardSeekTime })}
            onClick={triggerForward}
          >
            <M3eIcon name='fast_forward' />
          </M3eIconButton>
          <M3eIconButton
            aria-label={t('player.next-track')}
            onClick={nextTrack}
          >
            <M3eIcon name='skip_next' />
          </M3eIconButton>
        </div>

        {/* 辅助开关：播放模式 / 播放列表 / 睡眠定时 */}
        <div className='flex items-center gap-4'>
          <M3eIconButton
            aria-label={t('player.play-mode', {
              mode: t(PLAY_MODE_LABEL[playMode]),
            })}
            onClick={changePlayMode}
          >
            <M3eIcon name={PLAY_MODE_ICON[playMode]} />
          </M3eIconButton>
          <M3eIconButton
            aria-label={t('player.queue')}
            onClick={() => setQueueOpen(true)}
          >
            <M3eIcon name='queue_music' />
          </M3eIconButton>
          <M3eIconButton
            aria-label={t('player.sleep-timer')}
            onClick={() => setSleepOpen(true)}
          >
            <M3eIcon name='bedtime' />
          </M3eIconButton>
        </div>

        {/* 音量 */}
        <div className='flex w-full max-w-sm items-center gap-3'>
          <M3eIconButton
            aria-label={muted ? t('player.unmute') : t('player.mute')}
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
          <span
            aria-hidden='true'
            className='w-(--m3e-icon-button-medium-container-height) shrink-0 text-center text-xs tabular-nums opacity-70'
          >
            {Math.round(volume * 100)}%
          </span>
          {/* 当前均衡增益（仅均衡开启且≠0 时显示） */}
          <GainIndicator className='shrink-0' />
        </div>
      </div>

      {/* 播放列表（dnd-kit 拖拽排序） */}
      <QueueDialog open={queueOpen} onClose={() => setQueueOpen(false)} />

      {/* 睡眠定时器 */}
      <SleepMode open={sleepOpen} onClose={() => setSleepOpen(false)} />
    </div>
  );
}

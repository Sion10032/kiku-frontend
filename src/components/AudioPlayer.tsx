import { useState } from 'react';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { M3eDialog } from '@m3e/react/dialog';
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
import '@m3e/icons/outlined/drag_indicator';
import '@m3e/icons/outlined/lyrics';
import SleepMode from './SleepMode';
import LyricsPanel from './LyricsPanel';
import { usePlayerStore, type PlayMode, type Track } from '../stores/playerStore';
import { mediaUrl } from '../api/client';
import { seekTo } from '../hooks/usePlayer';
import { formatDuration } from '../utils/format';

/** 播放模式 → 图标名。 */
const PLAY_MODE_ICON: Record<PlayMode, string> = {
  order: 'playlist_play',
  allRepeat: 'repeat',
  repeatOne: 'repeat_one',
  shuffle: 'shuffle',
};

/** 播放模式 → 中文名（aria-label / 提示用）。 */
const PLAY_MODE_LABEL: Record<PlayMode, string> = {
  order: '顺序播放',
  allRepeat: '列表循环',
  repeatOne: '单曲循环',
  shuffle: '随机播放',
};

/**
 * 全屏播放器覆盖层：hide=false 时显示。
 *
 * - 大封面（track.workId 缺失用占位）、标题/作品名
 * - 进度条（M3eSlider，拖动实时 seek）、播放控制、播放模式切换
 * - 快退/快进（triggerRewind/triggerForward toggle 值）
 * - 音量滑块 + 静音、播放列表对话框（dnd-kit 拖拽排序）、睡眠定时器
 */
export default function AudioPlayer() {
  const hide = usePlayerStore((s) => s.hide);
  const queue = usePlayerStore((s) => s.queue);
  const queueIndex = usePlayerStore((s) => s.queueIndex);
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

  const [queueOpen, setQueueOpen] = useState(false);
  const [sleepOpen, setSleepOpen] = useState(false);
  const [lyricsOpen, setLyricsOpen] = useState(true);

  if (hide || queue.length === 0) return null;

  const track = queue[queueIndex];

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
    <div className="fixed inset-0 z-40 flex flex-col bg-(--md-sys-color-surface)">
      {/* 顶栏：折叠 + 播放列表 / 睡眠定时 */}
      <div className="flex items-center justify-between p-4">
        <M3eIconButton aria-label="折叠播放器" onClick={toggleHide}>
          <M3eIcon name="keyboard_arrow_down" />
        </M3eIconButton>
        <div className="flex items-center">
          <M3eIconButton
            aria-label="播放列表"
            onClick={() => setQueueOpen(true)}
          >
            <M3eIcon name="queue_music" />
          </M3eIconButton>
          <M3eIconButton
            aria-label="睡眠定时器"
            onClick={() => setSleepOpen(true)}
          >
            <M3eIcon name="bedtime" />
          </M3eIconButton>
        </div>
      </div>

      {/* 中部：封面/曲目信息 与 歌词（宽屏左右双栏；窄屏展开歌词时隐藏封面） */}
      {lyricsOpen && (
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-6 lg:flex-row lg:items-stretch">
          {/* 封面 + 曲目信息（窄屏展开歌词时隐藏） */}
          <div className="flex hidden shrink-0 flex-col items-center justify-center gap-4 lg:flex lg:flex-1">
            {track.workId ? (
              <img
                src={mediaUrl(`/api/cover/${track.workId}/file`)}
                alt={track.workTitle}
                className="max-h-[30vh] w-auto max-w-[min(80vw,360px)] rounded-2xl object-contain lg:max-h-[60vh]"
              />
            ) : (
              <div className="flex aspect-square w-[min(50vw,240px)] items-center justify-center rounded-2xl bg-(--md-sys-color-surface-container) text-(--md-sys-color-on-surface-variant)">
                <M3eIcon name="music_note" />
              </div>
            )}

            <div className="max-w-full text-center">
              <h2 className="truncate text-xl font-medium">{track.title}</h2>
              <p className="mt-1 text-sm opacity-70">{track.workTitle}</p>
            </div>
          </div>

          {/* 歌词面板（窄屏限高，避免挢压控制区） */}
          <div className="flex min-h-0 flex-col py-8 lg:flex-1">
            {lyricLines.length > 0 ? (
              <LyricsPanel />
            ) : (
              <div className="flex h-full min-h-24 items-center justify-center text-sm text-(--md-sys-color-on-surface-variant)">
                当前曲目无歌词
              </div>
            )}
          </div>
        </div>
      )}

      {/* 折叠态：仅封面 + 曲目信息 */}
      {!lyricsOpen && (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 overflow-y-auto px-6 pb-6">
          {track.workId ? (
            <img
              src={mediaUrl(`/api/cover/${track.workId}/file`)}
              alt={track.workTitle}
              className="max-h-[38vh] w-auto max-w-[min(80vw,420px)] rounded-2xl object-contain"
            />
          ) : (
            <div className="flex aspect-square w-[min(50vw,240px)] items-center justify-center rounded-2xl bg-(--md-sys-color-surface-container) text-(--md-sys-color-on-surface-variant)">
              <M3eIcon name="music_note" />
            </div>
          )}
          <div className="max-w-full text-center">
            <h2 className="truncate text-xl font-medium">{track.title}</h2>
            <p className="mt-1 text-sm opacity-70">{track.workTitle}</p>
          </div>
        </div>
      )}

      {/* 底部：进度条 + 控制区（不随歌词滚动） */}
      <div className="flex shrink-0 flex-col items-center gap-6 px-6 pb-6">
        <div className="flex w-full max-w-xl items-center gap-3">
          <span className="shrink-0 text-xs tabular-nums opacity-70">
            {formatDuration(currentTime)}
          </span>
          <M3eSlider
            min={0}
            max={Math.max(1, Math.floor(duration))}
            step={1}
            onInput={handleSeek}
            className="min-w-0 flex-1"
          >
            <M3eSliderThumb value={Math.floor(currentTime)} />
          </M3eSlider>
          <span className="shrink-0 text-xs tabular-nums opacity-70">
            {formatDuration(duration)}
          </span>
        </div>

        {/* 播放控制 */}
        <div className="flex items-center gap-2">
          <M3eIconButton
            aria-label={`播放模式：${PLAY_MODE_LABEL[playMode]}`}
            onClick={changePlayMode}
          >
            <M3eIcon name={PLAY_MODE_ICON[playMode]} />
          </M3eIconButton>
          <M3eIconButton
            aria-label={`快退 ${rewindSeekTime} 秒`}
            onClick={triggerRewind}
          >
            <M3eIcon name="fast_rewind" />
          </M3eIconButton>
          <M3eIconButton aria-label="上一首" onClick={previousTrack}>
            <M3eIcon name="skip_previous" />
          </M3eIconButton>
          <M3eIconButton
            variant="filled"
            size="large"
            aria-label={playing ? '暂停' : '播放'}
            onClick={togglePlaying}
          >
            <M3eIcon name={playing ? 'pause' : 'play_arrow'} />
          </M3eIconButton>
          <M3eIconButton aria-label="下一首" onClick={nextTrack}>
            <M3eIcon name="skip_next" />
          </M3eIconButton>
          <M3eIconButton
            aria-label={`快进 ${forwardSeekTime} 秒`}
            onClick={triggerForward}
          >
            <M3eIcon name="fast_forward" />
          </M3eIconButton>
          <M3eIconButton
            aria-label={lyricsOpen ? '隐藏歌词' : '显示歌词'}
            disabled={lyricLines.length === 0}
            onClick={() => setLyricsOpen((v) => !v)}
          >
            <M3eIcon name="lyrics" />
          </M3eIconButton>
        </div>

        {/* 音量 */}
        <div className="flex w-full max-w-sm items-center gap-3">
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
            className="min-w-0 flex-1"
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

/**
 * 播放列表对话框：列出队列、当前曲目高亮、点击切曲、拖拽排序。
 */
function QueueDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queue = usePlayerStore((s) => s.queue);
  const queueIndex = usePlayerStore((s) => s.queueIndex);
  const setQueue = usePlayerStore((s) => s.setQueue);

  const sensors = useSensors(
    // 5px 拖动阈值，避免点击切曲被误判为拖拽
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (over == null || active.id === over.id) return;
    const oldIndex = Number(active.id);
    const newIndex = Number(over.id);
    if (
      Number.isNaN(oldIndex) ||
      Number.isNaN(newIndex) ||
      oldIndex === newIndex
    ) {
      return;
    }
    const nextQueue = arrayMove(queue, oldIndex, newIndex);
    // 修正当前播放索引：被拖的是当前曲 → 跟随；跨过当前曲 → 相应 ±1
    let nextIndex = queueIndex;
    if (oldIndex === queueIndex) nextIndex = newIndex;
    else if (oldIndex < queueIndex && newIndex > queueIndex)
      nextIndex = queueIndex - 1;
    else if (oldIndex > queueIndex && newIndex < queueIndex)
      nextIndex = queueIndex + 1;
    // store 无队列重排 action，整表写回（不改 store 文件）
    usePlayerStore.setState({ queue: nextQueue, queueIndex: nextIndex });
  }

  return (
    <M3eDialog open={open} onClosed={onClose} dismissible closeLabel="关闭">
      <span slot="header">播放列表（{queue.length}）</span>

      <div className="max-h-[60vh] overflow-y-auto">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={queue.map((_, i) => i)}
            strategy={verticalListSortingStrategy}
          >
            {queue.map((track, index) => (
              <QueueRow
                key={`${track.hash}-${index}`}
                track={track}
                index={index}
                active={index === queueIndex}
                onPlay={() => setQueue(queue, index)}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </M3eDialog>
  );
}

/**
 * 播放列表行：可拖拽（drag_indicator 把手），点击切曲并播放。
 */
function QueueRow({
  track,
  index,
  active,
  onPlay,
}: {
  track: Track;
  index: number;
  active: boolean;
  onPlay: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: index });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onClick={onPlay}
      className={[
        'flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2',
        active
          ? 'bg-(--md-sys-color-primary-container) text-(--md-sys-color-on-primary-container)'
          : 'hover:bg-(--md-sys-color-surface-container-high)',
      ].join(' ')}
      {...attributes}
      {...listeners}
    >
      <M3eIcon name="drag_indicator" className="shrink-0 opacity-40" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm">{track.title}</div>
        <div className="truncate text-xs opacity-60">{track.workTitle}</div>
      </div>
      {active && (
        <span className="shrink-0 text-xs font-medium">正在播放</span>
      )}
    </div>
  );
}

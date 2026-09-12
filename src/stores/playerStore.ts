import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LyricLine } from '../utils/lrc';
import type { LoudnessInfo, LyricsRef } from '../types';

/** 队列中的音轨。 */
export interface Track {
  /** 文件唯一标识（media index / hash） */
  hash: string;
  /** 曲目标题（UI 展示） */
  title: string;
  /** 所属作品标题（UI 展示） */
  workTitle: string;
  /** 所属作品 id（完整 RJ code，动态取色用） */
  workId?: string;
  /** 作品响度快照（入队时拷贝；播放时按当前响度设置实时计算增益） */
  loudness?: LoudnessInfo;
  /** 歌词引用（入队时由树节点拷贝；切曲时据此取文本） */
  lyrics?: LyricsRef;
  /** 流媒体 URL（不传则由 usePlayer 用 hash 构造） */
  mediaStreamUrl?: string;
  /** 下载 URL */
  mediaDownloadUrl?: string;
  /** 恢复播放的起始时间（秒）；仅「继续播放」时设置，加载完成后 seek */
  startAt?: number;
}

/** 队列条目：Track + 入队时分配的条目唯一 id（会话内唯一，队列不持久化）。 */
export type QueuedTrack = Track & { uid: string };

/** uid 计数器：store 入队时分配，保证重复 hash 的条目也可区分。 */
let uidSeq = 0;
const nextUid = () => `q${++uidSeq}`;

export type PlayMode = 'order' | 'allRepeat' | 'repeatOne' | 'shuffle';

interface PlayerState {
  /** 是否全屏播放器隐藏（隐藏时仅显示迷你条） */
  hide: boolean;
  playing: boolean;
  /** 当前播放时间（秒） */
  currentTime: number;
  /** 总时长（秒） */
  duration: number;
  queue: QueuedTrack[];
  /** 当前播放条目 uid；null 表示无当前曲目（如当前曲被移除后） */
  currentUid: string | null;
  playMode: PlayMode;
  muted: boolean;
  /** 音量 0.0–1.0 */
  volume: number;
  /** 当前歌词行 */
  currentLyric: string;
  /** 当前曲目完整歌词行 */
  lyricLines: LyricLine[];
  /** 当前激活歌词行下标（-1 表示无） */
  activeLyricIndex: number;
  /** 睡眠定时器目标时刻（"HH:MM"），null 表示未设置 */
  sleepTime: string | null;
  sleepMode: boolean;
  /** 快退秒数 */
  rewindSeekTime: number;
  /** 快进秒数 */
  forwardSeekTime: number;
  /** 快退触发器（toggle 值 → usePlayer 监听变化执行 seek） */
  rewindSeekMode: boolean;
  forwardSeekMode: boolean;
}

interface PlayerActions {
  play: () => void;
  pause: () => void;
  togglePlaying: () => void;
  nextTrack: () => void;
  previousTrack: () => void;
  /** 设置队列并从指定索引开始播放。 */
  setQueue: (queue: Track[], index?: number) => void;
  addToQueue: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  /** 在当前音轨之后插入（"下一首播放"）。 */
  playNext: (track: Track) => void;
  /** 拖拽重排队列（不改变当前曲目身份）。 */
  reorderQueue: (oldIndex: number, newIndex: number) => void;
  /** 点击队列条目切曲播放。 */
  playFromQueue: (uid: string) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (dur: number) => void;
  /** 循环切换播放模式：order → allRepeat → repeatOne → shuffle。 */
  changePlayMode: () => void;
  toggleMuted: () => void;
  setVolume: (vol: number) => void;
  setCurrentLyric: (lyric: string) => void;
  /** 切曲时写入/清空完整歌词行。 */
  setLyrics: (lines: LyricLine[]) => void;
  setActiveLyricIndex: (index: number) => void;
  toggleHide: () => void;
  setRewindSeekTime: (time: number) => void;
  setForwardSeekTime: (time: number) => void;
  /** 触发一次快退（toggle 值，供 useEffect 依赖）。 */
  triggerRewind: () => void;
  triggerForward: () => void;
  setSleepTimer: (time: string) => void;
  clearSleepMode: () => void;
}

const PLAY_MODE_ORDER: PlayMode[] = [
  'order',
  'allRepeat',
  'repeatOne',
  'shuffle',
];

/** 当前播放条目（uid 悬空时为 undefined）。 */
export const selectCurrentTrack = (
  s: PlayerState & PlayerActions,
): QueuedTrack | undefined => s.queue.find((t) => t.uid === s.currentUid);

/** 当前播放条目索引（悬空为 -1）。 */
export const selectCurrentIndex = (s: PlayerState & PlayerActions): number =>
  s.queue.findIndex((t) => t.uid === s.currentUid);

export const usePlayerStore = create<PlayerState & PlayerActions>()(
  persist(
    (set, get) => ({
      hide: false,
      playing: false,
      currentTime: 0,
      duration: 0,
      queue: [],
      currentUid: null,
      playMode: 'order',
      muted: false,
      volume: 0.8,
      currentLyric: '',
      lyricLines: [],
      activeLyricIndex: -1,
      sleepTime: null,
      sleepMode: false,
      rewindSeekTime: 5,
      forwardSeekTime: 30,
      rewindSeekMode: false,
      forwardSeekMode: false,

      play: () => set({ playing: true }),
      pause: () => set({ playing: false }),
      togglePlaying: () => set((s) => ({ playing: !s.playing })),

      nextTrack: () => {
        const { queue, currentUid, playMode } = get();
        if (queue.length === 0) return;
        const index = queue.findIndex((t) => t.uid === currentUid);
        let nextIndex: number;
        switch (playMode) {
          case 'repeatOne':
            nextIndex = index;
            break;
          case 'shuffle':
            // 队列仅 1 首时不随机，避免原地循环
            nextIndex =
              queue.length === 1 ? 0 : Math.floor(Math.random() * queue.length);
            break;
          case 'allRepeat':
            nextIndex = (index + 1) % queue.length;
            break;
          default: // order：无当前（已被移除）从第 0 首开始；到末尾停止
            if (index + 1 >= queue.length) {
              set({ playing: false });
              return;
            }
            nextIndex = index + 1;
        }
        set({ currentUid: queue[nextIndex]?.uid ?? null, playing: true });
      },

      previousTrack: () => {
        const { queue, currentUid } = get();
        if (queue.length === 0) return;
        const index = queue.findIndex((t) => t.uid === currentUid);
        set({
          currentUid: queue[index > 0 ? index - 1 : queue.length - 1].uid,
          playing: true,
        });
      },

      setQueue: (queue, index = 0) => {
        const entries = queue.map((t) => ({ ...t, uid: nextUid() }));
        set({
          queue: entries,
          currentUid: entries[index]?.uid ?? null,
          playing: true,
        });
      },

      addToQueue: (track) =>
        set((s) => {
          const entry = { ...track, uid: nextUid() };
          return {
            queue: [...s.queue, entry],
            // 空队列首次入队成为当前曲目（对齐旧版「首曲即当前曲」的语义）
            currentUid: s.currentUid ?? entry.uid,
          };
        }),

      removeFromQueue: (index) =>
        set((s) => {
          const removed = s.queue[index];
          if (!removed) return {};
          const isCurrent = removed.uid === s.currentUid;
          return {
            queue: s.queue.filter((_, i) => i !== index),
            // 删除当前音轨 → currentUid 置空（usePlayer 卸载 Howl 停止播放）
            currentUid: isCurrent ? null : s.currentUid,
            // 同步停止播放，避免 MediaSession 在无声时残留「正在播放」
            ...(isCurrent ? { playing: false } : {}),
          };
        }),

      playNext: (track) =>
        set((s) => {
          const index = s.queue.findIndex((t) => t.uid === s.currentUid);
          const queue = [...s.queue];
          // 无当前曲目时追加到末尾
          queue.splice(index === -1 ? queue.length : index + 1, 0, {
            ...track,
            uid: nextUid(),
          });
          return { queue };
        }),

      reorderQueue: (oldIndex, newIndex) =>
        set((s) => {
          const queue = [...s.queue];
          const [entry] = queue.splice(oldIndex, 1);
          if (!entry) return {};
          queue.splice(newIndex, 0, entry);
          return { queue };
        }),

      playFromQueue: (uid) => set({ currentUid: uid, playing: true }),

      setCurrentTime: (time) => set({ currentTime: time }),
      setDuration: (dur) => set({ duration: dur }),

      changePlayMode: () => {
        const current = get().playMode;
        const next =
          PLAY_MODE_ORDER[
            (PLAY_MODE_ORDER.indexOf(current) + 1) % PLAY_MODE_ORDER.length
          ];
        set({ playMode: next });
      },

      toggleMuted: () => set((s) => ({ muted: !s.muted })),
      setVolume: (vol) => set({ volume: Math.min(1, Math.max(0, vol)) }),
      setCurrentLyric: (lyric) => set({ currentLyric: lyric }),
      setLyrics: (lines) => set({ lyricLines: lines, activeLyricIndex: -1 }),
      setActiveLyricIndex: (index) => set({ activeLyricIndex: index }),
      toggleHide: () => set((s) => ({ hide: !s.hide })),

      setRewindSeekTime: (time) => set({ rewindSeekTime: time }),
      setForwardSeekTime: (time) => set({ forwardSeekTime: time }),
      triggerRewind: () => set((s) => ({ rewindSeekMode: !s.rewindSeekMode })),
      triggerForward: () =>
        set((s) => ({ forwardSeekMode: !s.forwardSeekMode })),

      setSleepTimer: (time) => set({ sleepTime: time, sleepMode: true }),
      clearSleepMode: () => set({ sleepTime: null, sleepMode: false }),
    }),
    {
      name: 'kiku-player',
      // 仅持久化用户偏好，不持久化播放进度/队列（队列含临时 URL，进度应重置）
      partialize: (state) => ({
        volume: state.volume,
        muted: state.muted,
        playMode: state.playMode,
        hide: state.hide,
        rewindSeekTime: state.rewindSeekTime,
        forwardSeekTime: state.forwardSeekTime,
      }),
    },
  ),
);

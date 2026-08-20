import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LyricLine } from '../utils/lrc';

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
  /** 流媒体 URL（不传则由 usePlayer 用 hash 构造） */
  mediaStreamUrl?: string;
  /** 下载 URL */
  mediaDownloadUrl?: string;
  /** 恢复播放的起始时间（秒）；仅「继续播放」时设置，加载完成后 seek */
  startAt?: number;
}

export type PlayMode = 'order' | 'allRepeat' | 'repeatOne' | 'shuffle';

interface PlayerState {
  /** 是否全屏播放器隐藏（隐藏时仅显示迷你条） */
  hide: boolean;
  playing: boolean;
  /** 当前播放时间（秒） */
  currentTime: number;
  /** 总时长（秒） */
  duration: number;
  queue: Track[];
  /** 当前播放音轨在队列中的索引 */
  queueIndex: number;
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

export const usePlayerStore = create<PlayerState & PlayerActions>()(
  persist(
    (set, get) => ({
      hide: false,
      playing: false,
      currentTime: 0,
      duration: 0,
      queue: [],
      queueIndex: 0,
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
        const { queue, queueIndex, playMode } = get();
        if (queue.length === 0) return;
        let nextIndex: number;
        switch (playMode) {
          case 'repeatOne':
            nextIndex = queueIndex;
            break;
          case 'shuffle':
            // 队列仅 1 首时不随机，避免原地循环
            nextIndex =
              queue.length === 1 ? 0 : Math.floor(Math.random() * queue.length);
            break;
          case 'allRepeat':
            nextIndex = (queueIndex + 1) % queue.length;
            break;
          default: // order：到末尾停止
            if (queueIndex + 1 >= queue.length) {
              set({ playing: false });
              return;
            }
            nextIndex = queueIndex + 1;
        }
        set({ queueIndex: nextIndex, playing: true });
      },

      previousTrack: () => {
        const { queue, queueIndex } = get();
        if (queue.length === 0) return;
        set({
          queueIndex: queueIndex > 0 ? queueIndex - 1 : queue.length - 1,
          playing: true,
        });
      },

      setQueue: (queue, index = 0) =>
        set({ queue, queueIndex: index, playing: true }),

      addToQueue: (track) => set((s) => ({ queue: [...s.queue, track] })),

      removeFromQueue: (index) =>
        set((s) => {
          const queue = s.queue.filter((_, i) => i !== index);
          let queueIndex = s.queueIndex;
          if (index === s.queueIndex) {
            // 删除的是当前音轨 → 停止播放
            queueIndex = 0;
          } else if (index < s.queueIndex) {
            queueIndex = s.queueIndex - 1;
          }
          return { queue, queueIndex };
        }),

      playNext: (track) =>
        set((s) => {
          const queue = [...s.queue];
          queue.splice(s.queueIndex + 1, 0, track);
          return { queue };
        }),

      setCurrentTime: (time) => set({ currentTime: time }),
      setDuration: (dur) => set({ duration: dur }),

      changePlayMode: () => {
        const current = get().playMode;
        const next =
          PLAY_MODE_ORDER[(PLAY_MODE_ORDER.indexOf(current) + 1) % PLAY_MODE_ORDER.length];
        set({ playMode: next });
      },

      toggleMuted: () => set((s) => ({ muted: !s.muted })),
      setVolume: (vol) => set({ volume: vol }),
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

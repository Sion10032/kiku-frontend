import { useEffect, useRef } from 'react';
import { Howl } from 'howler';
import { usePlayerStore, type Track } from '../stores/playerStore';
import { streamUrl, checkLrc } from '../api/media';
import { parseLyrics, findActiveLineIndex, type LyricLine } from '../utils/lrc';
import { trackPlayback, flushProgress, reportTrackEnd } from '../utils/progressReporter';

/**
 * 模块级 Howl 单例。
 *
 * 进度条等 UI（AudioPlayer）不重复挂载本 hook，
 * 通过导出的 seekTo 间接操作音频实例。
 */
let howl: Howl | null = null;

/**
 * 当前曲目的歌词行与最近一次激活行号。
 *
 * 行号变化才写 store（setCurrentLyric），
 * 避免 250ms 轮询无脑写入引起重渲染。
 */
let lyricLines: LyricLine[] = [];
let lastLyricIndex = -1;

/** 按播放位置同步当前歌词行（无歌词/行号未变时无操作）。 */
function syncLyric(time: number): void {
  if (lyricLines.length === 0) return;
  const index = findActiveLineIndex(lyricLines, time);
  if (index === lastLyricIndex) return;
  lastLyricIndex = index;
  const store = usePlayerStore.getState();
  store.setActiveLyricIndex(index);
  store.setCurrentLyric(index === -1 ? '' : lyricLines[index].text);
}

/**
 * 拖动进度条 seek：clamp 到 [0, duration] 后写回 store，
 * 使 250ms 轮询与拖动显示保持一致。
 */
export function seekTo(time: number): void {
  const sound = howl;
  if (!sound) return;
  const dur = sound.duration();
  const clamped = dur > 0 ? Math.max(0, Math.min(time, dur)) : Math.max(0, time);
  sound.seek(clamped);
  usePlayerStore.getState().setCurrentTime(clamped);
  // 暂停时 250ms 轮询不跑，需在此同步歌词行（播放中轮询会兜底）
  syncLyric(clamped);
}

/** 由音轨解析流媒体地址：优先 workId + hash，缺失时回退 mediaStreamUrl。 */
function resolveSrc(track: Track): string | undefined {
  if (track.workId) return streamUrl(track.workId, track.hash);
  return track.mediaStreamUrl;
}

/**
 * Howler 实例管理 hook：在 AudioElement 中挂载一次。
 *
 * - store 为唯一数据源：Howl 由 playing/volume/muted 单向驱动，
 *   onplay/onpause 不回写 store（避免切曲时 unload 触发 onpause 干扰状态）
 * - 切曲（queue/queueIndex 变化 → currentTrack 引用变化）时卸载重建 Howl，
 *   并重新加载歌词（check-lrc）：轮询中行号变化才写 currentLyric
 * - onend 按 playMode 处理：repeatOne 原地重播；order 到末尾 nextTrack
 *   内部置 playing=false；shuffle 随机回当前曲目（store 无变化、不重建）
 *   时原地重播兜底
 * - StrictMode 下 effect 双执行：cleanup 卸载旧实例，保证幂等
 */
export function usePlayer(): void {
  const queue = usePlayerStore((s) => s.queue);
  const queueIndex = usePlayerStore((s) => s.queueIndex);
  const playing = usePlayerStore((s) => s.playing);
  const volume = usePlayerStore((s) => s.volume);
  const muted = usePlayerStore((s) => s.muted);
  const rewindSeekMode = usePlayerStore((s) => s.rewindSeekMode);
  const forwardSeekMode = usePlayerStore((s) => s.forwardSeekMode);
  const sleepMode = usePlayerStore((s) => s.sleepMode);
  const sleepTime = usePlayerStore((s) => s.sleepTime);

  const currentTrack = queue[queueIndex];

  // —— 曲目加载：切曲时卸载旧实例并重建 ——

  useEffect(() => {
    if (!currentTrack) return;

    // —— 歌词：切曲时先清空，再按新曲目异步加载 ——
    lyricLines = [];
    lastLyricIndex = -1;
    usePlayerStore.getState().setLyrics([]);
    usePlayerStore.getState().setCurrentLyric('');
    let lyricCancelled = false;
    if (currentTrack.workId) {
      checkLrc(currentTrack.workId, currentTrack.hash)
        .then((res) => {
          // 响应晚于切曲（含 StrictMode 双执行）时丢弃
          if (lyricCancelled) return;
          if (res.hasLrc && res.type && res.text) {
            lyricLines = parseLyrics(res.type, res.text);
            usePlayerStore.getState().setLyrics(lyricLines);
          }
        })
        .catch(() => {}); // 无歌词属正常，静默
    }

    const src = resolveSrc(currentTrack);
    if (!src) {
      console.warn(
        `[usePlayer] 音轨缺少 workId 与 mediaStreamUrl，跳过加载：${currentTrack.title}`,
      );
      return;
    }

    // 仅初始化用；后续音量变化由独立 effect 同步
    const { playing: initialPlaying, volume: v, muted: m } =
      usePlayerStore.getState();

    const sound = new Howl({
      src: [src],
      html5: true, // 流式播放，避免大文件全量下载
      volume: m ? 0 : v,
      onload: () => {
        const dur = sound.duration() || 0;
        usePlayerStore.getState().setDuration(dur);
        // 「继续播放」：加载完成后跳到上次位置（html5 模式 seek 需就绪后生效）
        if (currentTrack.startAt != null && currentTrack.startAt > 0) {
          const at = Math.min(currentTrack.startAt, dur > 0 ? dur : currentTrack.startAt);
          sound.seek(at);
          usePlayerStore.getState().setCurrentTime(at);
        }
      },
      onend: () => {
        // 自然结束：上报 position=duration（计入已听轨数）后按播放模式继续
        const dur = sound.duration() || 0;
        reportTrackEnd(
          { workId: currentTrack.workId!, hash: currentTrack.hash, title: currentTrack.title },
          dur,
        );
        const before = usePlayerStore.getState();
        if (before.playMode === 'repeatOne') {
          // 单曲循环：原地重播（queueIndex 不变，不会触发重建）
          sound.seek(0);
          sound.play();
          before.setCurrentTime(0);
          return;
        }
        before.nextTrack();
        const after = usePlayerStore.getState();
        // shuffle 随机到当前曲目：store 无变化、Howl 已结束 → 原地重播
        if (after.playing && after.queueIndex === before.queueIndex) {
          sound.seek(0);
          sound.play();
          after.setCurrentTime(0);
        }
      },
    });
    howl = sound;

    if (initialPlaying) sound.play();

    return () => {
      lyricCancelled = true;
      // 切曲/卸载前先把旧曲进度发出
      flushProgress();
      sound.unload();
      if (howl === sound) howl = null;
    };
    // 依赖曲目身份；音量/播放态变化不应重建音频
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack]);

  // —— 播放/暂停同步（含切曲后新实例的启动） ——

  useEffect(() => {
    const sound = howl;
    if (!sound || !currentTrack) return;
    if (playing && !sound.playing()) sound.play();
    else if (!playing && sound.playing()) {
      sound.pause();
      // 暂停即 flush 进度（页面可能一直停在暂停态）
      flushProgress();
    }
  }, [playing, currentTrack]);

  // —— 音量/静音同步 ——

  useEffect(() => {
    howl?.volume(muted ? 0 : volume);
  }, [volume, muted]);

  // —— 时间轮询：播放中每 250ms 写回 currentTime（并节流上报播放进度） ——

  useEffect(() => {
    const timer = setInterval(() => {
      const sound = howl;
      if (sound && sound.playing()) {
        const t = sound.seek() as number;
        usePlayerStore.getState().setCurrentTime(t);
        syncLyric(t);
        // 动态进度上报（内部 10s 节流；仅登录且带 workId 的音轨生效）
        const track = usePlayerStore.getState().queue[usePlayerStore.getState().queueIndex];
        if (track?.workId) {
          const dur = sound.duration();
          trackPlayback({ workId: track.workId, hash: track.hash, title: track.title }, t, dur > 0 ? dur : null);
        }
      }
    }, 250);
    return () => clearInterval(timer);
  }, []);

  // —— 快退（rewindSeekMode 是 toggle 值，跳过首跑） ——

  const lastRewind = useRef(rewindSeekMode);
  useEffect(() => {
    if (lastRewind.current === rewindSeekMode) return;
    lastRewind.current = rewindSeekMode;
    const sound = howl;
    if (!sound) return;
    // 用 howl 实时值，store 里的 currentTime 可能过期
    const next = Math.max(
      0,
      (sound.seek() as number) -
        usePlayerStore.getState().rewindSeekTime,
    );
    sound.seek(next);
    usePlayerStore.getState().setCurrentTime(next);
    syncLyric(next);
  }, [rewindSeekMode]);

  // —— 快进（clamp 到 duration） ——

  const lastForward = useRef(forwardSeekMode);
  useEffect(() => {
    if (lastForward.current === forwardSeekMode) return;
    lastForward.current = forwardSeekMode;
    const sound = howl;
    if (!sound) return;
    const dur = sound.duration();
    const next = Math.min(
      dur > 0 ? dur : Infinity,
      (sound.seek() as number) +
        usePlayerStore.getState().forwardSeekTime,
    );
    sound.seek(next);
    usePlayerStore.getState().setCurrentTime(next);
    syncLyric(next);
  }, [forwardSeekMode]);

  // —— 睡眠定时器：到达 sleepTime 后暂停并清除（分钟精度） ——

  useEffect(() => {
    if (!sleepMode || !sleepTime) return;
    const timer = setInterval(() => {
      const now = new Date();
      const [h, m] = sleepTime.split(':').map(Number);
      if (
        now.getHours() > h ||
        (now.getHours() === h && now.getMinutes() >= m)
      ) {
        const state = usePlayerStore.getState();
        state.pause();
        state.clearSleepMode();
      }
    }, 10_000);
    return () => clearInterval(timer);
  }, [sleepMode, sleepTime]);
}

import { useEffect, useRef } from 'react';
import { Howl } from 'howler';
import {
  usePlayerStore,
  selectCurrentTrack,
  type Track,
} from '../stores/playerStore';
import { streamUrl, fetchLyricsText } from '../api/media';
import { attachGainChain } from '../utils/normalizer';
import { WasmWvPlayer, type PlayerBackend } from '../wavpack/WasmWvPlayer';
import { isVideoTrack } from '../utils/track';
import { useSettingsStore } from '../stores/settingsStore';
import { parseLyrics, findActiveLineIndex, type LyricLine } from '../utils/lrc';
import {
  trackPlayback,
  flushProgress,
  reportTrackEnd,
} from '../utils/progressReporter';
import { useCurrentGainDb } from './useCurrentGainDb';

/**
 * 模块级播放后端单例（.wv → WasmWvPlayer，其余 → Howler 适配器）。
 *
 * 进度条等 UI（AudioPlayer）不重复挂载本 hook，
 * 通过导出的 seekTo 间接操作音频实例。
 */
let backend: PlayerBackend | null = null;

/**
 * Howler 分支专用：响度均衡增益链需要直达底层 HTMLAudioElement，
 * PlayerBackend 接口不暴露元素，故单独保留引用（仅 attachGainChain 用）。
 */
let howl: Howl | null = null;

/**
 * 视频播放后端：<video> 单例 + PlayerBackend 适配，见 ./videoBackend.ts。
 */
import {
  getVideoElement,
  parkVideoElement,
  videoBackend,
} from './videoBackend';

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
  if (!backend) return;
  const dur = backend.duration();
  const clamped =
    dur > 0 ? Math.max(0, Math.min(time, dur)) : Math.max(0, time);
  backend.seek(clamped);
  usePlayerStore.getState().setCurrentTime(clamped);
  // 暂停时 250ms 轮询不跑，需在此同步歌词行（播放中轮询会兜底）
  syncLyric(clamped);
}

/** 由音轨解析流媒体地址：优先 workId + hash，缺失时回退 mediaStreamUrl。 */
function resolveSrc(track: Track): string | undefined {
  if (track.workId) return streamUrl(track.workId, track.hash);
  return track.mediaStreamUrl;
}

/** .wv 曲目走 WasmWvPlayer（worker 解码 + AudioBuffer 调度），其余走 Howler。 */
function isWv(track: Track): boolean {
  return (track.hash ?? '').toLowerCase().endsWith('.wv');
}

/** Howler 适配为 PlayerBackend：方法签名对齐，双轨分流后统一驱动。 */
function howlBackend(sound: Howl): PlayerBackend {
  return {
    play: () => sound.play(),
    pause: () => sound.pause(),
    seek: (t) => sound.seek(t),
    volume: (v) => sound.volume(v),
    duration: () => sound.duration() || 0,
    currentTime: () => (sound.seek() as number) || 0,
    playing: () => sound.playing(),
    unload: () => sound.unload(),
  };
}

/**
 * 自然结束收尾（两种后端共用）：上报 position=duration（计入已听轨数）
 * 后按播放模式继续；replay 封装后端的原地重播（repeatOne / shuffle
 * 随机到当前曲目时调用）。
 */
function handleTrackEnd(track: Track, dur: number, replay: () => void): void {
  reportTrackEnd(
    {
      workId: track.workId!,
      hash: track.hash,
      title: track.title,
    },
    dur,
  );
  const before = usePlayerStore.getState();
  if (before.playMode === 'repeatOne') {
    // 单曲循环：原地重播（currentUid 不变，不会触发重建）
    replay();
    before.setCurrentTime(0);
    return;
  }
  before.nextTrack();
  const after = usePlayerStore.getState();
  // shuffle 随机到当前曲目：store 无变化、实例已结束 → 原地重播兜底
  if (after.playing && after.currentUid === before.currentUid) {
    replay();
    after.setCurrentTime(0);
  }
}

/**
 * 播放实例管理 hook：在 AudioElement 中挂载一次。
 *
 * - .wv 曲目走 WasmWvPlayer（worker 解码 + AudioBuffer 链式调度），
 *   其余走 Howler（适配为同一 PlayerBackend 接口）
 * - store 为唯一数据源：播放实例由 playing/volume/muted 单向驱动，
 *   onplay/onpause 不回写 store（避免切曲时 unload 触发 onpause 干扰状态）
 * - 切曲（currentTrack 引用变化）时卸载重建实例，
 *   并按树节点歌词引用（lyrics）重新拉取原文：
 *   轮询中行号变化才写 currentLyric
 * - onend 按 playMode 处理：repeatOne 原地重播；order 到末尾 nextTrack
 *   内部置 playing=false；shuffle 随机回当前曲目（store 无变化、不重建）
 *   时原地重播兜底
 * - StrictMode 下 effect 双执行：cleanup 卸载旧实例，保证幂等
 */
export function usePlayer(): void {
  const currentTrack = usePlayerStore(selectCurrentTrack);
  const playing = usePlayerStore((s) => s.playing);
  const volume = usePlayerStore((s) => s.volume);
  const muted = usePlayerStore((s) => s.muted);
  const gainDb = useCurrentGainDb();
  const rewindSeekMode = usePlayerStore((s) => s.rewindSeekMode);
  const forwardSeekMode = usePlayerStore((s) => s.forwardSeekMode);
  const sleepMode = usePlayerStore((s) => s.sleepMode);
  const sleepTime = usePlayerStore((s) => s.sleepTime);

  // —— 曲目加载：切曲时卸载旧实例并重建 ——

  useEffect(() => {
    if (!currentTrack) return;

    // —— 歌词：切曲时先清空，再按新曲目异步加载 ——
    lyricLines = [];
    lastLyricIndex = -1;
    usePlayerStore.getState().setLyrics([]);
    usePlayerStore.getState().setCurrentLyric('');
    let lyricCancelled = false;
    const lyrics = currentTrack.lyrics;
    if (currentTrack.workId && lyrics) {
      fetchLyricsText(currentTrack.workId, lyrics.hash)
        .then((text) => {
          // 响应晚于切曲（含 StrictMode 双执行）时丢弃
          if (lyricCancelled) return;
          lyricLines = parseLyrics(lyrics.type, text);
          usePlayerStore.getState().setLyrics(lyricLines);
        })
        .catch(() => {}); // 404/网络错误按无歌词处理，静默
    }

    const src = resolveSrc(currentTrack);
    if (!src) {
      console.warn(
        `[usePlayer] 音轨缺少 workId 与 mediaStreamUrl，跳过加载：${currentTrack.title}`,
      );
      return;
    }

    // 默认非视频后端；视频分支命中再翻 true（封面层渲染条件的唯一可信源）
    usePlayerStore.getState().setVideoActive(false);

    // 仅初始化用；后续音量变化由独立 effect 同步
    const {
      playing: initialPlaying,
      volume: v,
      muted: m,
    } = usePlayerStore.getState();

    if (isWv(currentTrack)) {
      // —— WavPack 分支：worker 解码 + AudioBuffer 链式调度 ——
      const player = new WasmWvPlayer(src, {
        onLoad: (dur) => {
          usePlayerStore.getState().setDuration(dur);
          // 「继续播放」：meta 到达后跳到上次位置（worker play 从该 sample 重建）
          if (currentTrack.startAt != null && currentTrack.startAt > 0) {
            const at = Math.min(
              currentTrack.startAt,
              dur > 0 ? dur : currentTrack.startAt,
            );
            player.seek(at);
            usePlayerStore.getState().setCurrentTime(at);
          }
        },
        onEnd: () => {
          // 切曲后 terminate 在途的 stale ended 不驱动旧闭包收尾（防多跳一首）
          if (backend !== player) return;
          handleTrackEnd(currentTrack, player.duration(), () => {
            player.seek(0);
            player.play();
          });
        },
      });
      backend = player;
      // 初始音量：WasmWvPlayer 构造不接收音量（GainNode 默认 1），
      // 音量同步 effect 依赖 [volume, muted]，切曲时不重跑 → 构造后立即设初值
      player.volume(m ? 0 : Math.min(1, Math.max(0, v)));

      if (initialPlaying) player.play();

      return () => {
        lyricCancelled = true;
        // 切曲/卸载前先把旧曲进度发出
        flushProgress();
        player.unload();
        if (backend === player) backend = null;
      };
    }

    // —— 视频分支（.mp4/.webm/.mkv 且设置的视频模式为 video）：
    // 模块级 <video> 单例，画面层挂载此元素。audio 模式下视频落 Howler
    // 分支（html5 audio 元素只取音轨）；none 模式视频本就入不了队，
    // 已在队内的残曲回退同 audio 播法。模式仅切曲生效（当前曲目不重建）——
    // 封面层读 playerStore.videoActive 忠实反映实际后端 ——
    if (
      isVideoTrack(currentTrack)
      && useSettingsStore.getState().videoMode === 'video'
    ) {
      usePlayerStore.getState().setVideoActive(true);
      const el = getVideoElement();
      el.src = src;
      const vBackend = videoBackend(el);
      backend = vBackend;
      // 视频元素同为 HTMLMediaElement：响度均衡增益链与 Howler 分支同等接入
      attachGainChain(el).setGainDb(gainDb);
      // 初始音量：音量同步 effect 依赖 [volume, muted]，切曲时不重跑 → 立即设初值
      vBackend.volume(m ? 0 : Math.min(1, Math.max(0, v)));

      const onLoadedMetadata = () => {
        const dur = el.duration || 0;
        usePlayerStore.getState().setDuration(dur);
        // 「继续播放」：metadata 到达后跳到上次位置（与 Howler onload 同口径）
        if (currentTrack.startAt != null && currentTrack.startAt > 0) {
          const at = Math.min(
            currentTrack.startAt,
            dur > 0 ? dur : currentTrack.startAt,
          );
          el.currentTime = at;
          usePlayerStore.getState().setCurrentTime(at);
        }
      };
      const onEnded = () => {
        // 切曲后 stale ended 不驱动旧闭包收尾（防多跳一首）
        if (backend !== vBackend) return;
        handleTrackEnd(currentTrack, el.duration || 0, () => {
          el.currentTime = 0;
          void el.play();
        });
      };
      el.addEventListener('loadedmetadata', onLoadedMetadata);
      el.addEventListener('ended', onEnded);

      if (initialPlaying) {
        void el.play();
      }

      return () => {
        lyricCancelled = true;
        // 切曲/卸载前先把旧曲进度发出
        flushProgress();
        el.removeEventListener('loadedmetadata', onLoadedMetadata);
        el.removeEventListener('ended', onEnded);
        vBackend.unload();
        parkVideoElement();
        if (backend === vBackend) backend = null;
      };
    }

    // —— Howler 分支（非 .wv；视频仅在设置模式为 video 时才走视频分支） ——
    const sound = new Howl({
      src: [src],
      html5: true, // 流式播放，避免大文件全量下载
      // html5 元素 volume 强制 0..1（越界抛 DOMException）；钳制以自愈持久化的非法值
      volume: m ? 0 : Math.min(1, Math.max(0, v)),
      onload: () => {
        const dur = sound.duration() || 0;
        usePlayerStore.getState().setDuration(dur);
        // 「继续播放」：加载完成后跳到上次位置（html5 模式 seek 需就绪后生效）
        if (currentTrack.startAt != null && currentTrack.startAt > 0) {
          const at = Math.min(
            currentTrack.startAt,
            dur > 0 ? dur : currentTrack.startAt,
          );
          sound.seek(at);
          usePlayerStore.getState().setCurrentTime(at);
        }
      },
      onend: () => {
        handleTrackEnd(currentTrack, sound.duration() || 0, () => {
          sound.seek(0);
          sound.play();
        });
      },
    });
    const howlerBackend = howlBackend(sound);
    backend = howlerBackend;
    howl = sound;

    // 音量均衡：html5 元素接 WebAudio 增益链（Howler volume 上限 1，无法提升）
    const el = (
      sound as unknown as { _sounds?: Array<{ _node?: HTMLAudioElement }> }
    )._sounds?.[0]?._node;
    if (el instanceof HTMLAudioElement) {
      attachGainChain(el).setGainDb(gainDb);
    }

    if (initialPlaying) sound.play();

    return () => {
      lyricCancelled = true;
      // 切曲/卸载前先把旧曲进度发出
      flushProgress();
      sound.unload();
      if (backend === howlerBackend) backend = null;
      if (howl === sound) howl = null;
    };
    // 依赖曲目身份；音量/播放态变化不应重建音频
  }, [currentTrack]);

  // —— 播放/暂停同步（含切曲后新实例的启动） ——

  useEffect(() => {
    if (!backend || !currentTrack) return;
    if (playing && !backend.playing()) backend.play();
    else if (!playing && backend.playing()) {
      backend.pause();
      // 暂停即 flush 进度（页面可能一直停在暂停态）
      flushProgress();
    }
  }, [playing, currentTrack]);

  // —— 音量/静音同步 ——

  useEffect(() => {
    backend?.volume(muted ? 0 : Math.min(1, Math.max(0, volume)));
  }, [volume, muted]);

  // —— 增益均衡：gainDb 变化（设置调整/切曲/开关）后应用到实例的元素 ——
  // Howler 分支从 howl._sounds 取底层 audio 元素；.wv 无 HTMLAudioElement，
  // 响度增益不生效；视频分支（videoActive=true）直接取模块级 <video> 单例

  useEffect(() => {
    const el = howl as unknown as {
      _sounds?: Array<{ _node?: HTMLAudioElement }>;
    } | null;
    const node = el?._sounds?.[0]?._node;
    if (node instanceof HTMLAudioElement) {
      attachGainChain(node).setGainDb(gainDb);
    }
    // 曲目加载 effect 同轮已按分流写入 videoActive，此处读最新值
    if (currentTrack && usePlayerStore.getState().videoActive) {
      attachGainChain(getVideoElement()).setGainDb(gainDb);
    }
  }, [gainDb, currentTrack]);

  // —— 时间轮询：播放中每 250ms 写回 currentTime（并节流上报播放进度） ——

  useEffect(() => {
    const timer = setInterval(() => {
      if (backend?.playing()) {
        const t = backend.currentTime();
        usePlayerStore.getState().setCurrentTime(t);
        syncLyric(t);
        // 动态进度上报（内部 10s 节流；仅登录且带 workId 的音轨生效）
        const track = selectCurrentTrack(usePlayerStore.getState());
        if (track?.workId) {
          const dur = backend.duration();
          trackPlayback(
            { workId: track.workId, hash: track.hash, title: track.title },
            t,
            dur > 0 ? dur : null,
          );
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
    if (!backend) return;
    // 用后端实时值，store 里的 currentTime 可能过期
    const next = Math.max(
      0,
      backend.currentTime() - usePlayerStore.getState().rewindSeekTime,
    );
    backend.seek(next);
    usePlayerStore.getState().setCurrentTime(next);
    syncLyric(next);
  }, [rewindSeekMode]);

  // —— 快进（clamp 到 duration） ——

  const lastForward = useRef(forwardSeekMode);
  useEffect(() => {
    if (lastForward.current === forwardSeekMode) return;
    lastForward.current = forwardSeekMode;
    if (!backend) return;
    const dur = backend.duration();
    const next = Math.min(
      dur > 0 ? dur : Infinity,
      backend.currentTime() + usePlayerStore.getState().forwardSeekTime,
    );
    backend.seek(next);
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
        now.getHours() > h
        || (now.getHours() === h && now.getMinutes() >= m)
      ) {
        const state = usePlayerStore.getState();
        state.pause();
        state.clearSleepMode();
      }
    }, 10_000);
    return () => clearInterval(timer);
  }, [sleepMode, sleepTime]);
}

import { useEffect, useRef } from 'react';
import { usePlayerStore } from '../stores/playerStore';
import { useSettingsStore } from '../stores/settingsStore';
import { mediaUrl } from '../api/client';
import { seekTo } from './usePlayer';

/**
 * MediaSession API 接入 hook：在 AudioElement 中与 usePlayer 并列挂载一次。
 *
 * - 锁屏/系统媒体面板显示曲目信息（标题、社团、封面）与播放状态
 * - 受本地设置 mediaNotification 控制：关闭时释放会话（清空元数据、
 *   置 playbackState 'none'、注销处理器），重新开启自动恢复
 * - 动作处理器挂载时注册一次，全部经 getState() 读 store：
 *   快退/快进用用户自定义秒数（rewindSeekTime/forwardSeekTime），
 *   修改设置无需重注册
 * - 锁屏进度条（setPositionState）：OS 按最后 position+rate 自行插值，
 *   仅在切曲/seek/播放暂停切换及 ≥5s 漂移校正时推送，
 *   避免 250ms 高频推送（Linux MPRIS 等面板高频刷新会闪断封面）
 */
export function useMediaSession(): void {
  const queue = usePlayerStore((s) => s.queue);
  const queueIndex = usePlayerStore((s) => s.queueIndex);
  const playing = usePlayerStore((s) => s.playing);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const mediaNotification = useSettingsStore((s) => s.mediaNotification);

  const currentTrack = queue[queueIndex];

  /** 最近一次 setPositionState 推送快照（供插值与推送时机判断）。 */
  const posRef = useRef({ at: 0, pos: 0, dur: 0, rate: -1, pushed: 0 });

  // —— 动作处理器：挂载时注册一次（不支持的动作单独降级） ——

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;

    // 设置关闭时释放会话：注销处理器由 cleanup 完成，此处清空元数据并
    // 置 none 使通知消失（浏览器对播放中的音频可能仍显示极简控制，
    // 属浏览器自身行为，无法禁用）
    if (!mediaNotification) {
      ms.metadata = null;
      ms.playbackState = 'none';
      return;
    }

    const actions: Array<[MediaSessionAction, MediaSessionActionHandler]> = [
      ['play', () => usePlayerStore.getState().play()],
      ['pause', () => usePlayerStore.getState().pause()],
      ['previoustrack', () => usePlayerStore.getState().previousTrack()],
      ['nexttrack', () => usePlayerStore.getState().nextTrack()],
      [
        'seekbackward',
        () => {
          const { currentTime: t, rewindSeekTime } = usePlayerStore.getState();
          seekTo(Math.max(0, t - rewindSeekTime));
        },
      ],
      [
        'seekforward',
        () => {
          const { currentTime: t, forwardSeekTime } = usePlayerStore.getState();
          seekTo(t + forwardSeekTime);
        },
      ],
      [
        'seekto',
        (details) => {
          if (details.seekTime != null) seekTo(details.seekTime);
        },
      ],
    ];

    for (const [action, handler] of actions) {
      try {
        ms.setActionHandler(action, handler);
      } catch {
        // 浏览器不支持该动作（如 iOS Safari 的 seekto），静默降级
      }
    }

    return () => {
      for (const [action] of actions) {
        try {
          ms.setActionHandler(action, null);
        } catch {
          // 同上
        }
      }
    };
  }, [mediaNotification]);

  // —— 曲目元数据：切曲时更新（workId 缺失则无封面） ——

  useEffect(() => {
    if (!('mediaSession' in navigator) || !mediaNotification) return;
    if (!currentTrack) {
      navigator.mediaSession.metadata = null;
      return;
    }
    // artwork 用直连文件端点（/file），与全应用一致；
    // - 必须绝对 URL：Firefox/WebKit 对相对 artwork 地址有已知兼容问题
    // - 不声明 sizes：封面实际是非方形（main 约 560×420）且各作品比例不同，
    //   sizes 与实际像素不符时部分平台会丢弃 artwork 且不回退；
    //   缺省时平台自行嗅探（spec 中 sizes 仅为选择提示）
    const cover = (type: string) =>
      new URL(
        mediaUrl(`/api/cover/${currentTrack.workId}/file?type=${type}`),
        window.location.origin,
      ).href;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.workTitle,
      album: currentTrack.workTitle,
      artwork: currentTrack.workId
        ? [
            { src: cover('main'), type: 'image/jpeg' },
            { src: cover('sam'), type: 'image/jpeg' },
          ]
        : [],
    });
  }, [currentTrack, mediaNotification]);

  // —— 播放状态 ——

  useEffect(() => {
    if (!('mediaSession' in navigator) || !mediaNotification) return;
    navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
  }, [playing, mediaNotification]);

  // —— 锁屏进度条：OS 按最后 position + playbackRate 自行插值，稀疏推送 ——

  useEffect(() => {
    if (!('mediaSession' in navigator) || !mediaNotification) return;
    if (duration <= 0 || currentTime > duration) return;
    const last = posRef.current;
    const rate = playing ? 1 : 0;
    const now = performance.now();
    // 仅在以下时机推送：速率变化（播放/暂停）、时长变化（切曲）、
    // 与插值期望偏差 >1.5s（seek），以及 ≥5s 漂移校正
    const expected = last.pos + (last.rate * (now - last.at)) / 1000;
    if (
      last.rate === rate &&
      last.dur === duration &&
      Math.abs(currentTime - expected) <= 1.5 &&
      now - last.pushed < 5000
    ) {
      return;
    }
    try {
      // playbackRate 恒传 1：暂停态由 playbackState 表达，规范要求 rate > 0
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: 1,
        position: currentTime,
      });
      posRef.current = { at: now, pos: currentTime, dur: duration, rate, pushed: now };
    } catch {
      // duration 未就绪等非法参数，静默忽略
    }
  }, [currentTime, duration, playing, mediaNotification]);
}

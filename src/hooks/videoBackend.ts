/**
 * 视频播放后端：模块级 <video> 单例 + PlayerBackend 适配。
 *
 * 独立于 usePlayer.ts（后者 import 链经 WasmWvPlayer 引入 @m3e
 * Web Components，jsdom 测试环境无法加载；本模块零依赖可测）。
 *
 * 画面层（VideoSurface）通过 getVideoElement 拿到同一元素后
 * appendChild 到自身位置——移动 DOM 不中断播放；卸载时
 * parkVideoElement 归还隐藏容器，声音持续（折叠播放器=仅音频）。
 */
// type-only import：类型擦除，运行时不引入 WasmWvPlayer 的 @m3e 依赖链
import type { PlayerBackend } from '../wavpack/WasmWvPlayer';

/** 模块级 <video> 单例（懒创建），与 howl 同为后端级引用。 */
let videoEl: HTMLVideoElement | null = null;
let videoHost: HTMLElement | null = null;

/** 懒创建视频元素单例（playsInline + metadata 预载），默认托管在 body 下的隐藏容器。 */
export function getVideoElement(): HTMLVideoElement {
  if (videoEl) return videoEl;
  videoEl = document.createElement('video');
  videoEl.playsInline = true;
  videoEl.preload = 'metadata';
  if (document.body) {
    videoHost = document.createElement('div');
    videoHost.style.display = 'none';
    videoHost.dataset.videoPark = 'true';
    videoHost.appendChild(videoEl);
    document.body.appendChild(videoHost);
  }
  return videoEl;
}

/** 把视频元素移回隐藏容器（UI 卸载后画面层不再持有它，播放不中断）。 */
export function parkVideoElement(): void {
  if (videoEl && videoHost && videoEl.parentElement !== videoHost) {
    videoHost.appendChild(videoEl);
  }
}

/** <video> 元素适配为 PlayerBackend：方法签名对齐，三轨分流后统一驱动。 */
export function videoBackend(el: HTMLVideoElement): PlayerBackend {
  return {
    play: () => {
      void el.play();
    },
    pause: () => el.pause(),
    seek: (t) => {
      el.currentTime = t;
    },
    volume: (v) => {
      el.volume = Math.min(1, Math.max(0, v));
    },
    duration: () => (Number.isFinite(el.duration) ? el.duration : 0),
    currentTime: () => el.currentTime,
    playing: () => !el.paused,
    // 释放流引用：暂停 + 摘除 src 并重置（元素本身保留供下一支视频复用）
    unload: () => {
      el.pause();
      el.removeAttribute('src');
      el.load();
    },
  };
}

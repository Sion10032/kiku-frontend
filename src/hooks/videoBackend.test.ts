// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { videoBackend } from './videoBackend';

function makeVideo(): HTMLVideoElement {
  const el = document.createElement('video');
  el.setAttribute('src', 'http://localhost/api/media/RJ1/file');
  return el;
}

describe('videoBackend', () => {
  it('seek/volume/duration/currentTime 映射原生元素', () => {
    const el = makeVideo();
    Object.defineProperty(el, 'duration', {
      value: 120,
      configurable: true,
    });
    const b = videoBackend(el);
    b.seek(30);
    expect(el.currentTime).toBe(30);
    expect(b.currentTime()).toBe(30);
    b.volume(0.5);
    expect(el.volume).toBe(0.5);
    expect(b.duration()).toBe(120);
  });

  it('playing 反映 paused 状态', () => {
    const el = makeVideo();
    const b = videoBackend(el);
    expect(b.playing()).toBe(false);
    Object.defineProperty(el, 'paused', { value: false, configurable: true });
    expect(b.playing()).toBe(true);
  });

  it('play/pause 直通原生方法', () => {
    const el = makeVideo();
    const play = vi
      .spyOn(el, 'play')
      .mockImplementation(() => Promise.resolve());
    const pause = vi.spyOn(el, 'pause').mockImplementation(() => {});
    const b = videoBackend(el);
    b.play();
    b.pause();
    expect(play).toHaveBeenCalledTimes(1);
    expect(pause).toHaveBeenCalledTimes(1);
  });

  it('unload 释放流：pause + 移除 src + load()', () => {
    const el = makeVideo();
    const pause = vi.spyOn(el, 'pause').mockImplementation(() => {});
    const load = vi.spyOn(el, 'load').mockImplementation(() => {});
    const b = videoBackend(el);
    b.unload();
    expect(pause).toHaveBeenCalled();
    expect(load).toHaveBeenCalled();
    expect(el.getAttribute('src')).toBeNull();
  });
});

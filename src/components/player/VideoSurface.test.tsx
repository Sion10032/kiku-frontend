// @vitest-environment jsdom
import { beforeAll, afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { usePlayerStore } from '../../stores/playerStore';
import { getVideoElement } from '../../hooks/videoBackend';
import VideoSurface from './VideoSurface';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// jsdom 未实现媒体方法，stub 掉（挂载/卸载/点击路径不会真正播放）
beforeAll(() => {
  Object.defineProperty(HTMLMediaElement.prototype, 'play', {
    configurable: true,
    value: () => Promise.resolve(),
  });
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
    configurable: true,
    value: () => {},
  });
  Object.defineProperty(HTMLMediaElement.prototype, 'load', {
    configurable: true,
    value: () => {},
  });
});

describe('VideoSurface', () => {
  afterEach(() => {
    cleanup();
    usePlayerStore.setState({ playing: false });
  });

  it('挂载时把模块级 video 元素搬到宿主内，卸载时归还隐藏容器', () => {
    const video = getVideoElement();
    const { container, unmount } = render(<VideoSurface />);
    const host = container.firstElementChild as HTMLElement;
    // 同一元素被挂载到宿主内（画面即此元素，播放不因挂载中断）
    expect(host.contains(video)).toBe(true);
    unmount();
    // 归还隐藏容器（不在渲染树中），声音持续、画面随播放器收起
    expect(host.contains(video)).toBe(false);
    expect(document.body.contains(video)).toBe(true);
    expect(video.closest('[data-video-park]')).not.toBeNull();
  });

  it('点击宿主 toggle 播放/暂停', () => {
    const { container } = render(<VideoSurface />);
    const host = container.firstElementChild as HTMLElement;
    expect(usePlayerStore.getState().playing).toBe(false);
    fireEvent.click(host);
    expect(usePlayerStore.getState().playing).toBe(true);
    fireEvent.click(host);
    expect(usePlayerStore.getState().playing).toBe(false);
  });

  it('解码失败（error 事件）回退封面图与提示文案', () => {
    const video = getVideoElement();
    const { container } = render(<VideoSurface workId='RJ123' />);
    expect(screen.queryByText('player.video-unsupported')).toBeNull();
    fireEvent(video, new Event('error'));
    // 提示文案出现，video 元素被移出画面（隐藏而非删除，避免触发加载）
    expect(screen.getByText('player.video-unsupported')).not.toBeNull();
    expect((container.firstElementChild as HTMLElement).contains(video)).toBe(
      false,
    );
    // 封面图回退
    const img = container.querySelector('img');
    expect(img?.getAttribute('src')).toContain('/api/cover/RJ123/file');
  });
});

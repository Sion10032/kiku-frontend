// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePlayerStore } from '../../stores/playerStore';
import AudioPlayer from './AudioPlayer';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// onGesture 经共享容器暴露给测试（vi.mock 工厂不能引用外部变量，用 hoisted）
const gestureMocks = vi.hoisted(() => ({
  onGesture: undefined as
    | ((e: { detail: Record<string, unknown> }) => void)
    | undefined,
}));

// @m3e 组件在 jsdom 无法注册 custom elements，mock 成轻量转发组件（同
// NavDrawer.test 约定）；手势组件把绑定参数落到 data attribute 供断言
vi.mock('@m3e/react/gestures', () => ({
  M3eSwipeGesture: (props: {
    htmlFor?: string;
    directions?: readonly string[];
    onGesture?: (e: { detail: Record<string, unknown> }) => void;
  }) => {
    gestureMocks.onGesture = props.onGesture;
    return (
      <div
        data-testid='swipe-gesture'
        data-for={props.htmlFor}
        data-directions={props.directions?.join(' ')}
      />
    );
  },
}));

vi.mock('@m3e/react/icon-button', () => ({
  M3eIconButton: (props: {
    children?: React.ReactNode;
    onClick?: () => void;
    'aria-label'?: string;
  }) => (
    <button
      type='button'
      onClick={props.onClick}
      aria-label={props['aria-label']}
    >
      {props.children}
    </button>
  ),
}));

vi.mock('@m3e/react/icon', () => ({
  M3eIcon: (props: { name?: string }) => <span data-icon={props.name} />,
}));

vi.mock('@m3e/react/slider', () => ({
  M3eSlider: (props: { children?: React.ReactNode }) => (
    <div>{props.children}</div>
  ),
  M3eSliderThumb: () => null,
}));

// 图标 side-effect 导入（注册 custom element）在 jsdom 无法执行，置空
vi.mock('@m3e/icons/outlined/keyboard_arrow_down', () => ({}));
vi.mock('@m3e/icons/outlined/queue_music', () => ({}));
vi.mock('@m3e/icons/outlined/bedtime', () => ({}));
vi.mock('@m3e/icons/outlined/fast_rewind', () => ({}));
vi.mock('@m3e/icons/outlined/fast_forward', () => ({}));
vi.mock('@m3e/icons/outlined/skip_previous', () => ({}));
vi.mock('@m3e/icons/outlined/skip_next', () => ({}));
vi.mock('@m3e/icons/outlined/play_arrow', () => ({}));
vi.mock('@m3e/icons/outlined/pause', () => ({}));
vi.mock('@m3e/icons/outlined/playlist_play', () => ({}));
vi.mock('@m3e/icons/outlined/repeat', () => ({}));
vi.mock('@m3e/icons/outlined/repeat_one', () => ({}));
vi.mock('@m3e/icons/outlined/shuffle', () => ({}));
vi.mock('@m3e/icons/outlined/volume_up', () => ({}));
vi.mock('@m3e/icons/outlined/volume_off', () => ({}));
vi.mock('@m3e/icons/outlined/music_note', () => ({}));

// 渲染期不触碰播放引擎/子面板，mock 掉减少依赖面
vi.mock('../../hooks/usePlayer', () => ({ seekTo: () => {} }));
vi.mock('./SleepMode', () => ({ default: () => null }));
vi.mock('./QueueDialog', () => ({ default: () => null }));
vi.mock('./GainIndicator', () => ({ default: () => null }));
vi.mock('./LyricsPanel', () => ({
  default: () => <div data-testid='lyrics-panel' />,
}));

/** 注入一条带歌词的当前曲目并重置手势回调容器 */
function seedTrack() {
  usePlayerStore.setState({
    hide: false,
    queue: [{ hash: 'h1', title: 'Track A', workTitle: 'Work W', uid: 'q1' }],
    currentUid: 'q1',
    lyricLines: [{ start: 0, end: null, text: 'line 1' }],
  });
  gestureMocks.onGesture = undefined;
}

/** 派发一个手势事件 */
function fireGesture(detail: Record<string, unknown>) {
  gestureMocks.onGesture?.({ detail });
}

const initialStore = usePlayerStore.getState();

afterEach(() => {
  cleanup();
  usePlayerStore.setState(initialStore, true);
});

describe('AudioPlayer 封面下滑手势', () => {
  it('手势元素绑定封面 id 且仅识别 down 方向', () => {
    seedTrack();
    render(<AudioPlayer />);
    const gesture = screen.getByTestId('swipe-gesture');
    expect(gesture.dataset.for).toBe('player-cover');
    expect(gesture.dataset.directions).toBe('down');
    expect(document.getElementById('player-cover')).not.toBeNull();
  });

  it('下滑 end 触发收起（hide 翻转）', () => {
    seedTrack();
    render(<AudioPlayer />);
    expect(usePlayerStore.getState().hide).toBe(false);
    fireGesture({ phase: 'start' });
    fireGesture({ phase: 'end', direction: 'down' });
    expect(usePlayerStore.getState().hide).toBe(true);
  });

  it('非下滑方向 end 不收起', () => {
    seedTrack();
    render(<AudioPlayer />);
    fireGesture({ phase: 'start' });
    fireGesture({ phase: 'end', direction: 'up' });
    expect(usePlayerStore.getState().hide).toBe(false);
  });

  it('swipe 识别期抑制尾随 click 一次（不误切歌词视图），随后 click 恢复切换', () => {
    seedTrack();
    render(<AudioPlayer />);
    const cover = screen.getByRole('button', { name: 'player.show-lyrics' });

    // swipe start 置位 → 释放后的 click 应被吞掉，封面视图保持
    fireGesture({ phase: 'start' });
    fireGesture({ phase: 'end', direction: 'down' });
    fireEvent.click(cover);
    expect(cover.className).not.toContain('opacity-0');

    // 抑制只此一次：再次 click 正常切到歌词视图（封面层淡出）
    fireEvent.click(cover);
    expect(cover.className).toContain('opacity-0');
  });

  it('cancel 后 click 不被抑制（正常切歌词视图）', () => {
    seedTrack();
    render(<AudioPlayer />);
    const cover = screen.getByRole('button', { name: 'player.show-lyrics' });
    fireGesture({ phase: 'start' });
    fireGesture({ phase: 'cancel' });
    fireEvent.click(cover);
    expect(cover.className).toContain('opacity-0');
  });
});

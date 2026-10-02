// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePlayerStore } from '../../stores/playerStore';
import PlayerBar from './PlayerBar';

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
    onClick?: (e: unknown) => void;
    'aria-label'?: string;
    className?: string;
  }) => (
    <button
      type='button'
      onClick={(e) => props.onClick?.(e)}
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
vi.mock('@m3e/icons/outlined/play_arrow', () => ({}));
vi.mock('@m3e/icons/outlined/pause', () => ({}));
vi.mock('@m3e/icons/outlined/skip_previous', () => ({}));
vi.mock('@m3e/icons/outlined/skip_next', () => ({}));
vi.mock('@m3e/icons/outlined/queue_music', () => ({}));
vi.mock('@m3e/icons/outlined/music_note', () => ({}));
vi.mock('@m3e/icons/outlined/volume_up', () => ({}));
vi.mock('@m3e/icons/outlined/volume_off', () => ({}));

// 渲染期不触碰播放引擎/浮层，mock 掉减少依赖面
vi.mock('./ProgressBar', () => ({ default: () => null }));
vi.mock('./LyricsBar', () => ({ default: () => null }));
vi.mock('./GainIndicator', () => ({ default: () => null }));
vi.mock('./MarqueeText', () => ({
  default: (props: { text?: string }) => <span>{props.text}</span>,
}));
vi.mock('./QueueDialog', () => ({ default: () => null }));

/** 注入一条当前曲目（无 workId，走占位封面分支）并重置手势回调容器 */
function seedTrack() {
  usePlayerStore.setState({
    hide: true,
    queue: [{ hash: 'h1', title: 'Track A', workTitle: 'Work W', uid: 'q1' }],
    currentUid: 'q1',
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

describe('PlayerBar 信息区上滑手势', () => {
  it('手势元素绑定信息区 id 且仅识别 up 方向', () => {
    seedTrack();
    render(<PlayerBar />);
    const gesture = screen.getByTestId('swipe-gesture');
    expect(gesture.dataset.for).toBe('player-bar-info');
    expect(gesture.dataset.directions).toBe('up');
    expect(document.getElementById('player-bar-info')).not.toBeNull();
  });

  it('上滑 end 触发展开（hide 翻转）', () => {
    seedTrack();
    render(<PlayerBar />);
    expect(usePlayerStore.getState().hide).toBe(true);
    fireGesture({ phase: 'start' });
    fireGesture({ phase: 'end', direction: 'up' });
    expect(usePlayerStore.getState().hide).toBe(false);
  });

  it('非上滑方向 end 不展开', () => {
    seedTrack();
    render(<PlayerBar />);
    fireGesture({ phase: 'start' });
    fireGesture({ phase: 'end', direction: 'down' });
    expect(usePlayerStore.getState().hide).toBe(true);
  });

  it('swipe 展开后的尾随 click 被吞（不会立即又收起），随后 click 恢复切换', () => {
    seedTrack();
    render(<PlayerBar />);
    const info = screen.getByRole('button', { name: 'player.expand' });

    // 上滑展开 → 尾随 click 应被吞掉，hide 保持展开态
    fireGesture({ phase: 'start' });
    fireGesture({ phase: 'end', direction: 'up' });
    expect(usePlayerStore.getState().hide).toBe(false);
    fireEvent.click(info);
    expect(usePlayerStore.getState().hide).toBe(false);

    // 抑制只此一次：再次 click 正常收起
    fireEvent.click(info);
    expect(usePlayerStore.getState().hide).toBe(true);
  });
});

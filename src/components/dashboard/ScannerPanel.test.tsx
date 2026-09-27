// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ScannerPanel from './ScannerPanel';
import type { ScannerEvents } from './useScannerEvents';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// @m3e/web 组件在 jsdom 无法注册 custom elements，mock 成轻量转发组件
// （DetailDialog 关闭时自身 return null，不触达这些 mock 的渲染分支）
vi.mock('@m3e/react/icon', () => ({ M3eIcon: () => <span /> }));
vi.mock('@m3e/react/dialog', () => ({
  M3eDialog: (props: { open?: boolean; children?: ReactNode }) =>
    props.open ? <div>{props.children}</div> : null,
}));
vi.mock('@m3e/react/card', () => ({
  M3eCard: (props: { children?: ReactNode }) => <div>{props.children}</div>,
}));
vi.mock('@m3e/icons/outlined/check_circle', () => ({}));
vi.mock('@m3e/icons/outlined/error', () => ({}));
vi.mock('@m3e/icons/outlined/chevron_right', () => ({}));
vi.mock('@m3e/icons/outlined/play_arrow', () => ({}));

/** 构造面板 props（展示层不关心 start/kill 动作实现） */
function makeEv(overrides: Partial<ScannerEvents> = {}): ScannerEvents {
  return {
    state: 'idle',
    tasks: [],
    failedTasks: [],
    mainLogs: [],
    completedCount: 0,
    resultMessage: null,
    start: vi.fn(),
    kill: vi.fn(),
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

describe('ScannerPanel 空闲渲染', () => {
  it('idle：不输出任何 DOM（避免在页面 flex 布局中留下空 div 撑出多余 gap）', () => {
    const { container } = render(<ScannerPanel ev={makeEv()} />);
    expect(container.firstChild).toBeNull();
  });

  it('running：渲染指示器行', () => {
    const { container } = render(
      <ScannerPanel ev={makeEv({ state: 'running' })} />,
    );
    expect(container.querySelector('button')).not.toBeNull();
  });

  it('finished：渲染指示器行', () => {
    const { container } = render(
      <ScannerPanel ev={makeEv({ state: 'finished' })} />,
    );
    expect(container.querySelector('button')).not.toBeNull();
  });
});

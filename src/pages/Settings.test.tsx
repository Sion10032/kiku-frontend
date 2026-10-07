// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Settings from './Settings';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
// ../i18n 初始化依赖真实 react-i18next（已被 mock），一并替换
vi.mock('../i18n', () => ({ setLanguage: vi.fn() }));
// @m3e/web 组件在 jsdom 无法注册 custom elements，mock 成轻量转发组件；
// 卡片加 testid 供按序取用（页面卡片顺序即分组顺序）
vi.mock('@m3e/react/card', () => ({
  M3eCard: (props: { children?: ReactNode }) => (
    <div data-testid='card'>{props.children}</div>
  ),
}));
vi.mock('@m3e/react/switch', () => ({ M3eSwitch: () => null }));
vi.mock('@m3e/react/button', () => ({
  M3eButton: (props: { children?: ReactNode }) => (
    <button>{props.children}</button>
  ),
}));
vi.mock('@m3e/react/dialog', () => ({ M3eDialog: () => null }));
vi.mock('@m3e/react/form-field', () => ({
  M3eFormField: (props: { children?: ReactNode }) => (
    <div>{props.children}</div>
  ),
}));
vi.mock('@m3e/react/select', () => ({
  M3eSelect: (props: { children?: ReactNode }) => <div>{props.children}</div>,
}));
vi.mock('@m3e/react/option', () => ({
  M3eOption: (props: { children?: ReactNode }) => <div>{props.children}</div>,
}));
vi.mock('@m3e/react/snackbar', () => ({ M3eSnackbar: { open: () => {} } }));
// utils/theme 顶层 import '@m3e/web/theme' 会在 jsdom 注册样式表（adoptedStyleSheets）
vi.mock('../utils/theme', () => ({
  withThemeTransition: (update: () => void) => update(),
}));
vi.mock('@m3e/react/segmented-button', () => ({
  M3eSegmentedButton: (props: { children?: ReactNode }) => (
    <div>{props.children}</div>
  ),
  M3eButtonSegment: (props: { children?: ReactNode }) => (
    <div>{props.children}</div>
  ),
}));
vi.mock('@m3e/react/slider', () => ({
  M3eSlider: (props: { children?: ReactNode }) => <div>{props.children}</div>,
  M3eSliderThumb: () => null,
}));
vi.mock('../components/VersionCard', () => ({
  default: () => <div>version-card</div>,
}));

function renderSettings() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <Settings />
    </QueryClientProvider>,
  );
}

/** 页面卡片按 DOM 顺序：备份 → 外观 → 作品库 → 播放器 → 悬浮歌词 */
function cards(): HTMLElement[] {
  return screen.getAllByTestId('card');
}

afterEach(cleanup);

describe('Settings 分组', () => {
  it('外观卡：语言 / 颜色模式 / 界面大小 / 内容宽度 / 动态取色', () => {
    renderSettings();
    const g = within(cards()[1]);
    for (const key of [
      'settings.language',
      'settings.color-mode',
      'settings.ui-scale',
      'settings.content-width',
      'settings.dynamic-color',
    ]) {
      expect(g.getByText(key)).toBeTruthy();
    }
    // 不应混入其他组的设置项
    expect(g.queryByText('settings.r18-cover')).toBeNull();
    expect(g.queryByText('settings.loudness-normalization')).toBeNull();
  });

  it('作品库卡：R-18 封面 / 翻页方式 / 分页位置 / 每页数量 / 最近收听', () => {
    renderSettings();
    const g = within(cards()[2]);
    for (const key of [
      'settings.r18-cover',
      'settings.works-pagination',
      'settings.paginator-position',
      'settings.works-page-size',
      'settings.recent-listens',
    ]) {
      expect(g.getByText(key)).toBeTruthy();
    }
    expect(g.queryByText('settings.language')).toBeNull();
    expect(g.queryByText('settings.media-notification')).toBeNull();
  });

  it('播放器卡：时间显示 / 媒体通知 / 快退快进秒数 / 音量均衡', () => {
    renderSettings();
    const g = within(cards()[3]);
    for (const key of [
      'settings.time-display',
      'settings.media-notification',
      'settings.rewind-seek-time',
      'settings.forward-seek-time',
      'settings.loudness-normalization',
      'settings.loudness-target-lufs',
      'settings.loudness-max-gain-db',
    ]) {
      expect(g.getByText(key)).toBeTruthy();
    }
    expect(g.queryByText('settings.color-mode')).toBeNull();
    expect(g.queryByText('settings.floating-lyrics')).toBeNull();
  });

  it('悬浮歌词卡在播放器之后，子项完整（字体大小 / 行数上限 / 背景透明度）', () => {
    renderSettings();
    const g = within(cards()[4]);
    for (const key of [
      'settings.floating-lyrics',
      'settings.font-size',
      'settings.lines-limit',
      'settings.background-opacity',
    ]) {
      expect(g.getByText(key)).toBeTruthy();
    }
  });

  it('卡片顺序：备份 → 外观 → 作品库 → 播放器 → 悬浮歌词', () => {
    renderSettings();
    const list = cards();
    expect(within(list[0]).getByText('settings.backup-title')).toBeTruthy();
    expect(within(list[1]).getByText('settings.language')).toBeTruthy();
    expect(within(list[2]).getByText('settings.r18-cover')).toBeTruthy();
    expect(
      within(list[3]).getByText('settings.media-notification'),
    ).toBeTruthy();
    expect(within(list[4]).getByText('settings.floating-lyrics')).toBeTruthy();
  });
});

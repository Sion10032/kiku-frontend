// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Work } from '../../types';
import { useSettingsStore } from '../../stores/settingsStore';
import { useUserStore } from '../../stores/userStore';
import WorkDetails from './WorkDetails';

// ---- mock 状态（vi.hoisted 保证先于被提升的 vi.mock 工厂求值可用）----
const h = vi.hoisted(() => ({
  refreshMutate: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}));

// utils/theme 顶层 import '@m3e/web/theme' 会在 jsdom 注册样式表（adoptedStyleSheets）
vi.mock('../../utils/theme', () => ({
  getSeedColorForWork: () => Promise.resolve(null),
}));

vi.mock('../../queries/useFavouritesQuery', () => ({
  useFavouriteStatus: () => ({ data: undefined }),
}));

vi.mock('../../queries/useProgressMutation', () => ({
  useReadStateMutation: () => ({ isPending: false, mutate: vi.fn() }),
}));

vi.mock('../../queries/useWorkAdminMutation', () => ({
  useRefreshWorkMetadataMutation: () => ({
    isPending: false,
    mutate: h.refreshMutate,
  }),
  useSyncWorkTracksMutation: () => ({ isPending: false, mutate: vi.fn() }),
  useStartAnalysisMutation: () => ({ isPending: false, mutate: vi.fn() }),
  useSoftDeleteWorkMutation: () => ({ isPending: false, mutate: vi.fn() }),
}));

// 展示型子组件（shadow DOM / 重查询）与本测试无关，mock 成空实现
vi.mock('../common/CoverSFW', () => ({ default: () => <div /> }));
vi.mock('../common/WorkCircleSeriesLinks', () => ({ default: () => <div /> }));
vi.mock('../common/WorkFactsRow', () => ({ default: () => <div /> }));
vi.mock('../common/WorkChips', () => ({ default: () => <div /> }));
vi.mock('./WriteReview', () => ({ default: () => null }));
vi.mock('../favourites/FavDialog', () => ({ default: () => null }));
vi.mock('./MetadataEditDialog', () => ({ default: () => null }));

// @m3e/web 组件在 jsdom 无法注册 custom elements，mock 成轻量转发组件
// （同 ScannerPanel.test 惯例）：children 原样渲染即可覆盖菜单项断言。
vi.mock('@m3e/react/card', () => ({
  M3eCard: (props: { children?: ReactNode }) => <div>{props.children}</div>,
}));
vi.mock('@m3e/react/icon', () => ({ M3eIcon: () => <span /> }));
vi.mock('@m3e/react/icon-button', () => ({
  M3eIconButton: (props: {
    children?: ReactNode;
    'aria-label'?: string;
    title?: string;
    disabled?: boolean;
    className?: string;
    onClick?: (e: { currentTarget: EventTarget }) => void;
  }) => (
    <button
      type='button'
      aria-label={props['aria-label']}
      title={props.title}
      disabled={props.disabled}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  ),
}));
vi.mock('@m3e/react/menu', () => ({
  M3eMenu: (props: { children?: ReactNode }) => <div>{props.children}</div>,
  M3eMenuItem: (props: { children?: ReactNode }) => <div>{props.children}</div>,
}));
vi.mock('@m3e/react/dialog', () => ({ M3eDialog: () => null }));
vi.mock('@m3e/react/button', () => ({
  M3eButton: (props: { children?: ReactNode }) => (
    <button type='button'>{props.children}</button>
  ),
}));

vi.mock('@m3e/icons/outlined/favorite', () => ({}));
vi.mock('@m3e/icons/outlined/check_circle', () => ({}));
vi.mock('@m3e/icons/outlined/rate_review', () => ({}));
vi.mock('@m3e/icons/outlined/more_vert', () => ({}));
vi.mock('@m3e/icons/outlined/sync', () => ({}));
vi.mock('@m3e/icons/outlined/av_timer', () => ({}));
vi.mock('@m3e/icons/outlined/graphic_eq', () => ({}));
vi.mock('@m3e/icons/outlined/ssid_chart', () => ({}));
vi.mock('@m3e/icons/outlined/equalizer', () => ({}));
vi.mock('@m3e/icons/outlined/delete', () => ({}));
vi.mock('@m3e/icons/outlined/edit', () => ({}));
vi.mock('@m3e/icons/outlined/chat', () => ({}));
vi.mock('@m3e/icons/outlined/open_in_new', () => ({}));

function makeWork(overrides?: Partial<Work>): Work {
  return {
    id: 'RJ01173549',
    rootFolder: '/media',
    dir: 'RJ01173549',
    title: '作品标题',
    circle: { id: 'RG10001', name: '社团' },
    ageRating: 'all',
    release: null,
    dl_count: null,
    price: null,
    review_count: null,
    rate_count: null,
    rate_average_2dp: null,
    rate_count_detail: {},
    rank: null,
    tags: [],
    vas: [],
    series: null,
    userRating: null,
    userProgress: null,
    read: false,
    duration: null,
    loudnessLufs: null,
    loudnessTruePeakDb: null,
    ...overrides,
  };
}

/** 以管理员身份渲染（管理菜单仅管理员可见） */
function renderAsAdmin(work: Work) {
  useUserStore.setState({ auth: true, name: 'admin', group: 'administrator' });
  // 关闭动态取色：避免 effect 走 canvas 取色路径（jsdom 无 2d context）
  useSettingsStore.setState({ dynamicColor: false });
  return render(<WorkDetails work={work} />);
}

afterEach(() => {
  cleanup();
  useUserStore.setState({ auth: false, name: '', group: '' });
  useSettingsStore.setState({ dynamicColor: true });
});

describe('WorkDetails 管理菜单按来源条件渲染', () => {
  it('UW（manual）：不渲染「更新元数据」，其余菜单项照常', () => {
    renderAsAdmin(makeWork({ id: 'UW00000001' }));
    expect(screen.queryByText('works.menu-refresh-metadata')).toBeNull();
    expect(screen.getByText('works.menu-sync-tracks')).toBeTruthy();
  });

  it('RJ（dlsite）：仍渲染「更新元数据」', () => {
    renderAsAdmin(makeWork({ id: 'RJ01173549' }));
    expect(screen.getByText('works.menu-refresh-metadata')).toBeTruthy();
  });

  it('未知前缀（classify 为 null）：仍渲染「更新元数据」，不崩溃', () => {
    renderAsAdmin(makeWork({ id: 'ZZ00000001' }));
    expect(screen.getByText('works.menu-refresh-metadata')).toBeTruthy();
  });
});

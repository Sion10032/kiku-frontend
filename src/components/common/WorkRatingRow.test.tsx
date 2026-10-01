// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Work } from '../../types';
import WorkRatingRow from './WorkRatingRow';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// @m3e/web 组件在 jsdom 无法注册 custom elements，mock 成轻量转发组件
// （同 ScannerPanel.test 惯例）
vi.mock('@m3e/react/icon', () => ({ M3eIcon: () => <span /> }));
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

afterEach(() => {
  cleanup();
});

describe('WorkRatingRow 按来源条件渲染', () => {
  it('UW（manual）：无 DLsite 链接，无徽章', () => {
    render(<WorkRatingRow work={makeWork({ id: 'UW00000001' })} />);
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('RJ（dlsite）：仍渲染 DLsite 链接', () => {
    render(<WorkRatingRow work={makeWork({ id: 'RJ01173549' })} />);
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toContain('dlsite.com');
    expect(link.textContent).toContain('DLsite');
  });

  it('未知前缀（classify 为 null）：按 dlsite 路径渲染，不崩溃', () => {
    render(<WorkRatingRow work={makeWork({ id: 'ZZ00000001' })} />);
    expect(screen.getByRole('link')).toBeTruthy();
  });

  it('manual + userRating：星串主显，无 DLsite 链接', () => {
    render(
      <WorkRatingRow work={makeWork({ id: 'UW00000001', userRating: 4 })} />,
    );
    expect(screen.getByText('★★★★')).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('manual + 无 userRating：无任何 ★ 评分文本', () => {
    render(<WorkRatingRow work={makeWork({ id: 'UW00000001' })} />);
    expect(screen.queryByText(/★/)).toBeNull();
  });

  it('dlsite + userRating：用户星串主显 + DLsite 平均降为附注，链接照旧', () => {
    const { container } = render(
      <WorkRatingRow
        work={makeWork({
          rate_average_2dp: 4.5,
          rate_count: 123,
          userRating: 5,
        })}
      />,
    );
    expect(container.textContent).toContain('★★★★★');
    expect(container.textContent).toContain('★ 4.5 (123)');
    const link = screen.getByRole('link');
    expect(link.textContent).toContain('DLsite');
  });

  it('dlsite + 无 userRating：DLsite 平均主显（现状回归），无用户星串', () => {
    const { container } = render(
      <WorkRatingRow
        work={makeWork({ rate_average_2dp: 4.5, rate_count: 123 })}
      />,
    );
    expect(container.textContent).toContain('★ 4.5 (123)');
    expect(container.textContent).not.toContain('★★★★★');
    expect(screen.getByRole('link')).toBeTruthy();
  });
});

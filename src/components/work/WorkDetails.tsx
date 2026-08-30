import { Fragment, useEffect, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { M3eCard } from '@m3e/react/card';
import { M3eAssistChip, M3eChipSet } from '@m3e/react/chips';
import { M3eButton } from '@m3e/react/button';
import { M3eIcon } from '@m3e/react/icon';
import { M3eIconButton } from '@m3e/react/icon-button';
import '@m3e/icons/outlined/favorite';
import '@m3e/icons/outlined/star';
import '@m3e/icons/outlined/chat';
import '@m3e/icons/outlined/open_in_new';
import '@m3e/icons/outlined/mic';
import '@m3e/icons/outlined/library_books';
import type { Work } from '../../types';
import { useThemeStore, DEFAULT_SEED } from '../../stores/themeStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { getSeedColorForWork } from '../../utils/theme';
import CoverSFW from '../common/CoverSFW';
import { vaChipSetStyles } from '../common/chipStyles';
import { fieldQuery } from '../../utils/query';
import { useFavouriteStatus } from '../../queries/useFavouritesQuery';
import FavDialog from '../favourites/FavDialog';
import WriteReview from './WriteReview';

interface WorkDetailsProps {
  work: Work;
}

/**
 * 作品详情信息卡：封面、标题、社团、评分（平均分 + 分布）、价格/售出/发售日、
 * 标签、声优、DLsite 链接与「我的评价」入口。
 * 「我的评价」入口打开 WriteReview 对话框（星级 + 短评）。
 * 标题旁心形图标按钮是全页唯一收藏入口，打开 FavDialog 列出所有可收藏目标。
 */
export default function WorkDetails({ work }: WorkDetailsProps) {
  // 写评价对话框开关
  const [reviewOpen, setReviewOpen] = useState(false);
  // 收藏对话框开关
  const [favOpen, setFavOpen] = useState(false);
  // chip 点击跳转筛选（与 WorkCard 行为一致）
  const navigate = useNavigate();

  // 作品收藏状态（驱动标题旁心形；未登录自动 disabled）
  const workFav = useFavouriteStatus('work', [work.id]);

  // 动态取色：切换作品时从封面提取种子色，失败保持当前主题。
  // 设置中关闭动态取色时跳过提取并恢复默认色。
  // cancelled 守卫防止快速切换作品时旧请求晚到覆盖新主题；
  // 用 getState() 而非 hook 订阅，避免组件因 seed 变化重渲。
  useEffect(() => {
    const { dynamicColor } = useSettingsStore.getState();
    if (!dynamicColor) {
      useThemeStore.getState().setSeed(DEFAULT_SEED);
      return;
    }
    let cancelled = false;
    getSeedColorForWork(work.id).then((color) => {
      if (color && !cancelled) useThemeStore.getState().setSeed(color);
    });
    return () => {
      cancelled = true;
    };
  }, [work.id]);

  // 评分分布展示 JSX 暂被注释（原实现可从 git 历史/注释块恢复），
  // 对应 useMemo 因 noUnusedLocals 报错已移除。

  return (
    <Fragment>
      <M3eCard className='overflow-hidden [--m3e-card-padding:0px]'>
        <div slot='header' className='p-0'>
          <CoverSFW workId={work.id} nsfw={work.nsfw} release={work.release} />
        </div>

        <div slot='content' className='flex flex-col gap-3 p-4'>
          {/* 标题 + 收藏入口（心形图标按钮，打开 FavDialog） */}
          <div className='flex items-start justify-between gap-2'>
            <h1 className='m-0 min-w-0 text-xl font-normal leading-snug'>
              {work.title}
            </h1>
            <M3eIconButton aria-label='收藏' onClick={() => setFavOpen(true)}>
              <M3eIcon
                name='favorite'
                filled={workFav.data?.[work.id] === true}
                className={
                  workFav.data?.[work.id] === true
                    ? 'text-[var(--md-sys-color-primary)]'
                    : ''
                }
              />
            </M3eIconButton>
          </div>

          {/* 社团 */}
          <Link
            to='/works'
            search={{ q: fieldQuery('circle', work.circle.name) }}
            className='truncate text-sm no-underline opacity-70'
          >
            {work.circle.name}
          </Link>

          {/* 系列（单值归属信息，非 chips；样式与社团行一致，library_books 图标区分） */}
          {work.series && (
            <Link
              to='/works'
              search={{ q: fieldQuery('series', work.series.name) }}
              className='inline-flex items-center gap-1 truncate text-sm no-underline opacity-70'
            >
              <M3eIcon name='library_books' />
              {work.series.name}
            </Link>
          )}

          {/* 评分 / 评论 / DLsite */}
          <div className='flex flex-wrap items-center gap-x-3 gap-y-1 text-sm'>
            {work.rate_average_2dp != null && (
              <span className='font-medium text-(--md-sys-color-primary)'>
                ★ {work.rate_average_2dp.toFixed(1)}
                <span className='font-normal opacity-60'>
                  {' '}
                  ({work.rate_count ?? 0})
                </span>
              </span>
            )}
            {work.review_count != null && work.review_count > 0 && (
              <span className='inline-flex items-center gap-1 opacity-70'>
                <M3eIcon name='chat' />
                {work.review_count}
              </span>
            )}
            <a
              href={dlsiteUrl(work.id)}
              target='_blank'
              rel='noreferrer noopener'
              className='inline-flex items-center gap-0.5 no-underline text-(--md-sys-color-primary)'
            >
              DLsite
              <M3eIcon name='open_in_new' />
            </a>
          </div>

          {/* 评分分布 */}
          {/* {work.rate_count_detail &&
          Object.keys(work.rate_count_detail).length > 0 && (
            <div className="flex flex-col gap-1">
              {ratingDistribution.counts.map(({ point, count }) => (
                <div
                  key={point}
                  className="flex items-center gap-2 text-xs"
                >
                  <span className="w-8 shrink-0 text-right opacity-70">
                    {point}星
                  </span>
                  <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-(--md-sys-color-surface-container-high)">
                    <div
                      className="h-full rounded-full bg-(--md-sys-color-primary)"
                      style={{
                        width: `${(count / ratingDistribution.max) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="w-8 shrink-0 opacity-70">{count}</span>
                </div>
              ))}
            </div>
          )} */}

          {/* 价格 / 售出 / 发售日 */}
          <div className='flex flex-wrap items-center gap-x-3 gap-y-1 text-sm'>
            {work.price != null && (
              <span className='font-medium text-(--md-sys-color-error)'>
                {work.price} 日元
              </span>
            )}
            {work.dl_count != null && (
              <span className='opacity-70'>售出 {work.dl_count}</span>
            )}
            {work.release && <span className='opacity-70'>{work.release}</span>}
            {!work.nsfw && (
              <span className='rounded-sm bg-(--md-sys-color-primary-container) px-1.5 py-0.5 text-xs'>
                全年龄
              </span>
            )}
          </div>

          {/* 标签（ChipSet 样式与 WorkCard 一致） */}
          {work.tags.length > 0 && (
            <M3eChipSet className='density-1'>
              {work.tags.map((tag) => (
                <M3eAssistChip
                  key={tag.id}
                  variant='elevated'
                  onClick={() =>
                    navigate({
                      to: '/works',
                      search: { q: fieldQuery('tag', tag.name) },
                    })
                  }
                >
                  {tag.name}
                </M3eAssistChip>
              ))}
            </M3eChipSet>
          )}

          {/* 声优（主色容器 + mic 图标，与 WorkCard 一致） */}
          {work.vas.length > 0 && (
            <M3eChipSet className='density-1' style={vaChipSetStyles}>
              {work.vas.map((va) => (
                <M3eAssistChip
                  key={va.id}
                  variant='elevated'
                  onClick={() =>
                    navigate({
                      to: '/works',
                      search: { q: fieldQuery('va', va.name) },
                    })
                  }
                >
                  <M3eIcon slot='icon' name='mic' />
                  {va.name}
                </M3eAssistChip>
              ))}
            </M3eChipSet>
          )}

          {/* 我的评价入口（打开 WriteReview 对话框） */}
          <div className='mt-1'>
            <M3eButton variant='tonal' onClick={() => setReviewOpen(true)}>
              {work.userRating != null
                ? `我的评价：${'★'.repeat(work.userRating)}`
                : '写评价'}
            </M3eButton>
          </div>
        </div>
      </M3eCard>

      {/**
       * WriteReview 必须渲染在 M3eCard 外部——M3eCard 有 shadow DOM，
       * <dialog> showModal() 在 shadow DOM 内会导致焦点陷阱冲突，页面卡死。
       */}
      <WriteReview
        work={work}
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
      />

      {/**
       * FavDialog 与 WriteReview 同理：必须渲染在 M3eCard 外部，
       * 避免嵌在 shadow DOM 内的 <dialog> 焦点陷阱冲突。
       */}
      <FavDialog open={favOpen} onClose={() => setFavOpen(false)} work={work} />
    </Fragment>
  );
}

/** DLsite 作品页链接（与 WorkCard 保持一致；id 为完整 RJ code） */
function dlsiteUrl(workId: string): string {
  return `https://www.dlsite.com/home/work/=/product_id/${workId}.html`;
}

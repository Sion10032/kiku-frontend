import { Fragment, useEffect, useState } from 'react';
import { M3eCard } from '@m3e/react/card';
import { M3eButton } from '@m3e/react/button';
import { M3eIcon } from '@m3e/react/icon';
import { M3eIconButton } from '@m3e/react/icon-button';
import '@m3e/icons/outlined/favorite';
import type { Work } from '../../types';
import { useThemeStore, DEFAULT_SEED } from '../../stores/themeStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { getSeedColorForWork } from '../../utils/theme';
import CoverSFW from '../common/CoverSFW';
import WorkCircleSeriesLinks from '../common/WorkCircleSeriesLinks';
import WorkRatingRow from '../common/WorkRatingRow';
import WorkFactsRow from '../common/WorkFactsRow';
import WorkChips from '../common/WorkChips';
import { useUserStore } from '../../stores/userStore';
import { useFavouriteStatus } from '../../queries/useFavouritesQuery';
import FavDialog from '../favourites/FavDialog';
import WriteReview from './WriteReview';

interface WorkDetailsProps {
  work: Work;
}

/**
 * 作品详情信息卡：封面（右上分级徽章、右下播放进度）、标题、社团 · 系列、
 * 评分/评论/DLsite 行、价格/售出/发售日行、标签、声优、
 * 操作行（「我的评价」+ 收藏心形）。
 * 元信息行由 common/ 下的 Work* 共享组件提供（与 WorkCard 一致）。
 * 操作行心形图标按钮是全页唯一收藏入口，打开 FavDialog 列出所有可收藏目标。
 */
export default function WorkDetails({ work }: WorkDetailsProps) {
  // 写评价对话框开关
  const [reviewOpen, setReviewOpen] = useState(false);
  // 收藏对话框开关
  const [favOpen, setFavOpen] = useState(false);

  // 作品收藏状态（驱动操作行心形；未登录自动 disabled）
  const workFav = useFavouriteStatus('work', [work.id]);
  // 匿名零侵入：未登录不渲染收藏入口（匿名用户不应看到任何收藏 UI）
  const auth = useUserStore((s) => s.auth);

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
          <CoverSFW
            workId={work.id}
            ageRating={work.ageRating}
            progress={work.userProgress}
            duration={work.duration}
          />
        </div>

        <div slot='content' className='flex flex-col gap-3 p-4'>
          {/* 标题 */}
          <h1 className='m-0 min-w-0 text-xl font-normal leading-snug'>
            {work.title}
          </h1>

          <WorkCircleSeriesLinks work={work} />

          <WorkRatingRow work={work} />

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

          {/* 详情页显示发售日（卡片不显示，封面右下角已有） */}
          <WorkFactsRow work={work} release={work.release} />

          <WorkChips work={work} />

          {/* 我的评价 + 收藏入口（操作行并排；心形打开 FavDialog） */}
          <div className='mt-1 flex items-center gap-2'>
            <M3eButton variant='tonal' onClick={() => setReviewOpen(true)}>
              {work.userRating != null
                ? `我的评价：${'★'.repeat(work.userRating)}`
                : '写评价'}
            </M3eButton>
            {auth && (
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
            )}
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

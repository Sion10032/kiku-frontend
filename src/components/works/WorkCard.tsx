import { Link } from '@tanstack/react-router';
import clsx from 'clsx';
import { M3eCard } from '@m3e/react/card';
import type { Work } from '../../types';
import CoverSFW from '../common/CoverSFW';
import WorkCircleSeriesLinks from '../common/WorkCircleSeriesLinks';
import WorkRatingRow from '../common/WorkRatingRow';
import WorkFactsRow from '../common/WorkFactsRow';
import WorkChips from '../common/WorkChips';

interface WorkCardProps {
  work: Work;
  /** 缩略图模式（隐藏文字详情，仅封面 + 标题） */
  thumbnail?: boolean;
}

/**
 * 作品卡片（网格视图）。
 *
 * 展示：封面（右上分级徽章、右下播放进度）、标题、社团 · 系列、
 * 评分（平均分 + 评分人数）、评论数、DLsite 链接、价格、售出数、标签、声优。
 * 元信息行由 common/ 下的 Work* 共享组件提供（与 WorkDetails 一致）。
 */
export default function WorkCard({ work, thumbnail = false }: WorkCardProps) {
  // m3e-card 的 slot 边距全部来自 --m3e-card-padding（默认 16px）：
  // 非媒体 header（header slot 直接子节点非 img/video）会被 shadow DOM
  // 加上 margin-inline/block-start 导致封面占不满卡片宽度，此即本卡片的
  // 场景（封面需要 Link 包裹跳转/R18 模糊/回退，无法用裸 img 入 slot）。
  // 归零变量后由 content/actions 自行补边距，封面即可铺满全宽。
  const cardVars = thumbnail ? '' : '[--m3e-card-padding:0px]';

  return (
    <M3eCard className={clsx('h-full', cardVars)}>
      <div slot='header' className='relative p-0'>
        <CoverSFW
          workId={work.id}
          ageRating={work.ageRating}
          progress={work.userProgress}
          duration={work.duration}
        />
      </div>

      {!thumbnail && (
        <div slot='content' className='flex flex-col gap-2 p-4'>
          <Link
            to='/work/$id'
            params={{ id: work.id }}
            className='line-clamp-2 text-lg font-normal no-underline'
          >
            {work.title}
          </Link>

          <WorkCircleSeriesLinks work={work} />

          <WorkRatingRow work={work} />

          {/* 卡片不显示发售日（封面已有），详情页才显示 */}
          <WorkFactsRow work={work} />

          <WorkChips work={work} />
        </div>
      )}
    </M3eCard>
  );
}

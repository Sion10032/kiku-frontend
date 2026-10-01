import { M3eIcon } from '@m3e/react/icon';
import '@m3e/icons/outlined/chat';
import '@m3e/icons/outlined/open_in_new';
import type { Work } from '../../types';
import { dlsiteUrl } from '../../utils/dlsite';
import { classifyWorkSource } from '../../utils/workId';

interface WorkRatingRowProps {
  work: Work;
}

/** 评分 / 评论数 / DLsite 链接行（WorkCard / WorkDetails 共用）。 */
export default function WorkRatingRow({ work }: WorkRatingRowProps) {
  // 人工作品没有 DLsite 页面，不渲染外链
  const isManual = classifyWorkSource(work.id) === 'manual';
  return (
    <div className='flex flex-wrap items-center gap-x-3 gap-y-1 text-sm'>
      {/* 用户评分主显（DLsite 平均降为小字附注） */}
      {work.userRating != null && (
        <span className='font-medium text-(--md-sys-color-primary)'>
          {'★'.repeat(work.userRating)}
        </span>
      )}
      {work.userRating != null && work.rate_average_2dp != null && (
        <span className='font-normal opacity-60'>
          ★ {work.rate_average_2dp.toFixed(1)} ({work.rate_count ?? 0})
        </span>
      )}
      {/* 平均评分（无用户评分时的现状渲染） */}
      {work.userRating == null && work.rate_average_2dp != null && (
        <span className='font-medium text-(--md-sys-color-primary)'>
          ★ {work.rate_average_2dp.toFixed(1)}
          <span className='font-normal opacity-60'>
            {' '}
            ({work.rate_count ?? 0})
          </span>
        </span>
      )}
      {/* 评论数 */}
      {work.review_count != null && work.review_count > 0 && (
        <span className='inline-flex items-center gap-1 opacity-70'>
          <M3eIcon name='chat' />
          {work.review_count}
        </span>
      )}
      {/* DLsite 链接（人工作品为「手动」徽章） */}
      {!isManual && (
        <a
          href={dlsiteUrl(work.id)}
          target='_blank'
          rel='noreferrer noopener'
          className='inline-flex items-center gap-0.5 no-underline text-(--md-sys-color-primary)'
        >
          DLsite
          <M3eIcon name='open_in_new' />
        </a>
      )}
    </div>
  );
}

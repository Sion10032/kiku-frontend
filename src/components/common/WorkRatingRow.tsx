import { M3eIcon } from '@m3e/react/icon';
import '@m3e/icons/outlined/chat';
import '@m3e/icons/outlined/open_in_new';
import { useTranslation } from 'react-i18next';
import type { Work } from '../../types';
import { dlsiteUrl } from '../../utils/dlsite';
import { classifyWorkSource } from '../../utils/workId';

interface WorkRatingRowProps {
  work: Work;
}

/** 评分 / 评论数 / DLsite 链接行（WorkCard / WorkDetails 共用）。 */
export default function WorkRatingRow({ work }: WorkRatingRowProps) {
  const { t } = useTranslation();
  // 人工作品没有 DLsite 页面，链接换成「手动」徽章
  const isManual = classifyWorkSource(work.id) === 'manual';
  return (
    <div className='flex flex-wrap items-center gap-x-3 gap-y-1 text-sm'>
      {/* 平均评分 */}
      {work.rate_average_2dp != null && (
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
      {isManual ? (
        <span className='opacity-70'>{t('works.manual-badge')}</span>
      ) : (
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

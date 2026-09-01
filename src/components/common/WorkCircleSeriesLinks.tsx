import { Link } from '@tanstack/react-router';
import type { Work } from '../../types';
import { fieldQuery } from '../../utils/query';

interface WorkCircleSeriesLinksProps {
  work: Work;
}

/**
 * 社团 · 系列链接行（WorkCard / WorkDetails 共用）。
 *
 * 系列显示在社团右侧并以「·」分隔；无系列时仅显示社团。
 * 点击跳转 /works 对应字段筛选。
 */
export default function WorkCircleSeriesLinks({
  work,
}: WorkCircleSeriesLinksProps) {
  return (
    <div className='flex min-w-0 items-center gap-x-1 text-sm'>
      <Link
        to='/works'
        search={{ q: fieldQuery('circle', work.circle.name) }}
        className='min-w-0 truncate no-underline opacity-70'
      >
        {work.circle.name}
      </Link>
      {work.series && (
        <>
          <span className='opacity-70'>·</span>
          <Link
            to='/works'
            search={{ q: fieldQuery('series', work.series.name) }}
            className='min-w-0 truncate no-underline opacity-70'
          >
            {work.series.name}
          </Link>
        </>
      )}
    </div>
  );
}

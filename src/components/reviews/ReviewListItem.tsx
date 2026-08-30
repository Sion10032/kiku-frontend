import { useNavigate } from '@tanstack/react-router';
import { M3eListItem } from '@m3e/react/list';
import { M3eIcon } from '@m3e/react/icon';
import '@m3e/icons/outlined/star';
import type { Review, Work } from '../../types';
import CoverThumbnail from '../common/CoverThumbnail';

interface ReviewListItemProps {
  work: Work;
  review: Review;
}

/**
 * 我的评价列表项：封面 + 标题 + 社团/声优/发售日 + 评价星 + 短评。
 * （自原 favourites/FavListItem 迁移；手动进度标记已随收藏重构移除。）
 */
export default function ReviewListItem({ work, review }: ReviewListItemProps) {
  const navigate = useNavigate();
  const openWork = () => navigate({ to: '/work/$id', params: { id: work.id } });
  const rating = review.rating ?? 0;

  return (
    <M3eListItem onClick={openWork}>
      <span slot='leading'>
        <CoverThumbnail workId={work.id} />
      </span>

      <div className='min-w-0 flex-1'>
        <div className='line-clamp-2 text-base'>{work.title}</div>

        <div className='mt-1 flex flex-wrap items-center gap-x-2 text-sm opacity-70'>
          <span>{work.circle.name}</span>
          {work.release && <span>{work.release}</span>}
          {work.vas.map((va) => (
            <span key={va.id} className='text-[var(--md-sys-color-primary)]'>
              {va.name}
            </span>
          ))}
        </div>

        {rating > 0 && (
          <div className='mt-1 flex items-center text-[var(--md-sys-color-primary)]'>
            {[1, 2, 3, 4, 5].map((n) => (
              <M3eIcon
                key={n}
                name='star'
                filled={n <= rating}
                className={n <= rating ? '' : 'opacity-25'}
              />
            ))}
            <span className='ms-1 text-sm opacity-70'>{rating}/5</span>
          </div>
        )}

        {review.reviewText && (
          <p className='mt-2 mb-0 whitespace-pre-wrap rounded-sm bg-[var(--md-sys-color-surface-container)] px-3 py-2 text-sm opacity-80'>
            {review.reviewText}
          </p>
        )}
      </div>

      {review.updatedAt && (
        <span slot='trailing' className='text-xs opacity-60'>
          {new Date(review.updatedAt).toLocaleDateString('zh-CN')}
        </span>
      )}
    </M3eListItem>
  );
}

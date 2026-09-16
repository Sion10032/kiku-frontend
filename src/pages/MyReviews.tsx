import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { M3eList } from '@m3e/react/list';
import { M3eCircularProgressIndicator } from '@m3e/react/progress-indicator';
import { useUserStore } from '../stores/userStore';
import { useReviewsByUser, useWorkMap } from '../queries/useReviewsQuery';
import ReviewListItem from '../components/reviews/ReviewListItem';
import type { Review, Work } from '../types';

/**
 * 我的评价页（/my-reviews）：当前用户全部评价，按评价时间倒序。
 * 数据链路与原收藏页评价视图一致：reviews → useWorkMap 批量拉详情（共享
 * ['work', id] 缓存避免 N+1）→ join 后成行。
 */
export default function MyReviews() {
  const { t } = useTranslation();
  const name = useUserStore((s) => s.name);
  const authed = useUserStore((s) => s.auth);
  const reviewsQuery = useReviewsByUser(name || undefined);
  const reviews = useMemo(() => reviewsQuery.data ?? [], [reviewsQuery.data]);

  const workIds = useMemo(() => reviews.map((r) => r.workId), [reviews]);
  const { works, isPending: worksPending } = useWorkMap(workIds);

  const rows = useMemo(() => {
    const list: { review: Review; work: Work }[] = [];
    for (const review of reviews) {
      const work = works.get(review.workId);
      if (work) list.push({ review, work });
    }
    list.sort((a, b) =>
      (b.review.updatedAt ?? '').localeCompare(a.review.updatedAt ?? ''),
    );
    return list;
  }, [reviews, works]);

  const loading = reviewsQuery.isPending || worksPending;
  const isError = reviewsQuery.isError;

  // 未登录整页早退：评价是私密数据，useReviewsByUser 在未登录（无用户名）
  // 时被禁用（query 恒 pending），放行到数据分支会无限转圈；对齐 History
  // 页的未登录分支。
  if (!authed) {
    return (
      <div className='mx-auto max-w-3xl py-16 text-center'>
        <p className='text-base opacity-60'>
          {t('works.my-reviews.login-required')}
        </p>
        <Link
          to='/login'
          className='mt-4 inline-block text-m3-primary no-underline'
        >
          {t('works.my-reviews.go-login')}
        </Link>
      </div>
    );
  }

  return (
    <div className='mx-auto max-w-3xl'>
      <h1 className='m-0 mb-4 text-xl'>{t('works.my-reviews.title')}</h1>

      {loading && (
        <div className='flex justify-center py-12'>
          <M3eCircularProgressIndicator />
        </div>
      )}

      {!loading && isError && (
        <div className='py-16 text-center opacity-60'>
          {t('works.load-failed-retry')}
        </div>
      )}

      {!loading && !isError && rows.length > 0 && (
        <M3eList>
          {rows.map(({ review, work }) => (
            <ReviewListItem key={work.id} work={work} review={review} />
          ))}
        </M3eList>
      )}

      {!loading && !isError && rows.length === 0 && (
        <div className='py-16 text-center opacity-60'>
          {t('works.my-reviews.empty')}
        </div>
      )}
    </div>
  );
}

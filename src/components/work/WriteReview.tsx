import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { M3eDialog } from '@m3e/react/dialog';
import { M3eButton } from '@m3e/react/button';
import { M3eFormField } from '@m3e/react/form-field';
import { M3eSnackbar } from '@m3e/react/snackbar';
import { useUserStore } from '../../stores/userStore';
import { useReviewsByUser } from '../../queries/useReviewsQuery';
import {
  useReviewMutation,
  useDeleteReviewMutation,
} from '../../queries/useReviewMutation';
import StarRating from '../common/StarRating';
import type { Work } from '../../types';

interface WriteReviewProps {
  work: Work;
  /** 对话框是否打开（M3eDialog 受控 open 属性） */
  open: boolean;
  /** 关闭回调（点取消 / 提交或删除成功 / 点 backdrop 或关闭按钮时触发） */
  onClose: () => void;
}

/**
 * 写评价对话框（M3eDialog）：
 * 星级（StarRating）+ 短评（M3eFormField 包裹 textarea）。
 *
 * - 打开时用已有评价回显（rating / 短评），数据来自
 *   useReviewsByUser（与收藏页共享缓存）。
 * - 提交调 PUT /api/review，删除调 DELETE /api/review；成功后
 *   invalidate works/work/reviews 并关闭对话框。
 */
export default function WriteReview({ work, open, onClose }: WriteReviewProps) {
  const { t } = useTranslation();
  const name = useUserStore((s) => s.name);
  const reviewMutation = useReviewMutation();
  const deleteMutation = useDeleteReviewMutation();

  // 当前用户对该作品的已有评价（回显 rating/短评）
  const reviewsQuery = useReviewsByUser(name || undefined);
  const existing = reviewsQuery.data?.find((r) => r.workId === work.id);

  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');

  // 仅在「打开」的瞬间用已有评价初始化表单，避免查询完成或输入过程中被重置
  const prevOpen = useRef(false);
  useEffect(() => {
    if (open && !prevOpen.current) {
      setRating(work.userRating ?? existing?.rating ?? 0);
      setReviewText(existing?.reviewText ?? '');
    }
    prevOpen.current = open;
  }, [open, work.userRating, existing?.rating, existing?.reviewText]);

  const loading = reviewMutation.isPending || deleteMutation.isPending;
  const hasExisting = existing != null || work.userRating != null;

  async function onSubmit() {
    if (loading) return;
    try {
      await reviewMutation.mutateAsync({
        work_id: work.id,
        rating: rating > 0 ? rating : undefined,
        review_text: reviewText.trim() ? reviewText.trim() : undefined,
      });
      M3eSnackbar.open(t('works.review.saved'));
      onClose();
    } catch (err) {
      M3eSnackbar.open(
        err instanceof Error ? err.message : t('works.review.save-failed'),
      );
    }
  }

  async function onDelete() {
    if (loading) return;
    try {
      await deleteMutation.mutateAsync(work.id);
      M3eSnackbar.open(t('works.review.deleted'));
      onClose();
    } catch (err) {
      M3eSnackbar.open(
        err instanceof Error ? err.message : t('works.review.delete-failed'),
      );
    }
  }

  return (
    <M3eDialog
      open={open}
      onClosed={onClose}
      dismissible
      closeLabel={t('common.close')}
    >
      <span slot='header'>{t('works.my-rating')}</span>

      <div className='flex flex-col gap-4 py-2'>
        {/* 星级 */}
        <div className='flex items-center justify-between gap-3'>
          <span className='text-sm opacity-70'>{t('works.review.rating')}</span>
          <StarRating value={rating} onChange={setRating} size='2rem' />
        </div>

        {/* 短评 */}
        <M3eFormField variant='outlined'>
          <label slot='label' htmlFor='review-text'>
            {t('works.review.comment-optional')}
          </label>
          <textarea
            id='review-text'
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            rows={3}
            maxLength={500}
            className='w-full resize-none border-none bg-transparent py-2 text-sm outline-none'
          />
        </M3eFormField>
      </div>

      {/* 底部操作：左侧删除（已有评价时显示），右侧取消 / 确定 */}
      <div slot='actions' className='flex items-center justify-between'>
        <div>
          {hasExisting && (
            <M3eButton
              variant='text'
              className='text-[var(--md-sys-color-error)]'
              disabled={loading}
              onClick={onDelete}
            >
              {deleteMutation.isPending
                ? t('works.review.deleting')
                : t('works.review.delete')}
            </M3eButton>
          )}
        </div>
        <div className='flex gap-2'>
          <M3eButton variant='text' disabled={loading} onClick={onClose}>
            {t('common.cancel')}
          </M3eButton>
          <M3eButton variant='filled' disabled={loading} onClick={onSubmit}>
            {reviewMutation.isPending
              ? t('works.meta.saving')
              : t('works.review.ok')}
          </M3eButton>
        </div>
      </div>
    </M3eDialog>
  );
}

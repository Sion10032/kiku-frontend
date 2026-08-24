import { useEffect, useRef, useState } from 'react';
import { M3eDialog } from '@m3e/react/dialog';
import { M3eButton } from '@m3e/react/button';
import { M3eFormField } from '@m3e/react/form-field';
import { M3eSelect, type M3eSelectElement } from '@m3e/react/select';
import { M3eOption } from '@m3e/react/option';
import { M3eSnackbar } from '@m3e/react/snackbar';
import { useUserStore } from '../../stores/userStore';
import { useReviewsByUser } from '../../queries/useReviewsQuery';
import {
  useReviewMutation,
  useDeleteReviewMutation,
} from '../../queries/useReviewMutation';
import StarRating from '../common/StarRating';
import { PROGRESS_LABELS } from '../../constants';
import type { Progress, Work } from '../../types';

/** 进度选项顺序（与 PROGRESS_LABELS 同源）。 */
const PROGRESS_ORDER: Progress[] = [
  'marked',
  'listening',
  'listened',
  'replay',
  'postponed',
];

interface WriteReviewProps {
  work: Work;
  /** 对话框是否打开（M3eDialog 受控 open 属性） */
  open: boolean;
  /** 关闭回调（点取消 / 提交或删除成功 / 点 backdrop 或关闭按钮时触发） */
  onClose: () => void;
}

/**
 * 写评价对话框（M3eDialog）：
 * 星级（StarRating）+ 短评（M3eFormField 包裹 textarea）+ 收听进度（M3eSelect）。
 *
 * - 打开时用已有评价回显（rating / progress / 短评），数据来自
 *   useReviewsByUser（与收藏页共享缓存）。
 * - 提交调 PUT /api/review，删除调 DELETE /api/review；成功后
 *   invalidate works/work/reviews 并关闭对话框。
 */
export default function WriteReview({ work, open, onClose }: WriteReviewProps) {
  const name = useUserStore(s => s.name);
  const reviewMutation = useReviewMutation();
  const deleteMutation = useDeleteReviewMutation();

  // 当前用户对该作品的已有评价（回显 rating/progress/短评）
  const reviewsQuery = useReviewsByUser(name || undefined);
  const existing = reviewsQuery.data?.find(r => r.workId === work.id);

  const [ rating, setRating ] = useState(0);
  const [ reviewText, setReviewText ] = useState('');
  const [ progress, setProgress ] = useState<Progress | ''>('');

  // 仅在「打开」的瞬间用已有评价初始化表单，避免查询完成或输入过程中被重置
  const prevOpen = useRef(false);
  useEffect(() => {
    if (open && !prevOpen.current) {
      setRating(work.userRating ?? existing?.rating ?? 0);
      setReviewText(existing?.reviewText ?? '');
      setProgress(existing?.progress ?? '');
    }
    prevOpen.current = open;
  }, [
    open,
    work.userRating,
    existing?.rating,
    existing?.reviewText,
    existing?.progress,
  ]);

  const loading = reviewMutation.isPending || deleteMutation.isPending;
  const hasExisting = existing != null || work.userRating != null;

  function onProgressChange(e: Event) {
    const value = (e.target as M3eSelectElement).value as string | null;
    setProgress(value === null ? '' : (value as Progress));
  }

  async function onSubmit() {
    if (loading) return;
    try {
      await reviewMutation.mutateAsync({
        work_id: work.id,
        rating: rating > 0 ? rating : undefined,
        review_text: reviewText.trim() ? reviewText.trim() : undefined,
        progress: progress || undefined,
      });
      M3eSnackbar.open('评价已保存');
      onClose();
    }
    catch (err) {
      M3eSnackbar.open(
        err instanceof Error ? err.message : '保存失败，请稍后重试',
      );
    }
  }

  async function onDelete() {
    if (loading) return;
    try {
      await deleteMutation.mutateAsync(work.id);
      M3eSnackbar.open('评价已删除');
      onClose();
    }
    catch (err) {
      M3eSnackbar.open(
        err instanceof Error ? err.message : '删除失败，请稍后重试',
      );
    }
  }

  return (
    <M3eDialog open={open} onClosed={onClose} dismissible closeLabel='关闭'>
      <span slot='header'>我的评价</span>

      <div className='flex flex-col gap-4 py-2'>
        {/* 星级 */}
        <div className='flex items-center justify-between gap-3'>
          <span className='text-sm opacity-70'>评分</span>
          <StarRating value={rating} onChange={setRating} size='2rem' />
        </div>

        {/* 短评 */}
        <M3eFormField variant='outlined'>
          <label slot='label' htmlFor='review-text'>
            短评（可选）
          </label>
          <textarea
            id='review-text'
            value={reviewText}
            onChange={e => setReviewText(e.target.value)}
            rows={3}
            maxLength={500}
            className='w-full resize-none border-none bg-transparent py-2 text-sm outline-none' />
        </M3eFormField>

        {/* 收听进度 */}
        <M3eFormField variant='outlined' hideSubscript='always'>
          <label slot='label' htmlFor='review-progress'>
            收听进度
          </label>
          <M3eSelect id='review-progress' onChange={onProgressChange}>
            {PROGRESS_ORDER.map(value => (
              <M3eOption
                key={value}
                value={value}
                selected={progress === value}>
                {PROGRESS_LABELS[value]}
              </M3eOption>
            ))}
          </M3eSelect>
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
              onClick={onDelete}>
              {deleteMutation.isPending ? '删除中…' : '删除评价'}
            </M3eButton>
          )}
        </div>
        <div className='flex gap-2'>
          <M3eButton variant='text' disabled={loading} onClick={onClose}>
            取消
          </M3eButton>
          <M3eButton variant='filled' disabled={loading} onClick={onSubmit}>
            {reviewMutation.isPending ? '保存中…' : '确定'}
          </M3eButton>
        </div>
      </div>
    </M3eDialog>
  );
}

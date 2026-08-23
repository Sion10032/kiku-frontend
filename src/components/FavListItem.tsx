import { useNavigate } from '@tanstack/react-router';
import { M3eListItem } from '@m3e/react/list';
import { M3eIcon } from '@m3e/react/icon';
import { M3eChip } from '@m3e/react/chips';
import '@m3e/icons/outlined/star';
import type { Progress, Review, Work } from '../types';
import CoverThumbnail from './CoverThumbnail';

/** 进度状态 → 中文标签（对齐原 kikoeru-quasar 的进度筛选文案）。 */
export const PROGRESS_LABELS: Record<Progress, string> = {
  marked: '想听',
  listening: '在听',
  listened: '听过',
  replay: '重听',
  postponed: '搁置',
};

interface FavListItemProps {
  work: Work;
  /** 当前用户对该作品的评价（含 rating / progress / reviewText）。 */
  review?: Review;
  /** 列表所处模式：review 显示评价星 + 短评，progress 突出进度标记。 */
  mode: 'review' | 'progress';
}

/**
 * 收藏页列表项：封面 + 标题 + 社团/声优/发售日 + 评价星 + 进度标记 + 短评。
 *
 * m3e named slot（leading/trailing）只对直接子元素生效——导航用
 * onClick + useNavigate，不把 slot 元素包进 <Link>（见注意事项 15）。
 */
export default function FavListItem({ work, review, mode }: FavListItemProps) {
  const navigate = useNavigate();
  const openWork = () => navigate({ to: '/work/$id', params: { id: work.id } });

  // 提前取出（闭包内 TS 不会保留可选属性访问的窄化）
  const rating = review?.rating ?? 0;
  const progress = review?.progress ?? null;

  return (
    <M3eListItem onClick={openWork}>
      <span slot="leading">
        <CoverThumbnail workId={work.id} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="line-clamp-2 text-base">{work.title}</div>

        {/* 社团 / 发售日 / 声优 */}
        <div className="mt-1 flex flex-wrap items-center gap-x-2 text-sm opacity-70">
          <span>{work.circle.name}</span>
          {work.release && <span>{work.release}</span>}
          {work.vas.map((va) => (
            <span key={va.id} className="text-[var(--md-sys-color-primary)]">
              {va.name}
            </span>
          ))}
        </div>

        {/* 评价星（已评分为 1-5 时显示） */}
        {rating > 0 && (
          <div className="mt-1 flex items-center text-[var(--md-sys-color-primary)]">
            {[1, 2, 3, 4, 5].map((n) => (
              <M3eIcon
                key={n}
                name="star"
                filled={n <= rating}
                className={n <= rating ? '' : 'opacity-25'}
              />
            ))}
            <span className="ms-1 text-sm opacity-70">{rating}/5</span>
          </div>
        )}

        {/* 进度标记 */}
        {progress && (
          <div className="mt-1">
            <M3eChip>{PROGRESS_LABELS[progress]}</M3eChip>
          </div>
        )}

        {/* 短评（评价视图） */}
        {mode === 'review' && review?.reviewText && (
          <p className="mt-2 mb-0 whitespace-pre-wrap rounded-sm bg-[var(--md-sys-color-surface-container)] px-3 py-2 text-sm opacity-80">
            {review.reviewText}
          </p>
        )}
      </div>

      {review?.updatedAt && (
        <span slot="trailing" className="text-xs opacity-60">
          {new Date(review.updatedAt).toLocaleDateString('zh-CN')}
        </span>
      )}
    </M3eListItem>
  );
}

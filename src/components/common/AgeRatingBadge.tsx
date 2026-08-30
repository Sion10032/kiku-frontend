import clsx from 'clsx';
import type { AgeRating } from '../../types';

/** 年龄分级 → 徽章文案与配色（MD3 container 色，token 由 @m3e/web 主题提供）。 */
const AGE_RATING_BADGE: Record<
  AgeRating,
  { label: string; className: string }
> = {
  all: {
    label: '全年龄',
    className:
      'bg-(--md-sys-color-primary-container) text-(--md-sys-color-on-primary-container)',
  },
  r15: {
    label: 'R-15',
    className:
      'bg-(--md-sys-color-secondary-container) text-(--md-sys-color-on-secondary-container)',
  },
  r18: {
    label: 'R18',
    className:
      'bg-(--md-sys-color-error-container) text-(--md-sys-color-on-error-container)',
  },
};

/** 年龄分级徽章（全年龄 / R-15 / R18）。 */
export default function AgeRatingBadge({ rating }: { rating: AgeRating }) {
  const badge = AGE_RATING_BADGE[rating];
  return (
    <span className={clsx('rounded-sm px-1.5 py-0.5 text-xs', badge.className)}>
      {badge.label}
    </span>
  );
}

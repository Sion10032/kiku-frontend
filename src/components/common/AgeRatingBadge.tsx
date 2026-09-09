import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import type { AgeRating } from '../../types';

/** 年龄分级 → 徽章 key 与配色（MD3 container 色，token 由 @m3e/web 主题提供）。 */
const AGE_RATING_BADGE: Record<
  AgeRating,
  {
    labelKey:
      | 'works.age-rating-all'
      | 'works.age-rating-r15'
      | 'works.age-rating-r18';
    className: string;
  }
> = {
  all: {
    labelKey: 'works.age-rating-all',
    className:
      'bg-(--md-sys-color-primary-container) text-(--md-sys-color-on-primary-container)',
  },
  r15: {
    labelKey: 'works.age-rating-r15',
    className:
      'bg-(--md-sys-color-secondary-container) text-(--md-sys-color-on-secondary-container)',
  },
  r18: {
    labelKey: 'works.age-rating-r18',
    className:
      'bg-(--md-sys-color-error-container) text-(--md-sys-color-on-error-container)',
  },
};

/** 年龄分级徽章（全年龄 / R-15 / R18）。 */
export default function AgeRatingBadge({ rating }: { rating: AgeRating }) {
  const { t } = useTranslation();
  const badge = AGE_RATING_BADGE[rating];
  return (
    <span className={clsx('rounded-sm px-1.5 py-0.5 text-xs', badge.className)}>
      {t(badge.labelKey)}
    </span>
  );
}

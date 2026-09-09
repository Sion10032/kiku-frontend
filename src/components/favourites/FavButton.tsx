import { M3eIcon } from '@m3e/react/icon';
import { M3eIconButton } from '@m3e/react/icon-button';
import { useTranslation } from 'react-i18next';
import '@m3e/icons/outlined/favorite';
import { useFavouriteMutation } from '../../queries/useFavouritesQuery';
import type { FavouriteTargetType } from '../../types';

interface FavButtonProps {
  targetType: FavouriteTargetType;
  targetId: string;
  /** 当前是否已收藏；undefined 时组件不渲染（未登录 / 状态未注入） */
  favourited: boolean | undefined;
  /** sm：列表行 / chip 旁小号；md：默认（卡片角标、详情页标题旁） */
  size?: 'sm' | 'md';
}

/**
 * 收藏心形按钮（作品 / 系列 / 声优 / 社团通用）。
 *
 * - favourited 由调用方注入（页面级 useFavouriteStatus 批量查询，避免逐项请求）
 * - 点击内部 stopPropagation：嵌在列表行 / 卡片内不触发行级导航
 * - 状态切换走 useFavouriteMutation（乐观更新，红心即时翻转）
 */
export default function FavButton({
  targetType,
  targetId,
  favourited,
  size = 'md',
}: FavButtonProps) {
  const { t } = useTranslation();
  const mutation = useFavouriteMutation();
  if (favourited === undefined) return null;

  return (
    <M3eIconButton
      aria-label={favourited ? t('common.unfavourite') : t('works.favourite')}
      disabled={mutation.isPending}
      className={size === 'sm' ? 'text-sm' : ''}
      onClick={(e: Event) => {
        e.stopPropagation();
        mutation.mutate({ targetType, targetId, favourited: !favourited });
      }}
    >
      <M3eIcon
        name='favorite'
        filled={favourited}
        className={favourited ? 'text-[var(--md-sys-color-primary)]' : ''}
      />
    </M3eIconButton>
  );
}

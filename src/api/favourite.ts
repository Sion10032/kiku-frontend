import { apiFetch } from './client';
import type {
  FavouriteItem,
  FavouriteStatusMap,
  FavouriteTargetType,
} from '../types';

/** 当前用户收藏列表：GET /api/favourites（targetType 可省 = 全部） */
export function getFavourites(
  targetType?: FavouriteTargetType,
): Promise<{ favourites: FavouriteItem[] }> {
  return apiFetch<{ favourites: FavouriteItem[] }>('favourites', {
    searchParams: targetType ? { targetType } : {},
  });
}

/** 批量查询是否已收藏：GET /api/favourites/status?targetType=&ids=a,b,c */
export function getFavouriteStatus(
  targetType: FavouriteTargetType,
  ids: string[],
): Promise<FavouriteStatusMap> {
  return apiFetch<FavouriteStatusMap>('favourites/status', {
    searchParams: { targetType, ids: ids.join(',') },
  });
}

/** 收藏：POST /api/favourites（幂等；目标不存在抛 404 HTTPError） */
export function addFavourite(
  targetType: FavouriteTargetType,
  targetId: string,
): Promise<{ favourited: boolean }> {
  return apiFetch<{ favourited: boolean }>('favourites', {
    method: 'POST',
    json: { targetType, targetId },
  });
}

/** 取消收藏：DELETE /api/favourites/:targetType/:targetId */
export function removeFavourite(
  targetType: FavouriteTargetType,
  targetId: string,
): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(
    `favourites/${targetType}/${encodeURIComponent(targetId)}`,
    { method: 'DELETE' },
  );
}

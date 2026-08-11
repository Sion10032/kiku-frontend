import Placeholder from './Placeholder';

export type FavouritesRoute = 'review' | 'progress' | 'folder';
export type FavouritesProgress =
  | 'not-started'
  | 'in-progress'
  | 'done';

interface FavouritesProps {
  route: FavouritesRoute;
  status?: FavouritesProgress;
}

/** 收藏/评价页。步骤 10 实现：FavListItem + 评价/进度筛选。 */
export default function Favourites({ route, status }: FavouritesProps) {
  const suffix = route === 'progress' && status ? ` (${status})` : '';
  return <Placeholder title={`收藏${suffix}`} />;
}

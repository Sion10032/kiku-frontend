import { useNavigate } from '@tanstack/react-router';
import { M3eTabs, M3eTab } from '@m3e/react/tabs';
import { M3eList, M3eListItem } from '@m3e/react/list';
import { M3eIcon } from '@m3e/react/icon';
import { M3eCircularProgressIndicator } from '@m3e/react/progress-indicator';
import '@m3e/icons/outlined/group';
import '@m3e/icons/outlined/mic';
import '@m3e/icons/outlined/library_books';
import '@m3e/icons/outlined/chevron_right';
import { useFavourites } from '../queries/useFavouritesQuery';
import CoverThumbnail from '../components/common/CoverThumbnail';
import { fieldQuery } from '../utils/query';
import { isEntityTarget, type FavouriteTargetType } from '../types';

export type FavouritesTab = 'works' | 'series' | 'vas' | 'circles';

/** 顶部 Tab：值即 /favourites/$tab 路由参数。 */
const TABS: { value: FavouritesTab; label: string }[] = [
  { value: 'works', label: '作品' },
  { value: 'series', label: '系列' },
  { value: 'vas', label: '声优' },
  { value: 'circles', label: '社团' },
];

const TAB_TO_TYPE: Record<FavouritesTab, FavouriteTargetType> = {
  works: 'work',
  series: 'series',
  vas: 'va',
  circles: 'circle',
};

const ENTITY_ICONS = {
  series: 'library_books',
  vas: 'mic',
  circles: 'group',
} as const;

/** 实体行点击 → /works 的 LQL 字段名（对齐 fieldQuery 支持的字段） */
const ENTITY_FIELDS = {
  series: 'series',
  vas: 'va',
  circles: 'circle',
} as const;

type EntityTab = Exclude<FavouritesTab, 'works'>;

function isEntityTab(tab: FavouritesTab): tab is EntityTab {
  return tab !== 'works';
}

/**
 * 收藏页（重构后）：收藏的作品 / 系列 / 声优 / 社团 四视图。
 *
 * 数据：GET /api/favourites?targetType=...（后端已过滤目标已消失的收藏，
 * 按收藏时间倒序）。作品行点击进详情；实体行点击按名称筛选作品库。
 */
export default function Favourites({ tab }: { tab: FavouritesTab }) {
  const navigate = useNavigate();
  const query = useFavourites(TAB_TO_TYPE[tab]);
  const items = query.data?.favourites ?? [];

  return (
    <div className='mx-auto max-w-3xl'>
      <h1 className='m-0 mb-4 text-xl'>收藏</h1>

      <M3eTabs stretch className='mb-4'>
        {TABS.map((t) => (
          <M3eTab
            key={t.value}
            selected={tab === t.value}
            onClick={() =>
              navigate({ to: '/favourites/$tab', params: { tab: t.value } })
            }
          >
            {t.label}
          </M3eTab>
        ))}
      </M3eTabs>

      {query.isPending && (
        <div className='flex justify-center py-12'>
          <M3eCircularProgressIndicator />
        </div>
      )}

      {!query.isPending && query.isError && (
        <div className='py-16 text-center opacity-60'>加载失败，请稍后重试</div>
      )}

      {!query.isPending && !query.isError && items.length > 0 && (
        <M3eList>
          {items.map((item) => {
            // 提取为 const 以便类型收窄在 onClick 闭包内保持有效
            const target = item.target;
            if (isEntityTarget(target) && isEntityTab(tab)) {
              return (
                <M3eListItem
                  key={`${item.targetType}:${item.targetId}`}
                  onClick={() =>
                    navigate({
                      to: '/works',
                      search: {
                        q: fieldQuery(ENTITY_FIELDS[tab], target.name),
                      },
                    })
                  }
                >
                  <span slot='leading' className='flex items-center opacity-60'>
                    <M3eIcon name={ENTITY_ICONS[tab]} />
                  </span>
                  <div className='min-w-0 flex-1'>
                    <div className='truncate text-base'>{target.name}</div>
                    <div className='mt-1 text-sm opacity-70'>
                      {target.workCount} 部作品
                    </div>
                  </div>
                  <span
                    slot='trailing'
                    className='flex items-center opacity-50'
                  >
                    <M3eIcon name='chevron_right' />
                  </span>
                </M3eListItem>
              );
            }
            if (!isEntityTarget(target) && !isEntityTab(tab)) {
              return (
                <M3eListItem
                  key={`${item.targetType}:${item.targetId}`}
                  onClick={() =>
                    navigate({
                      to: '/work/$id',
                      params: { id: target.id },
                    })
                  }
                >
                  <span slot='leading'>
                    <CoverThumbnail workId={target.id} />
                  </span>
                  <div className='min-w-0 flex-1'>
                    <div className='line-clamp-2 text-base'>{target.title}</div>
                    <div className='mt-1 text-sm opacity-70'>
                      {target.circleName}
                    </div>
                  </div>
                </M3eListItem>
              );
            }
            return null;
          })}
        </M3eList>
      )}

      {!query.isPending && !query.isError && items.length === 0 && (
        <div className='py-16 text-center opacity-60'>
          还没有收藏。在作品、系列、声优、社团页面点击 ♡ 即可收藏
        </div>
      )}
    </div>
  );
}

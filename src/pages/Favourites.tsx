import { useNavigate } from '@tanstack/react-router';
import { M3eTabs, M3eTab } from '@m3e/react/tabs';
import { M3eActionList, M3eListAction } from '@m3e/react/list';
import { M3eIcon } from '@m3e/react/icon';
import { M3eCircularProgressIndicator } from '@m3e/react/progress-indicator';
import '@m3e/icons/outlined/album';
import '@m3e/icons/outlined/group';
import '@m3e/icons/outlined/mic';
import '@m3e/icons/outlined/library_books';
import '@m3e/icons/outlined/chevron_right';
import { useFavourites } from '../queries/useFavouritesQuery';
import { fieldQuery } from '../utils/query';
import { useM3eListActionStyle } from '../hooks/useM3eListActionStyle';
import type { CssInput } from '../utils/css';
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
 * 注入内层 m3e-list-item-button 的 .content 样式：内容区弹性收缩并允许
 * 内部截断（长标题横向溢出的根因是 .content 的 min-width:auto）。
 */
const contentStyle = {
  '.content': {
    flex: '1 !important',
    minWidth: 0,
  },
} satisfies CssInput;

/** 收藏行（对齐 List 页行结构）：图标 + 单行标题 + supporting-text 副行 + chevron。 */
function FavRow({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon: string;
  title: string;
  subtitle?: string;
  onClick: () => void;
}) {
  const ref = useM3eListActionStyle({ buttonStyle: contentStyle });

  return (
    <M3eListAction ref={ref} onClick={onClick}>
      <span slot='leading' className='me-3 flex items-center opacity-60'>
        <M3eIcon name={icon} />
      </span>
      <span className='block truncate'>{title}</span>
      {subtitle && (
        <span slot='supporting-text' className='truncate text-xs opacity-60'>
          {subtitle}
        </span>
      )}
      <span slot='trailing' className='flex items-center opacity-50'>
        <M3eIcon name='chevron_right' />
      </span>
    </M3eListAction>
  );
}

/**
 * 收藏页（重构后）：收藏的作品 / 系列 / 声优 / 社团 四视图。
 *
 * 数据：GET /api/favourites?targetType=...（后端已过滤目标已消失的收藏，
 * 按收藏时间倒序）。行结构对齐 List 页：图标 + 单行截断标题 +
 * supporting-text 副行 + trailing chevron。作品行点击进详情；
 * 实体行点击按名称筛选作品库。
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
        <M3eActionList
          style={
            {
              '--m3e-list-item-container-shape': 'calc(infinity * 1px)',
              '--m3e-list-item-hover-container-shape': 'calc(infinity * 1px)',
            } as React.CSSProperties
          }
        >
          {items.map((item) => {
            const target = item.target;
            // 作品行：album 图标 + 标题 + 社团名，点击进详情
            if (!isEntityTarget(target) && !isEntityTab(tab)) {
              const { id, title, circleName } = target;
              return (
                <FavRow
                  key={`${item.targetType}:${item.targetId}`}
                  icon='album'
                  title={title}
                  subtitle={circleName}
                  onClick={() => navigate({ to: '/work/$id', params: { id } })}
                />
              );
            }
            // 实体行：类型图标 + 名称 + 在库作品数，点击按名称筛选作品库
            if (isEntityTarget(target) && isEntityTab(tab)) {
              const { name, workCount } = target;
              return (
                <FavRow
                  key={`${item.targetType}:${item.targetId}`}
                  icon={ENTITY_ICONS[tab]}
                  title={name}
                  subtitle={`${workCount} 部作品`}
                  onClick={() =>
                    navigate({
                      to: '/works',
                      search: {
                        q: fieldQuery(ENTITY_FIELDS[tab], name),
                      },
                    })
                  }
                />
              );
            }
            return null;
          })}
        </M3eActionList>
      )}

      {!query.isPending && !query.isError && items.length === 0 && (
        <div className='py-16 text-center opacity-60'>
          还没有收藏。在作品、系列、声优、社团页面点击 ♡ 即可收藏
        </div>
      )}
    </div>
  );
}

import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from '@tanstack/react-router';
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
import { useUserStore } from '../stores/userStore';
import { fieldQuery } from '../utils/query';
import { useM3eListActionStyle } from '../hooks/useM3eListActionStyle';
import type { CssInput } from '../utils/css';
import { isEntityTarget, type FavouriteTargetType } from '../types';

export type FavouritesTab = 'works' | 'series' | 'vas' | 'circles';

/** 顶部 Tab：值即 /favourites/$tab 路由参数；label 为 i18n key（渲染处 t()）。 */
const TABS: {
  value: FavouritesTab;
  label:
    | 'works.fav-tab-works'
    | 'works.fav-tab-series'
    | 'works.fav-tab-vas'
    | 'works.fav-tab-circles';
}[] = [
  { value: 'works', label: 'works.fav-tab-works' },
  { value: 'series', label: 'works.fav-tab-series' },
  { value: 'vas', label: 'works.fav-tab-vas' },
  { value: 'circles', label: 'works.fav-tab-circles' },
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
  const { t } = useTranslation();
  const navigate = useNavigate();
  const authed = useUserStore((s) => s.auth);
  const query = useFavourites(TAB_TO_TYPE[tab]);
  const items = query.data?.favourites ?? [];

  // 未登录整页早退：收藏是私密数据，useFavourites 在未登录时被禁用（query
  // 恒 pending），放行到数据分支会无限转圈；对齐 History 页的未登录分支。
  if (!authed) {
    return (
      <div className='mx-auto max-w-3xl py-16 text-center'>
        <p className='text-base opacity-60'>
          {t('works.favourites.login-required')}
        </p>
        <Link
          to='/login'
          className='mt-4 inline-block text-m3-primary no-underline'
        >
          {t('works.favourites.go-login')}
        </Link>
      </div>
    );
  }

  return (
    <div className='mx-auto max-w-3xl'>
      <h1 className='m-0 mb-4 text-xl'>{t('works.favourites.title')}</h1>

      <M3eTabs stretch className='mb-4'>
        {TABS.map((item) => (
          <M3eTab
            key={item.value}
            selected={tab === item.value}
            onClick={() =>
              navigate({
                to: '/favourites/$tab',
                params: { tab: item.value },
              })
            }
          >
            {t(item.label)}
          </M3eTab>
        ))}
      </M3eTabs>

      {query.isPending && (
        <div className='flex justify-center py-12'>
          <M3eCircularProgressIndicator />
        </div>
      )}

      {!query.isPending && query.isError && (
        <div className='py-16 text-center opacity-60'>
          {t('works.load-failed-retry')}
        </div>
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
                  subtitle={t('works.fav-work-count', { count: workCount })}
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
          {t('works.favourites.empty')}
        </div>
      )}
    </div>
  );
}

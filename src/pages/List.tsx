import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { useVirtualizer } from '@tanstack/react-virtual';
import { M3eSearchBar } from '@m3e/react/search';
import { M3eIcon } from '@m3e/react/icon';
import { M3eListAction } from '@m3e/react/list';
import { M3eCircularProgressIndicator } from '@m3e/react/progress-indicator';
import '@m3e/icons/outlined/search';
import '@m3e/icons/outlined/chevron_right';
import '@m3e/icons/outlined/group';
import '@m3e/icons/outlined/label';
import '@m3e/icons/outlined/mic';
import '@m3e/icons/outlined/library_books';
import { useMainScrollRef } from '../contexts/mainScroll';
import { useScrollTopOnMount } from '../hooks/useScrollTopOnMount';
import { useEntityListQuery, type ListType } from '../queries/useListQuery';
import { fieldQuery } from '../utils/query';
import PageContainer from '../components/common/PageContainer';
import FavButton from '../components/favourites/FavButton';
import { useUserStore } from '../stores/userStore';
import type { Circle, FavouriteTargetType, Series, Tag, Va } from '../types';

export type { ListType };

/** 列表类型 → i18n label key（works.list-*，渲染处 t()）。 */
const LABELS: Record<
  ListType,
  | 'works.list-circles'
  | 'works.list-tags'
  | 'works.list-vas'
  | 'works.list-series'
> = {
  circles: 'works.list-circles',
  tags: 'works.list-tags',
  vas: 'works.list-vas',
  series: 'works.list-series',
};

const LEADING_ICONS: Record<ListType, string> = {
  circles: 'group',
  tags: 'label',
  vas: 'mic',
  series: 'library_books',
};

/** 列表项跳转 /works 携带的筛选 search 参数（对齐 worksRoute 的 validateSearch）。 */
type EntitySearch = { q: string };

interface Entry {
  key: string;
  name: string;
  /** 生效口径在库作品数（实体列表响应内联，无作品为 0） */
  workCount: number;
  /** 列表响应内联的收藏状态；tag 恒为 undefined（不支持收藏 → 隐藏红心） */
  favourited: boolean | undefined;
  search: EntitySearch;
}

/**
 * 社团 / 标签 / 声优 / 系列 列表页。
 *
 * - useEntityListQuery(type) 按 type 只发一个请求（其余类型不请求），
 *   circles/vas/series 响应内联当前用户 favourited（匿名全 false）
 * - m3e SearchBar 输入即筛（客户端按名称过滤）
 * - 点击项跳转 /works 并携带筛选参数：q = fieldQuery(field, name) 生成的 LQL 查询文本
 * - 列表虚拟滚动（@tanstack/react-virtual）：数据源无分页、可达数千条，
 *   只挂载可视区±overscan 行，避免全量创建 Web Component（每行 m3e-list-action
 *   内含 state-layer/focus-ring/ripple 子组件）导致的首渲卡顿与输入逐键全量重渲；
 *   放弃 m3e-action-list 容器（roving tabindex 键盘导航对未挂载行无意义），
 *   行圆角 shape 变量移到虚拟容器上（CSS 变量继承等效）
 *
 * 注意：M3eListItem 的 named slot（leading/trailing）只对直接子元素生效，
 * 因此导航用 onClick + useNavigate 而非把 slot 元素包进 <Link>。
 */
export default function List({ type }: { type: ListType }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const label = t(LABELS[type]);
  const [keyword, setKeyword] = useState('');
  const auth = useUserStore((s) => s.auth);

  const query = useEntityListQuery(type);

  // 列表项 + 跳转 search 参数（按 type 构建；导航用 onClick，见组件注释）
  const entries = useMemo<Entry[]>(() => {
    const kw = keyword.trim().toLowerCase();
    const match = (name: string) => !kw || name.toLowerCase().includes(kw);
    const rows = query.data;
    if (!rows) return [];
    // 按类型分支收窄联合类型（rows 的类型随 queryKey 变化，TS 无法自动关联）
    if (type === 'circles') {
      return (rows as Circle[])
        .filter((c) => match(c.name))
        .map((c) => ({
          key: c.id,
          name: c.name,
          workCount: c.workCount ?? 0,
          favourited: c.favourited,
          search: { q: fieldQuery('circle', c.name) },
        }));
    }
    if (type === 'tags') {
      return (rows as Tag[])
        .filter((t) => match(t.name))
        .map((t) => ({
          key: String(t.id),
          name: t.name,
          workCount: t.workCount ?? 0,
          favourited: undefined, // 标签不支持收藏
          search: { q: fieldQuery('tag', t.name) },
        }));
    }
    if (type === 'series') {
      return (rows as Series[])
        .filter((s) => match(s.name))
        .map((s) => ({
          key: s.id,
          name: s.name,
          workCount: s.workCount ?? 0,
          favourited: s.favourited,
          search: { q: fieldQuery('series', s.name) },
        }));
    }
    return (rows as Va[])
      .filter((v) => match(v.name))
      .map((v) => ({
        key: v.id,
        name: v.name,
        workCount: v.workCount ?? 0,
        favourited: v.favourited,
        search: { q: fieldQuery('va', v.name) },
      }));
  }, [type, query.data, keyword]);

  // 挂载/切换实体类型时把滚动容器归零：路由切换不重置 <main> scrollTop，
  // 有缓存时列表瞬间撑高，残留位置会被钳到底部；须声明在 useVirtualizer
  // 之前，让其初始化读到归零后的 offset（见 useScrollTopOnMount 注释）
  useScrollTopOnMount(type);
  // 虚拟滚动：页面滚动容器是 MainLayout 的 <main>（非 window），经 context 下发；
  // 独立渲染（单测）时为 null，react-virtual 对 null 安全跳过（不渲染行）
  const scrollRef = useMainScrollRef();
  // 行高：单行 truncate，实测恒 56px；measureElement 动态校准（uiScale 等）
  const ROW_HEIGHT = 56;
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual 官方 API 即如此（返回实例函数不可 memo），字面量 options 为官方推荐用法
  const rowVirtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    // 偏大 overscan：列表上方有标题 + 搜索栏，滚动偏移按滚动容器顶计算，
    // 多渲染十几行覆盖这段偏移，省去 scrollMargin 测量状态
    overscan: 12,
  });

  // 标签不支持收藏； favourited 已内联在列表响应里，未登录传 undefined 隐藏红心
  const favType: FavouriteTargetType | null =
    type === 'circles'
      ? 'circle'
      : type === 'vas'
        ? 'va'
        : type === 'series'
          ? 'series'
          : null;

  const { isLoading: loading, isError, data } = query;
  const total = data?.length ?? 0;

  return (
    <PageContainer base='narrow'>
      <div className='mb-4'>
        <h1 className='m-0 text-xl'>
          {label}
          {!loading && total > 0 && (
            <span className='ml-2 text-base opacity-60'>({total})</span>
          )}
        </h1>
      </div>

      {/* 搜索（客户端过滤；m3e SearchBar 的 input 由调用方提供） */}
      <M3eSearchBar
        clearable
        className='mb-4 block w-full'
        onClear={() => setKeyword('')}
      >
        <M3eIcon slot='leading' name='search' />
        <input
          slot='input'
          type='text'
          placeholder={t('works.list-search-placeholder', { label })}
          value={keyword}
          onInput={(e) => setKeyword((e.target as HTMLInputElement).value)}
        />
      </M3eSearchBar>

      {/* 加载中 */}
      {loading && (
        <div className='flex justify-center py-12'>
          <M3eCircularProgressIndicator />
        </div>
      )}

      {/* 加载失败 */}
      {!loading && isError && (
        <div className='py-16 text-center opacity-60'>
          {t('works.load-failed-retry')}
        </div>
      )}

      {/* 列表（虚拟滚动，见组件注释；行高由 measureElement 动态测量） */}
      {!loading && !isError && entries.length > 0 && (
        <div
          className='relative w-full'
          style={
            {
              height: rowVirtualizer.getTotalSize(),
              '--m3e-list-item-container-shape': 'calc(infinity * 1px)',
              '--m3e-list-item-hover-container-shape': 'calc(infinity * 1px)',
            } as React.CSSProperties
          }
        >
          {rowVirtualizer.getVirtualItems().map((vRow) => {
            const entry = entries[vRow.index];
            return (
              <div
                key={entry.key}
                data-index={vRow.index}
                ref={rowVirtualizer.measureElement}
                className='absolute inset-x-0 top-0'
                style={{
                  transform: `translateY(${vRow.start}px)`,
                  // 必须：m3e-list-action（Lit）shadow 异步渲染，挂载瞬间
                  // wrapper 高度为 0，measureElement 读到 0 会触发
                  // resizeItem(0) → notify → setState → ref 重跑 的无限循环
                  // （Maximum update depth + translateY 跳底）；min-height 让
                  // 首测读数即等于 ROW_HEIGHT（不 notify），渲染完成后由
                  // ResizeObserver 报真值，至多一次更新后收敛
                  minHeight: ROW_HEIGHT,
                }}
              >
                <M3eListAction
                  onClick={() =>
                    navigate({ to: '/works', search: entry.search })
                  }
                >
                  <span
                    slot='leading'
                    className='me-3 flex items-center opacity-60'
                  >
                    <M3eIcon name={LEADING_ICONS[type]} />
                  </span>
                  {/* 定宽钳制：w-0（定宽元素的内在宽度贡献恒为 0，与文本
                      可否断行/nowrap 无关）+ min-w-full（布局期再撑满
                      .content）。单靠 truncate/line-clamp-1 时，标题的
                      内在宽度仍会经由 .content 的 min-width:auto 把整行
                      撑开、把两侧图标挤出容器（实测） */}
                  <span className='block w-0 min-w-full truncate'>
                    {entry.name}
                  </span>
                  <span
                    slot='trailing'
                    className='flex items-center gap-1 opacity-50'
                  >
                    {/* 在库作品数（继承 trailing 槽的 label-small 字号与
                        opacity-50）；置于收藏按钮左侧 */}
                    <span>({entry.workCount})</span>
                    {favType && (
                      <FavButton
                        size='sm'
                        targetType={favType}
                        targetId={entry.key}
                        favourited={auth ? entry.favourited : undefined}
                      />
                    )}
                    <M3eIcon name='chevron_right' />
                  </span>
                </M3eListAction>
              </div>
            );
          })}
        </div>
      )}

      {/* 空状态 */}
      {!loading && !isError && entries.length === 0 && (
        <div className='py-16 text-center opacity-60'>
          {keyword
            ? t('works.list-empty-match', { label })
            : t('works.list-empty', { label })}
        </div>
      )}
    </PageContainer>
  );
}

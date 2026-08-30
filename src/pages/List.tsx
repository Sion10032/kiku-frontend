import { useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { M3eSearchBar } from '@m3e/react/search';
import { M3eIcon } from '@m3e/react/icon';
import { M3eActionList, M3eListAction } from '@m3e/react/list';
import { M3eCircularProgressIndicator } from '@m3e/react/progress-indicator';
import '@m3e/icons/outlined/search';
import '@m3e/icons/outlined/chevron_right';
import '@m3e/icons/outlined/group';
import '@m3e/icons/outlined/label';
import '@m3e/icons/outlined/mic';
import '@m3e/icons/outlined/library_books';
import {
  useCirclesQuery,
  useSeriesQuery,
  useTagsQuery,
  useVasQuery,
} from '../queries/useListQuery';
import { fieldQuery } from '../utils/query';

export type ListType = 'circles' | 'tags' | 'vas' | 'series';

const LABELS: Record<ListType, string> = {
  circles: '社团',
  tags: '标签',
  vas: '声优',
  series: '系列',
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
  search: EntitySearch;
}

/**
 * 社团 / 标签 / 声优 / 系列 列表页（步骤 9）。
 *
 * - 按路由 type 选择查询（getCircles / getTags / getVas / getSeries，均返回裸数组）
 * - m3e SearchBar 输入即筛（客户端按名称过滤）
 * - 点击项跳转 /works 并携带筛选参数：q = fieldQuery(field, name) 生成的 LQL 查询文本
 *
 * 注意：M3eListItem 的 named slot（leading/trailing）只对直接子元素生效，
 * 因此导航用 onClick + useNavigate 而非把 slot 元素包进 <Link>。
 */
export default function List({ type }: { type: ListType }) {
  const navigate = useNavigate();
  const label = LABELS[type];
  const [keyword, setKeyword] = useState('');

  const circles = useCirclesQuery();
  const tags = useTagsQuery();
  const vas = useVasQuery();
  const series = useSeriesQuery();

  // 列表项 + 跳转 search 参数（按 type 构建；导航用 onClick，见组件注释）
  const entries = useMemo<Entry[]>(() => {
    const kw = keyword.trim().toLowerCase();
    const match = (name: string) => !kw || name.toLowerCase().includes(kw);
    if (type === 'circles') {
      return (circles.data ?? [])
        .filter((c) => match(c.name))
        .map((c) => ({
          key: String(c.id),
          name: c.name,
          search: { q: fieldQuery('circle', c.name) },
        }));
    }
    if (type === 'tags') {
      return (tags.data ?? [])
        .filter((t) => match(t.name))
        .map((t) => ({
          key: String(t.id),
          name: t.name,
          search: { q: fieldQuery('tag', t.name) },
        }));
    }
    if (type === 'series') {
      return (series.data ?? [])
        .filter((s) => match(s.name))
        .map((s) => ({
          key: String(s.id),
          name: s.name,
          search: { q: fieldQuery('series', s.name) },
        }));
    }
    return (vas.data ?? [])
      .filter((v) => match(v.name))
      .map((v) => ({
        key: v.id,
        name: v.name,
        search: { q: fieldQuery('va', v.name) },
      }));
  }, [type, circles.data, tags.data, vas.data, series.data, keyword]);

  const loading =
    type === 'circles'
      ? circles.isLoading
      : type === 'tags'
        ? tags.isLoading
        : type === 'series'
          ? series.isLoading
          : vas.isLoading;

  const isError =
    type === 'circles'
      ? circles.isError
      : type === 'tags'
        ? tags.isError
        : type === 'series'
          ? series.isError
          : vas.isError;

  const total =
    type === 'circles'
      ? (circles.data?.length ?? 0)
      : type === 'tags'
        ? (tags.data?.length ?? 0)
        : type === 'series'
          ? (series.data?.length ?? 0)
          : (vas.data?.length ?? 0);

  return (
    <div className='mx-auto max-w-3xl'>
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
          placeholder={`搜索${label}…`}
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
        <div className='py-16 text-center opacity-60'>加载失败，请稍后重试</div>
      )}

      {/* 列表 */}
      {!loading && !isError && entries.length > 0 && (
        <M3eActionList
          style={
            {
              '--m3e-list-item-container-shape': 'calc(infinity * 1px)',
              '--m3e-list-item-hover-container-shape': 'calc(infinity * 1px)',
            } as React.CSSProperties
          }
        >
          {entries.map((entry) => (
            <M3eListAction
              key={entry.key}
              onClick={() => navigate({ to: '/works', search: entry.search })}
            >
              <span
                slot='leading'
                className='me-3 flex items-center opacity-60'
              >
                <M3eIcon name={LEADING_ICONS[type]} />
              </span>
              <span className='block truncate'>{entry.name}</span>
              <span slot='trailing' className='flex items-center opacity-50'>
                <M3eIcon name='chevron_right' />
              </span>
            </M3eListAction>
          ))}
        </M3eActionList>
      )}

      {/* 空状态 */}
      {!loading && !isError && entries.length === 0 && (
        <div className='py-16 text-center opacity-60'>
          {keyword ? `没有匹配的${label}` : `暂无${label}`}
        </div>
      )}
    </div>
  );
}

import { useMemo, useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { M3eFormField } from '@m3e/react/form-field';
import { M3eSelect, type M3eSelectElement } from '@m3e/react/select';
import { M3eOption } from '@m3e/react/option';
import { M3eIconButton } from '@m3e/react/icon-button';
import { M3eIcon } from '@m3e/react/icon';
import { M3eCircularProgressIndicator } from '@m3e/react/progress-indicator';
import { M3eList } from '@m3e/react/list';
import '@m3e/icons/outlined/apps';
import '@m3e/icons/outlined/view_list';
import { worksRoute } from '../routes/works';
import {
  useWorksInfinite,
  useCircleWorks,
  useTagWorks,
  useVaWorks,
  useSearchWorks,
} from '../queries/useWorksQuery';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import {
  SORT_OPTIONS,
  loadSortOption,
  saveSortOption,
  DEFAULT_SORT,
} from '../utils/sort';
import WorkCard from '../components/WorkCard';
import WorkListItem from '../components/WorkListItem';
import type { Work } from '../types';

const VIEW_KEY = 'kiku-works-view'; // 'grid' | 'list'

/**
 * 作品库页面。
 *
 * - URL search params（类型安全）：order/sort/page/seed + circleId/tagId/vaId/keyword
 * - 无筛选：无限滚动分页（useWorksInfinite）
 * - 筛选：一次拉全（后端筛选端点无分页）
 * - 搜索输入在顶栏（GlobalSearchBar），写 URL keyword；排序不支持搜索结果，搜索时隐藏排序控件
 * - 网格 / 列表切换，排序与视图模式持久化到 localStorage
 */
export default function Works() {
  const search = worksRoute.useSearch();
  const navigate = worksRoute.useNavigate();

  // 视图模式（state 驱动，初始读 localStorage）
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    try {
      return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid';
    } catch {
      return 'grid';
    }
  });

  // 排序选项（从 URL order/sort 推导，缺省读 localStorage）
  const sortOption = useMemo(() => {
    if (search.order && search.sort) {
      return (
        SORT_OPTIONS.find(
          (o) => o.order === search.order && o.sort === search.sort,
        ) ?? DEFAULT_SORT
      );
    }
    return loadSortOption();
  }, [search.order, search.sort]);

  // 随机排序时生成一次 seed（切到 random 时刷新）
  const seed = search.seed ?? 7;

  // 查询：无筛选走无限滚动，有筛选走单次拉取
  const isFiltered =
    search.circleId != null ||
    search.tagId != null ||
    search.vaId != null ||
    !!search.keyword;

  const infinite = useWorksInfinite({
    order: sortOption.order,
    sort: sortOption.sort,
    seed: (sortOption.order === 'random' || sortOption.order === 'betterRandom') ? seed : undefined,
  });

  const circleWorks = useCircleWorks(search.circleId);
  const tagWorks = useTagWorks(search.tagId);
  const vaWorks = useVaWorks(search.vaId);
  const searchWorks_ = useSearchWorks(search.keyword);

  // 统一拍平为 Work[]
  const works: Work[] = useMemo(() => {
    if (!isFiltered) {
      return infinite.data?.pages.flatMap((p) => p.works) ?? [];
    }
    if (search.circleId != null) return circleWorks.data ?? [];
    if (search.tagId != null) return tagWorks.data ?? [];
    if (search.vaId != null) return vaWorks.data ?? [];
    if (search.keyword) return searchWorks_.data?.works ?? [];
    return [];
  }, [
    isFiltered,
    infinite.data,
    search.circleId,
    search.tagId,
    search.vaId,
    search.keyword,
    circleWorks.data,
    tagWorks.data,
    vaWorks.data,
    searchWorks_.data,
  ]);

  const totalCount = !isFiltered
    ? infinite.data?.pages[0]?.pagination.totalCount
    : works.length;

  const loading =
    infinite.isLoading ||
    circleWorks.isLoading ||
    tagWorks.isLoading ||
    vaWorks.isLoading ||
    searchWorks_.isLoading;

  // 无限滚动
  const sentinelRef = useInfiniteScroll({
    onLoadMore: () => infinite.fetchNextPage(),
    hasMore: !!infinite.hasNextPage && !isFiltered,
    loading: infinite.isFetchingNextPage,
  });

  // 排序变更：写 URL（search params）+ 持久化
  function onSortChange(e: Event) {
    const value = (e.target as M3eSelectElement).value as string;
    const opt = SORT_OPTIONS.find((o) => `${o.order}:${o.sort}` === value);
    if (!opt) return;
    saveSortOption(opt);
    navigate({
      search: (prev) => ({ ...prev, order: opt.order, sort: opt.sort }),
    });
  }

  function toggleView() {
    setViewMode((prev) => {
      const next = prev === 'grid' ? 'list' : 'grid';
      try {
        localStorage.setItem(VIEW_KEY, next);
      } catch {
        /* noop */
      }
      return next;
    });
  }

  // 切到随机排序时若未设 seed，生成一个
  useEffect(() => {
    if ((sortOption.order === 'random' || sortOption.order === 'betterRandom') && search.seed == null) {
      navigate({
        search: (prev) => ({ ...prev, seed: Math.floor(Math.random() * 100) }),
      });
    }
  }, [sortOption.order]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mx-auto max-w-[1680px]">
      {/* 顶部工具栏 */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="m-0 text-xl">
          作品库
          {totalCount != null && (
            <span className="ml-2 text-base opacity-60">({totalCount})</span>
          )}
        </h1>

        <div className="ms-auto flex items-center gap-2">
          {/* 搜索结果不支持排序，搜索时隐藏排序控件 */}
          {!search.keyword && (
            <M3eFormField variant="outlined" hideSubscript='always' className="min-w-48">
              <label slot="label">排序</label>
              <M3eSelect onChange={onSortChange}>
                {SORT_OPTIONS.map((o) => {
                  const v = `${o.order}:${o.sort}`;
                  return (
                    <M3eOption
                      key={v}
                      value={v}
                      selected={v === `${sortOption.order}:${sortOption.sort}`}
                    >
                      {o.label}
                    </M3eOption>
                  );
                })}
              </M3eSelect>
            </M3eFormField>
          )}

          <M3eIconButton onClick={toggleView} aria-label="切换视图">
            <M3eIcon name={viewMode === 'grid' ? 'view_list' : 'apps'} />
          </M3eIconButton>
        </div>
      </div>

      {/* 筛选状态提示 */}
      {isFiltered && (
        <div className="mb-3 flex items-center gap-2 text-sm opacity-70">
          <span>
            筛选中：
            {search.keyword && `关键词「${search.keyword}」`}
            {search.circleId && `社团`}
            {search.tagId && `标签`}
            {search.vaId && `声优`}
          </span>
          <Link to="/works" className="no-underline">
            清除
          </Link>
        </div>
      )}

      {/* 加载中 */}
      {loading && (
        <div className="flex justify-center py-12">
          <M3eCircularProgressIndicator />
        </div>
      )}

      {/* 列表视图 */}
      {!loading && viewMode === 'list' && (
        <M3eList>
          {works.map((work) => (
            <WorkListItem key={work.id} work={work} />
          ))}
        </M3eList>
      )}

      {/* 网格视图 */}
      {!loading && viewMode === 'grid' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {works.map((work) => (
            <WorkCard key={work.id} work={work} />
          ))}
        </div>
      )}

      {/* 空状态 */}
      {!loading && works.length === 0 && (
        <div className="py-16 text-center opacity-60">
          {search.keyword
            ? `未找到与「${search.keyword}」相关的作品`
            : '暂无作品'}
        </div>
      )}

      {/* 无限滚动哨兵 */}
      {!loading && works.length > 0 && (
        <div ref={sentinelRef} className="h-1 w-full" />
      )}
      {!loading && infinite.isFetchingNextPage && (
        <div className="flex justify-center py-8">
          <M3eCircularProgressIndicator />
        </div>
      )}
    </div>
  );
}

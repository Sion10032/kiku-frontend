import { useMemo, useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { M3eFormField } from '@m3e/react/form-field';
import { M3eSelect, type M3eSelectElement } from '@m3e/react/select';
import { M3eOption } from '@m3e/react/option';
import { M3eIconButton } from '@m3e/react/icon-button';
import { M3eIcon } from '@m3e/react/icon';
import { M3eCircularProgressIndicator } from '@m3e/react/progress-indicator';
import { M3eList } from '@m3e/react/list';
import {
  M3ePaginator,
  type PaginatorPageEventDetail,
} from '@m3e/react/paginator';
import '@m3e/icons/outlined/apps';
import '@m3e/icons/outlined/view_list';
import { useQuery } from '@tanstack/react-query';
import { worksRoute } from '../routes/works';
import { useWorksPage, useWorksInfinite } from '../queries/useWorksQuery';
import { getCircle, getTag, getVa } from '../api/works';
import { useSettingsStore } from '../stores/settingsStore';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import {
  SORT_OPTIONS,
  loadSortOption,
  saveSortOption,
  DEFAULT_SORT,
} from '../utils/sort';
import WorkCard from '../components/works/WorkCard';
import WorkListItem from '../components/works/WorkListItem';
import type { Work } from '../types';

const VIEW_KEY = 'kiku-works-view'; // 'grid' | 'list'

/**
 * 作品库页面。
 *
 * - URL search params（类型安全）：order/sort/page/seed + circleId/tagId/vaId/keyword
 * - 筛选与无筛选统一分页端点；翻页方式（分页/无限滚动）由设置控制
 * - 分页模式下 title 同步筛选名与页码
 * - 搜索输入在顶栏（GlobalSearchBar），写 URL keyword；搜索场景不提供排序入口（后端已支持 order/sort，仅 random 退化），搜索时隐藏排序控件
 * - 网格 / 列表切换，排序与视图模式持久化到 localStorage
 */
export default function Works() {
  const search = worksRoute.useSearch();
  const navigate = worksRoute.useNavigate();

  // 翻页方式（设置项）：paginate 分页 / infinite 无限滚动
  const paginationMode = useSettingsStore(s => s.worksPaginationMode);
  const isPaginated = paginationMode === 'paginate';
  // 分页控件显示位置（设置项）：top 顶部 / bottom 底部 / both 两处
  const paginatorPosition = useSettingsStore(s => s.worksPaginatorPosition);
  const page = search.page ?? 1;

  // 视图模式（state 驱动，初始读 localStorage）
  const [ viewMode, setViewMode ] = useState<'grid' | 'list'>(() => {
    try {
      return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid';
    }
    catch {
      return 'grid';
    }
  });

  // 排序选项（从 URL order/sort 推导，缺省读 localStorage）
  const sortOption = useMemo(() => {
    if (search.order && search.sort) {
      return (
        SORT_OPTIONS.find(
          o => o.order === search.order && o.sort === search.sort,
        ) ?? DEFAULT_SORT
      );
    }
    return loadSortOption();
  }, [ search.order, search.sort ]);

  // 随机排序时生成一次 seed（切到 random 时刷新）
  const seed = search.seed ?? 7;

  const isFiltered =
    search.circleId != null
    || search.tagId != null
    || search.vaId != null
    || !!search.keyword;

  // 筛选与排序参数：统一分页端点（后端按筛选自动路由子端点）
  const filterParams = {
    circleId: search.circleId,
    tagId: search.tagId,
    vaId: search.vaId,
    keyword: search.keyword,
  };
  const sortParams = {
    order: sortOption.order,
    sort: sortOption.sort,
    seed: (sortOption.order === 'random' || sortOption.order === 'betterRandom') ? seed : undefined,
  };

  // 查询：分页模式按页拉取（keepPreviousData 防翻页闪 loading），无限模式滚动追加
  const paged = useWorksPage({ ...filterParams, ...sortParams, page }, isPaginated);
  const infinite = useWorksInfinite({ ...filterParams, ...sortParams }, !isPaginated);

  // 统一拍平为 Work[]
  const works: Work[] = useMemo(
    () => isPaginated
      ? paged.data?.works ?? []
      : infinite.data?.pages.flatMap(p => p.works) ?? [],
    [ isPaginated, paged.data, infinite.data ],
  );

  const pagination = isPaginated
    ? paged.data?.pagination
    : infinite.data?.pages[0]?.pagination;
  const totalCount = pagination?.totalCount;
  const loading = isPaginated ? paged.isLoading : infinite.isLoading;

  // 筛选条件名称（title 显示用）；keyword 直接可用，其余按需查询
  const circle = useQuery({
    queryKey: [ 'circle', search.circleId ],
    queryFn: () => getCircle(search.circleId!),
    enabled: search.circleId != null,
    staleTime: 5 * 60_000,
  });
  const tag = useQuery({
    queryKey: [ 'tag', search.tagId ],
    queryFn: () => getTag(search.tagId!),
    enabled: search.tagId != null,
    staleTime: 5 * 60_000,
  });
  const va = useQuery({
    queryKey: [ 'va', search.vaId ],
    queryFn: () => getVa(search.vaId!),
    enabled: search.vaId != null,
    staleTime: 5 * 60_000,
  });
  const filterName = search.keyword
    ? `「${search.keyword}」`
    : search.circleId != null
      ? circle.data?.name
      : search.tagId != null
        ? tag.data?.name
        : search.vaId != null
          ? va.data?.name
          : undefined;

  // 无限滚动（仅无限模式；分页模式 hasMore 恒 false）
  const sentinelRef = useInfiniteScroll({
    onLoadMore: () => infinite.fetchNextPage(),
    hasMore: !!infinite.hasNextPage && !isPaginated,
    loading: infinite.isFetchingNextPage,
  });

  // 跳页：写 URL search（page=1 时移除参数）
  function onPageChange(e: CustomEvent<PaginatorPageEventDetail>) {
    const next = e.detail.pageIndex + 1; // pageIndex 从 0 开始
    navigate({
      search: prev => ({ ...prev, page: next === 1 ? undefined : next }),
    });
  }

  // 排序变更：写 URL（search params，重置页码）+ 持久化
  function onSortChange(e: Event) {
    const value = (e.target as M3eSelectElement).value as string;
    const opt = SORT_OPTIONS.find(o => `${o.order}:${o.sort}` === value);
    if (!opt) return;
    saveSortOption(opt);
    navigate({
      search: prev => ({ ...prev, order: opt.order, sort: opt.sort, page: undefined }),
    });
  }

  // 分页控件（仅分页模式）：提取为局部元素，按设置在网格前/后渲染，两处共用同一 props
  const paginator = isPaginated && !loading && pagination && pagination.totalCount > 0
    ? (
      <div className='mt-6 flex justify-center'>
        <M3ePaginator
          length={pagination.totalCount}
          pageSize={pagination.pageSize}
          pageIndex={page - 1}
          hidePageSize
          showFirstLastButtons
          disabled={paged.isFetching}
          itemsPerPageLabel='每页条数：'
          previousPageLabel='上一页'
          nextPageLabel='下一页'
          firstPageLabel='第一页'
          lastPageLabel='最后一页'
          onPage={onPageChange} />
      </div>
    )
    : null;

  function toggleView() {
    setViewMode((prev) => {
      const next = prev === 'grid' ? 'list' : 'grid';
      try {
        localStorage.setItem(VIEW_KEY, next);
      }
      catch {
        /* noop */
      }
      return next;
    });
  }

  // 切到随机排序时若未设 seed，生成一个
  useEffect(() => {
    if ((sortOption.order === 'random' || sortOption.order === 'betterRandom') && search.seed == null) {
      navigate({
        search: prev => ({ ...prev, seed: Math.floor(Math.random() * 100) }),
      });
    }
  }, [ sortOption.order ]); // eslint-disable-line react-hooks/exhaustive-deps

  // title 同步筛选名与页码（分页模式）；卸载/切模式时恢复默认
  useEffect(() => {
    const base = filterName ? `${filterName} · 作品库` : '作品库';
    const totalPages = pagination
      ? Math.max(1, Math.ceil(pagination.totalCount / pagination.pageSize))
      : 1;
    document.title = isPaginated && pagination && page > 1
      ? `${base} · 第 ${page}/${totalPages} 页 · Kiku`
      : `${base} · Kiku`;
    return () => {
      document.title = 'Kiku';
    };
  }, [ isPaginated, page, filterName, pagination ]);

  return (
    <div className='mx-auto max-w-[1680px]'>
      {/* 顶部工具栏 */}
      <div className='mb-4 flex flex-wrap items-center gap-3'>
        <h1 className='m-0 text-xl'>
          作品库
          {totalCount != null && (
            <span className='ml-2 text-base opacity-60'>({totalCount})</span>
          )}
        </h1>

        <div className='ms-auto flex items-center gap-2'>
          {/* 搜索结果不支持排序，搜索时隐藏排序控件 */}
          {!search.keyword && (
            <M3eFormField variant='outlined' hideSubscript='always' className='min-w-48'>
              <label slot='label'>排序</label>
              <M3eSelect onChange={onSortChange}>
                {SORT_OPTIONS.map((o) => {
                  const v = `${o.order}:${o.sort}`;
                  return (
                    <M3eOption
                      key={v}
                      value={v}
                      selected={v === `${sortOption.order}:${sortOption.sort}`}>
                      {o.label}
                    </M3eOption>
                  );
                })}
              </M3eSelect>
            </M3eFormField>
          )}

          <M3eIconButton onClick={toggleView} aria-label='切换视图'>
            <M3eIcon name={viewMode === 'grid' ? 'view_list' : 'apps'} />
          </M3eIconButton>
        </div>
      </div>

      {/* 筛选状态提示 */}
      {isFiltered && (
        <div className='mb-3 flex items-center gap-2 text-sm opacity-70'>
          <span>
            筛选中：
            {search.keyword && `关键词「${search.keyword}」`}
            {search.circleId && `社团`}
            {search.tagId && `标签`}
            {search.vaId && `声优`}
          </span>
          <Link to='/works' className='no-underline'>
            清除
          </Link>
        </div>
      )}

      {/* 分页控件（分页模式）：top/both 时在作品网格前渲染 */}
      {(paginatorPosition === 'top' || paginatorPosition === 'both') && paginator}

      {/* 加载中 */}
      {loading && (
        <div className='flex justify-center py-12'>
          <M3eCircularProgressIndicator />
        </div>
      )}

      {/* 列表视图 */}
      {!loading && viewMode === 'list' && (
        <M3eList>
          {works.map(work => (
            <WorkListItem key={work.id} work={work} />
          ))}
        </M3eList>
      )}

      {/* 网格视图 */}
      {!loading && viewMode === 'grid' && (
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5'>
          {works.map(work => (
            <WorkCard key={work.id} work={work} />
          ))}
        </div>
      )}

      {/* 空状态 */}
      {!loading && works.length === 0 && (
        <div className='py-16 text-center opacity-60'>
          {search.keyword
            ? `未找到与「${search.keyword}」相关的作品`
            : '暂无作品'}
        </div>
      )}

      {/* 分页控件（分页模式）：bottom/both 时在空状态之后渲染 */}
      {(paginatorPosition === 'bottom' || paginatorPosition === 'both') && paginator}

      {/* 无限滚动哨兵（无限模式） */}
      {!isPaginated && !loading && works.length > 0 && (
        <div ref={sentinelRef} className='h-1 w-full' />
      )}
      {!isPaginated && !loading && works.length > 0 && infinite.isFetchingNextPage && (
        <div className='flex justify-center py-8'>
          <M3eCircularProgressIndicator />
        </div>
      )}
    </div>
  );
}

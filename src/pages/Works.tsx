import { useMemo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { M3eCircularProgressIndicator } from '@m3e/react/progress-indicator';
import { M3eList } from '@m3e/react/list';
import { worksRoute } from '../routes/works';
import { useWorksPage, useWorksInfinite } from '../queries/useWorksQuery';
import { useSettingsStore } from '../stores/settingsStore';
import { useUserStore } from '../stores/userStore';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { useResetPageOnPageSizeChange } from '../hooks/useResetPageOnPageSizeChange';
import { useResetOutOfRangePage } from '../hooks/useResetOutOfRangePage';
import { useScrollTopOnPageChange } from '../hooks/useScrollTopOnPageChange';
import {
  SORT_OPTIONS,
  loadSortOption,
  saveSortOption,
  DEFAULT_SORT,
} from '../utils/sort';
import {
  loadQuickFilters,
  mergeWorksQuery,
  type QuickFilterAge,
  type QuickFilterProgress,
  saveQuickFilters,
} from '../utils/query';
import PageContainer from '../components/common/PageContainer';
import Paginator from '../components/common/Paginator';
import WorkCard from '../components/works/WorkCard';
import WorkListItem from '../components/works/WorkListItem';
import HistoryStrip from '../components/works/HistoryStrip';
import WorksToolbar, {
  type WorksViewMode,
} from '../components/works/WorksToolbar';
import type { Work } from '../types';

const VIEW_KEY = 'kiku-works-view'; // 'grid' | 'list'

/**
 * 作品库页面。
 *
 * - URL search params（类型安全）：order/sort/page/seed + q（LQL 查询文本）
 *   + 快速筛选（分级/收听状态）：纯前端偏好（localStorage 持久化，不进 URL），
 *   请求时编译为 LQL 片段附加到 q，见 mergeWorksQuery
 * - 筛选与无筛选统一分页端点；翻页方式（分页/无限滚动）由设置控制
 * - 分页模式下 title 同步筛选名与页码
 * - 搜索输入在顶栏（GlobalSearchBar），写 URL q（支持 tag:xxx、circle:xxx 等语法）
 * - 网格 / 列表切换，排序与视图模式持久化到 localStorage
 */
export default function Works() {
  const { t } = useTranslation();
  const search = worksRoute.useSearch();
  const navigate = worksRoute.useNavigate();

  // 翻页方式（设置项）：paginate 分页 / infinite 无限滚动
  const paginationMode = useSettingsStore((s) => s.worksPaginationMode);
  const isPaginated = paginationMode === 'paginate';
  // 分页控件显示位置（设置项）：top 顶部 / bottom 底部 / both 两处
  const paginatorPosition = useSettingsStore((s) => s.worksPaginatorPosition);
  const worksHistoryStrip = useSettingsStore((s) => s.worksHistoryStrip);
  // 每页条数（设置项，与收听历史共用同一偏好）
  const worksPageSize = useSettingsStore((s) => s.worksPageSize);
  const page = search.page ?? 1;

  // 视图模式（state 驱动，初始读 localStorage）
  const [viewMode, setViewMode] = useState<WorksViewMode>(() => {
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

  const isFiltered = !!search.q;
  // 快速筛选生效值：纯前端偏好（localStorage 持久化），不进 URL——不参与
  // 链接分享，前进/后退也不改变。挂载时从 localStorage 初始化，跨会话记住
  // 上次选择；变更经 setState 驱动列表刷新（不依赖 navigate，无 no-op 问题）。
  const [quickFilters, setQuickFilters] = useState(loadQuickFilters);
  const quickAge = quickFilters.age;
  const quickProgress = quickFilters.progress;
  const authed = useUserStore((s) => s.auth);
  // 快速筛选（分级/状态）是持久偏好，不隐藏最近收听条带：条带只与
  // 「明确搜索词」与页码绑定（有搜索词或翻到第 2 页起才隐藏）
  const showHistoryStrip =
    worksHistoryStrip && authed && !isFiltered && (page === 1 || !isPaginated);

  // 筛选与排序参数：统一走 /works?q= 端点；快速筛选编译为 LQL 片段附加
  const filterParams = {
    q: mergeWorksQuery({
      q: search.q,
      age: quickAge,
      progress: quickProgress,
    }),
  };
  const sortParams = {
    order: sortOption.order,
    sort: sortOption.sort,
    seed: sortOption.order === 'random' ? seed : undefined,
  };

  // 查询：分页模式按页拉取（keepPreviousData 防翻页闪 loading），无限模式滚动追加
  const paged = useWorksPage(
    { ...filterParams, ...sortParams, pageSize: worksPageSize, page },
    isPaginated,
  );
  const infinite = useWorksInfinite(
    { ...filterParams, ...sortParams, pageSize: worksPageSize },
    !isPaginated,
  );

  // 统一拍平为 Work[]
  const works: Work[] = useMemo(
    () =>
      isPaginated
        ? (paged.data?.works ?? [])
        : (infinite.data?.pages.flatMap((p) => p.works) ?? []),
    [isPaginated, paged.data, infinite.data],
  );

  const pagination = isPaginated
    ? paged.data?.pagination
    : infinite.data?.pages[0]?.pagination;
  const totalCount = pagination?.totalCount;
  const loading = isPaginated ? paged.isLoading : infinite.isLoading;

  // 筛选条件名称（title 显示用），来自 q 查询文本
  const filterName = search.q
    ? t('works.filter-name', { query: search.q })
    : undefined;

  // 无限滚动（仅无限模式；分页模式 hasMore 恒 false）
  const sentinelRef = useInfiniteScroll({
    onLoadMore: () => infinite.fetchNextPage(),
    hasMore: !!infinite.hasNextPage && !isPaginated,
    loading: infinite.isFetchingNextPage,
  });

  // 跳页：写 URL search（page=1 时移除参数）
  function onPageChange(index: number) {
    const next = index + 1; // 页码从 0 起，转 1 起写 URL
    navigate({
      search: (prev) => ({ ...prev, page: next === 1 ? undefined : next }),
    });
  }

  // 快速筛选变更：持久化偏好 + 同步 state；页码归位（已在第 1 页时
  // resetPage 不导航，刷新由 setState 驱动）。「全部」为空串 = 不限。
  function onAgeChange(value: string) {
    const next = {
      ...loadQuickFilters(),
      age: value === '' ? undefined : (value as QuickFilterAge),
    };
    saveQuickFilters(next);
    setQuickFilters(next);
    resetPage();
  }

  function onProgressChange(value: string) {
    const next = {
      ...loadQuickFilters(),
      progress: value === '' ? undefined : (value as QuickFilterProgress),
    };
    saveQuickFilters(next);
    setQuickFilters(next);
    resetPage();
  }

  // 排序变更：写 URL（search params，重置页码）+ 持久化
  function onSortChange(value: string) {
    const opt = SORT_OPTIONS.find((o) => `${o.order}:${o.sort}` === value);
    if (!opt) return;
    saveSortOption(opt);
    navigate({
      search: (prev) => ({
        ...prev,
        order: opt.order,
        sort: opt.sort,
        page: undefined,
      }),
    });
  }

  // 分页控件（仅分页模式）：提取为局部元素，按设置在网格前/后渲染，两处共用同一 props
  const paginator =
    isPaginated && !loading && pagination && pagination.totalCount > 0 ? (
      <div className='mt-3 mb-3 flex items-center justify-center gap-2'>
        <Paginator
          length={pagination.totalCount}
          pageSize={pagination.pageSize}
          pageIndex={page - 1}
          disabled={paged.isFetching}
          onPage={onPageChange}
        />
      </div>
    ) : null;

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
    if (sortOption.order === 'random' && search.seed == null) {
      navigate({
        search: (prev) => ({ ...prev, seed: Math.floor(Math.random() * 100) }),
      });
    }
  }, [sortOption.order]); // eslint-disable-line react-hooks/exhaustive-deps

  // 页码归位：切档（本页挂载时）或残留的越界页码（切档发生在别处、Back/书签
  // 带进来）都回到第 1 页。合法页码不导航，所以正常首屏不跳转。
  function resetPage() {
    if (search.page != null) {
      navigate({ search: (prev) => ({ ...prev, page: undefined }) });
    }
  }

  useResetPageOnPageSizeChange(worksPageSize, resetPage);
  // 档位是在 /settings 改的（本页未挂载）或越界页码来自书签/刷新：依据回执兜底
  useResetOutOfRangePage(page, worksPageSize, pagination, resetPage);

  // 翻页后把主布局滚动容器滚回顶部（详见 hook 注释）
  useScrollTopOnPageChange(page);

  // title 同步筛选名与页码（分页模式）；卸载/切模式时恢复默认
  useEffect(() => {
    const totalPages = pagination
      ? Math.max(1, Math.ceil(pagination.totalCount / pagination.pageSize))
      : 1;
    document.title =
      isPaginated && pagination && page > 1
        ? filterName
          ? t('works.doc-title-filtered-page', {
              name: filterName,
              page,
              totalPages,
            })
          : t('works.doc-title-page', { page, totalPages })
        : filterName
          ? t('works.doc-title-filtered', { name: filterName })
          : t('works.doc-title');
    return () => {
      document.title = 'Kiku';
    };
  }, [isPaginated, page, filterName, pagination, t]);

  return (
    <PageContainer base='wide'>
      {/* 最近收听条带 */}
      {showHistoryStrip && <HistoryStrip />}

      {/* 顶部工具栏：标题计数 + 快速筛选 + 排序 + 视图切换 */}
      <WorksToolbar
        totalCount={totalCount}
        quickAge={quickAge}
        quickProgress={quickProgress}
        onAgeChange={onAgeChange}
        onProgressChange={onProgressChange}
        sortOption={sortOption}
        onSortChange={onSortChange}
        viewMode={viewMode}
        onToggleView={toggleView}
      />

      {/* 筛选状态提示 */}
      {isFiltered && (
        <div className='mb-3 flex items-center gap-2 text-sm opacity-70'>
          <span className='truncate'>
            {t('works.filtering', { query: search.q })}
          </span>
          <Link to='/works' className='no-underline'>
            {t('works.clear-filter')}
          </Link>
        </div>
      )}

      {/* 分页控件（分页模式）：top/both 时在作品网格前渲染 */}
      {(paginatorPosition === 'top' || paginatorPosition === 'both')
        && paginator}

      {/* 加载中 */}
      {loading && (
        <div className='flex justify-center py-12'>
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
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5'>
          {works.map((work) => (
            <WorkCard key={work.id} work={work} />
          ))}
        </div>
      )}

      {/* 空状态 */}
      {!loading && works.length === 0 && (
        <div className='py-16 text-center opacity-60'>
          {search.q
            ? t('works.empty-filtered', { query: search.q })
            : t('works.empty')}
        </div>
      )}

      {/* 分页控件（分页模式）：bottom/both 时在空状态之后渲染 */}
      {(paginatorPosition === 'bottom' || paginatorPosition === 'both')
        && paginator}

      {/* 无限滚动哨兵（无限模式） */}
      {!isPaginated && !loading && works.length > 0 && (
        <div ref={sentinelRef} className='h-1 w-full' />
      )}
      {!isPaginated
        && !loading
        && works.length > 0
        && infinite.isFetchingNextPage && (
          <div className='flex justify-center py-8'>
            <M3eCircularProgressIndicator />
          </div>
        )}
    </PageContainer>
  );
}

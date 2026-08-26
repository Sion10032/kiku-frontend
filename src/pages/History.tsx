import { useEffect } from 'react';
import { Link } from '@tanstack/react-router';
import { M3eCircularProgressIndicator } from '@m3e/react/progress-indicator';
import {
  M3ePaginator,
  type PaginatorPageEventDetail,
} from '@m3e/react/paginator';
import { useHistoryPage } from '../queries/useHistoryQuery';
import { useUserStore } from '../stores/userStore';
import { historyRoute } from '../routes/history';
import WorkCard from '../components/works/WorkCard';

/**
 * 收听历史页。
 *
 * - 未登录：居中提示登录
 * - 已登录：分页网格展示收听历史，倒序排列
 * - title 同步页码
 */
export default function History() {
  const search = historyRoute.useSearch();
  const navigate = historyRoute.useNavigate();
  const page = search.page ?? 1;
  const authed = useUserStore(s => s.auth);

  const { data, isLoading } = useHistoryPage(page);
  const works = data?.works ?? [];
  const pagination = data?.pagination;
  const totalCount = pagination?.totalCount;
  const totalPages = pagination
    ? Math.max(1, Math.ceil(pagination.totalCount / pagination.pageSize))
    : 1;

  function onPageChange(e: CustomEvent<PaginatorPageEventDetail>) {
    const next = e.detail.pageIndex + 1;
    navigate({
      search: { page: next === 1 ? undefined : next },
    });
  }

  // title 同步页码；卸载恢复 Kiku
  useEffect(() => {
    document.title = pagination && page > 1
      ? `收听历史 · 第 ${page}/${totalPages} 页 · Kiku`
      : '收听历史 · Kiku';
    return () => {
      document.title = 'Kiku';
    };
  }, [ page, pagination, totalPages ]);

  // 未登录提示
  if (!authed) {
    return (
      <div className='mx-auto max-w-[1680px] py-16 text-center'>
        <p className='text-base opacity-60'>登录后可查看收听历史</p>
        <Link to='/login' className='mt-4 inline-block text-m3-primary no-underline'>
          前往登录
        </Link>
      </div>
    );
  }

  // 加载中
  if (isLoading) {
    return (
      <div className='flex justify-center py-12'>
        <M3eCircularProgressIndicator />
      </div>
    );
  }

  return (
    <div className='mx-auto max-w-[1680px]'>
      {/* 标题 */}
      <div className='mb-4 flex items-center gap-3'>
        <h1 className='m-0 text-xl'>
          收听历史
          {totalCount != null && (
            <span className='ml-2 text-base opacity-60'>({totalCount})</span>
          )}
        </h1>
      </div>

      {/* 网格 */}
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5'>
        {works.map(work => (
          <WorkCard key={work.id} work={work} />
        ))}
      </div>

      {/* 空状态 */}
      {!isLoading && works.length === 0 && (
        <div className='py-16 text-center opacity-60'>暂无收听记录</div>
      )}

      {/* 分页器 */}
      {!isLoading && pagination && totalCount != null && totalCount > 0 && (
        <div className='mt-6 flex justify-center'>
          <M3ePaginator
            length={totalCount}
            pageSize={pagination.pageSize}
            pageIndex={page - 1}
            hidePageSize
            showFirstLastButtons
            itemsPerPageLabel='每页条数：'
            previousPageLabel='上一页'
            nextPageLabel='下一页'
            firstPageLabel='第一页'
            lastPageLabel='最后一页'
            onPage={onPageChange} />
        </div>
      )}
    </div>
  );
}

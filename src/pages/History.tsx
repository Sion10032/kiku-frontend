import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { M3eCircularProgressIndicator } from '@m3e/react/progress-indicator';
import { useHistoryPage } from '../queries/useHistoryQuery';
import { useSettingsStore } from '../stores/settingsStore';
import { useUserStore } from '../stores/userStore';
import { historyRoute } from '../routes/history';
import { useResetPageOnPageSizeChange } from '../hooks/useResetPageOnPageSizeChange';
import { useResetOutOfRangePage } from '../hooks/useResetOutOfRangePage';
import Paginator from '../components/common/Paginator';
import WorkCard from '../components/works/WorkCard';

/**
 * 收听历史页。
 *
 * - 未登录：居中提示登录
 * - 已登录：分页网格展示收听历史，倒序排列
 * - title 同步页码
 */
export default function History() {
  const { t } = useTranslation();
  const search = historyRoute.useSearch();
  const navigate = historyRoute.useNavigate();
  const page = search.page ?? 1;
  const authed = useUserStore((s) => s.auth);
  // 每页条数（设置项，与作品库共用同一偏好）
  const worksPageSize = useSettingsStore((s) => s.worksPageSize);

  const { data, isLoading } = useHistoryPage(page, worksPageSize);
  const works = data?.works ?? [];
  const pagination = data?.pagination;
  const totalCount = pagination?.totalCount;
  const totalPages = pagination
    ? Math.max(1, Math.ceil(pagination.totalCount / pagination.pageSize))
    : 1;

  function onPageChange(index: number) {
    const next = index + 1; // 页码从 0 起，转 1 起写 URL
    navigate({
      search: { page: next === 1 ? undefined : next },
    });
  }

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

  // title 同步页码；卸载恢复 Kiku
  useEffect(() => {
    document.title =
      pagination && page > 1
        ? t('works.history.doc-title-page', { page, totalPages })
        : t('works.history.doc-title');
    return () => {
      document.title = 'Kiku';
    };
  }, [page, pagination, totalPages, t]);

  // 未登录提示
  if (!authed) {
    return (
      <div className='mx-auto max-w-[1680px] py-16 text-center'>
        <p className='text-base opacity-60'>
          {t('works.history.login-required')}
        </p>
        <Link
          to='/login'
          className='mt-4 inline-block text-m3-primary no-underline'
        >
          {t('works.history.go-login')}
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
          {t('works.history.title')}
          {totalCount != null && (
            <span className='ml-2 text-base opacity-60'>({totalCount})</span>
          )}
        </h1>
      </div>

      {/* 网格 */}
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5'>
        {works.map((work) => (
          <WorkCard key={work.id} work={work} />
        ))}
      </div>

      {/* 空状态 */}
      {!isLoading && works.length === 0 && (
        <div className='py-16 text-center opacity-60'>
          {t('works.history.empty')}
        </div>
      )}

      {/* 分页器 */}
      {!isLoading && pagination && totalCount != null && totalCount > 0 && (
        <div className='mt-6 flex items-center justify-center gap-2'>
          <Paginator
            length={totalCount}
            pageSize={pagination.pageSize}
            pageIndex={page - 1}
            onPage={onPageChange}
          />
        </div>
      )}
    </div>
  );
}

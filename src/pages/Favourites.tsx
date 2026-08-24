import { useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { M3eTabs, M3eTab } from '@m3e/react/tabs';
import { M3eList } from '@m3e/react/list';
import { M3eCircularProgressIndicator } from '@m3e/react/progress-indicator';
import { useUserStore } from '../stores/userStore';
import { useReviewsByUser, useWorkMap } from '../queries/useReviewsQuery';
import FavListItem from '../components/favourites/FavListItem';
import { PROGRESS_LABELS } from '../constants';
import type { Progress, Review, Work } from '../types';

export type FavouritesRoute = 'review' | 'progress' | 'folder';

/** 进度筛选顺序（对齐原项目 q-btn-toggle 选项）。 */
const PROGRESS_ORDER: Progress[] = [
  'marked',
  'listening',
  'listened',
  'replay',
  'postponed',
];

/** 顶部 Tab 定义（值 + 标签；跳转目标按 value 分派，见 goTab）。 */
const ROUTE_TABS: { value: FavouritesRoute; label: string; }[] = [
  { value: 'review', label: '我的评价' },
  { value: 'progress', label: '我的进度' },
  { value: 'folder', label: '分类整理' },
];

interface FavouritesProps {
  route: FavouritesRoute;
  /** 进度子视图（仅 route === 'progress' 时传入，缺省 marked）。 */
  status?: Progress;
}

/**
 * 收藏页：我的评价 / 我的进度 / 分类整理 三个视图（子路由区分）。
 *
 * - review：当前用户全部评价（评价星 + 短评 + 进度标记）
 * - progress：按 5 值进度状态筛选（marked/listening/listened/replay/postponed）
 * - folder：路由收藏夹（原项目语义：尚未实现，敬请期待）
 *
 * 数据：GET /api/review?username=:name 返回 Review 数组（仅含 workId），
 * 收集 workIds 后经 useWorkMap 批量拉取 work 详情（与作品详情页共享缓存，避免 N+1）。
 */
export default function Favourites({ route, status }: FavouritesProps) {
  const navigate = useNavigate();
  const name = useUserStore(s => s.name);
  const activeStatus: Progress = status ?? 'marked';

  // 顶部 Tab 跳转（progress 默认落到 marked 子视图）
  function goTab(value: FavouritesRoute) {
    if (value === 'review') navigate({ to: '/favourites/review' });
    else if (value === 'progress')
      navigate({
        to: '/favourites/progress/$status',
        params: { status: 'marked' },
      });
    else navigate({ to: '/favourites/folder' });
  }

  const reviewsQuery = useReviewsByUser(name || undefined);
  // useMemo 稳定引用：?? 每次渲染生成新数组，会让下游 useMemo 依赖失效
  const reviews = useMemo(
    () => reviewsQuery.data ?? [],
    [ reviewsQuery.data ],
  );

  const workIds = useMemo(() => reviews.map(r => r.workId), [ reviews ]);
  const { works, isPending: worksPending } = useWorkMap(workIds);

  // review + work join：work 加载成功后成行，按标记时间（updatedAt）倒序
  const rows = useMemo(() => {
    const list: { review: Review; work: Work; }[] = [];
    for (const review of reviews) {
      const work = works.get(review.workId);
      if (work) list.push({ review, work });
    }
    list.sort((a, b) =>
      (b.review.updatedAt ?? '').localeCompare(a.review.updatedAt ?? ''),
    );
    return list;
  }, [ reviews, works ]);

  const visible =
    route === 'progress'
      ? rows.filter(r => r.review.progress === activeStatus)
      : rows;

  const loading = reviewsQuery.isPending || worksPending;
  const isError = reviewsQuery.isError;

  return (
    <div className='mx-auto max-w-3xl'>
      <h1 className='m-0 mb-4 text-xl'>
        收藏
        {route === 'progress' && (
          <span className='ms-2 text-base opacity-60'>
            {PROGRESS_LABELS[activeStatus]}
          </span>
        )}
      </h1>

      {/* 顶部 Tab：我的评价 / 我的进度 / 分类整理 */}
      <M3eTabs stretch className='mb-4'>
        {ROUTE_TABS.map(tab => (
          <M3eTab
            key={tab.value}
            selected={route === tab.value}
            onClick={() => goTab(tab.value)}>
            {tab.label}
          </M3eTab>
        ))}
      </M3eTabs>

      {/* 进度子视图：5 值状态筛选 */}
      {route === 'progress' && (
        <M3eTabs className='mb-4'>
          {PROGRESS_ORDER.map(value => (
            <M3eTab
              key={value}
              selected={activeStatus === value}
              onClick={() =>
                navigate({
                  to: '/favourites/progress/$status',
                  params: { status: value },
                })}>
              {PROGRESS_LABELS[value]}
            </M3eTab>
          ))}
        </M3eTabs>
      )}

      {/* 分类整理（路由收藏夹）：原项目语义，尚未实现 */}
      {route === 'folder' && (
        <div className='py-16 text-center opacity-60'>尚未实现，敬请期待</div>
      )}

      {/* 加载中 */}
      {route !== 'folder' && loading && (
        <div className='flex justify-center py-12'>
          <M3eCircularProgressIndicator />
        </div>
      )}

      {/* 加载失败 */}
      {route !== 'folder' && !loading && isError && (
        <div className='py-16 text-center opacity-60'>
          加载失败，请稍后重试
        </div>
      )}

      {/* 列表 */}
      {route !== 'folder' && !loading && !isError && visible.length > 0 && (
        <M3eList>
          {visible.map(({ review, work }) => (
            <FavListItem
              key={work.id}
              work={work}
              review={review}
              mode={route} />
          ))}
        </M3eList>
      )}

      {/* 空状态 */}
      {route !== 'folder' && !loading && !isError && visible.length === 0 && (
        <div className='py-16 text-center opacity-60'>
          在作品界面上点击星标、标记进度，标记的音声就会出现在这里啦
        </div>
      )}
    </div>
  );
}

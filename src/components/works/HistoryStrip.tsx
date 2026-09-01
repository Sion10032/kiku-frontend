import { Link } from '@tanstack/react-router';
import { M3eIconButton } from '@m3e/react/icon-button';
import { M3eIcon } from '@m3e/react/icon';
import '@m3e/icons/outlined/arrow_forward';
import { M3eCard } from '@m3e/react/card';
import CoverSFW from '../common/CoverSFW';
import { useRecentHistory } from '../../queries/useHistoryQuery';
import type { Work } from '../../types';

/**
 * 最近收听条带（作品库顶部，横向滚动）。
 *
 * - 显示条件由父级（Works.tsx）控制；本组件只负责：有数据才渲染
 * - 卡片为轻量「封面 + 标题」（不复用 WorkCard thumbnail 模式——
 *   该模式无标题且为 shadow DOM 卡片，条带 10 张开销大，见计划 D4）
 * - 加载中/空数据返回 null（React Query 缓存使回访瞬时）
 */
export default function HistoryStrip() {
  const { data } = useRecentHistory();
  const works = data?.works ?? [];
  if (works.length === 0) return null;

  return (
    <section className='mb-6'>
      <div className='mb-4 flex items-center justify-between'>
        <h1 className='m-0 text-xl'>最近收听</h1>
        <Link to='/history' aria-label='查看全部收听历史'>
          <M3eIconButton>
            <M3eIcon name='arrow_forward' />
          </M3eIconButton>
        </Link>
      </div>

      <div className='flex gap-4 overflow-x-auto pb-1 scrollbar-none [&::-webkit-scrollbar]:hidden'>
        {works.map((work) => (
          <HistoryCard key={work.id} work={work} />
        ))}
      </div>
    </section>
  );
}

/** 条带内轻量卡片：固定宽度封面 + 两行截断标题。 */
function HistoryCard({ work }: { work: Work }) {
  return (
    <M3eCard className='w-48 shrink-0 [--m3e-card-padding:0px]'>
      <div slot='header' className='relative p-0'>
        <CoverSFW
          workId={work.id}
          ageRating={work.ageRating}
          progress={work.userProgress}
        />
      </div>
      <div slot='content' className='flex flex-col gap-1 p-2'>
        <Link
          to='/work/$id'
          params={{ id: work.id }}
          className='line-clamp-2 text-sm no-underline'
        >
          {work.title}
        </Link>
      </div>
    </M3eCard>
  );
}

import { Link } from '@tanstack/react-router';
import { M3eIconButton } from '@m3e/react/icon-button';
import { M3eIcon } from '@m3e/react/icon';
import '@m3e/icons/outlined/arrow_forward';
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
      <div className='mb-2 flex items-center justify-between'>
        <h2 className='m-0 text-base opacity-80'>最近收听</h2>
        <M3eIconButton
          onClick={() => { window.location.href = '/history'; }}
          aria-label='查看全部收听历史'>
          <M3eIcon name='arrow_forward' />
        </M3eIconButton>
      </div>

      <div className='flex gap-4 overflow-x-auto pb-1 scrollbar-none [&::-webkit-scrollbar]:hidden'>
        {works.map(work => (
          <HistoryCard key={work.id} work={work} />
        ))}
      </div>
    </section>
  );
}

/** 条带内轻量卡片：固定宽度封面 + 两行截断标题。 */
function HistoryCard({ work }: { work: Work; }) {
  return (
    <div className='w-40 shrink-0'>
      <CoverSFW workId={work.id} nsfw={work.nsfw} release={work.release} />
      <Link
        to='/work/$id'
        params={{ id: work.id }}
        className='mt-1.5 line-clamp-2 text-sm no-underline'>
        {work.title}
      </Link>
    </div>
  );
}

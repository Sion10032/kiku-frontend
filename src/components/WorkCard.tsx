import { Link } from '@tanstack/react-router';
import { M3eCard } from '@m3e/react/card';
import { M3eChip } from '@m3e/react/chips';
import type { Work } from '../types';
import CoverSFW from './CoverSFW';

interface WorkCardProps {
  work: Work;
  /** 缩略图模式（隐藏文字详情，仅封面 + 标题） */
  thumbnail?: boolean;
}

/**
 * 作品卡片（网格视图）。
 *
 * 展示：封面、标题、圈子、评分（平均分 + 评分人数）、评论数、
 * 价格、售出数、NSFW 标记、标签。
 */
export default function WorkCard({ work, thumbnail = false }: WorkCardProps) {
  return (
    <M3eCard className="h-full">
      <div slot="header" className="p-0">
        <CoverSFW workId={work.id} nsfw={work.nsfw} release={work.release} />
      </div>

      {!thumbnail && (
        <div slot="content" className="flex flex-col gap-2">
          <Link
            to="/work/$id"
            params={{ id: work.id }}
            className="line-clamp-2 text-lg font-normal no-underline"
          >
            {work.title}
          </Link>

          <Link
            to="/works"
            search={{ circleId: work.circle.id }}
            className="truncate text-sm no-underline opacity-70"
          >
            {work.circle.name}
          </Link>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            {/* 平均评分 */}
            {work.rate_average_2dp != null && (
              <span className="font-medium text-[var(--m3e-error)]">
                ★ {work.rate_average_2dp.toFixed(1)}
                <span className="font-normal opacity-60">
                  {' '}
                  ({work.rate_count ?? 0})
                </span>
              </span>
            )}
            {/* 评论数 */}
            {work.review_count != null && work.review_count > 0 && (
              <span className="opacity-70">💬 {work.review_count}</span>
            )}
            {/* DLsite 链接 */}
            <a
              href={dlsiteUrl(work.id)}
              target="_blank"
              rel="noreferrer noopener"
              className="no-underline"
            >
              DLsite
            </a>
          </div>

          <div className="flex flex-wrap items-center gap-x-2 text-sm">
            {work.price != null && (
              <span className="font-medium text-[var(--m3e-error)]">
                {work.price} 日元
              </span>
            )}
            {work.dl_count != null && (
              <span className="opacity-70">售出 {work.dl_count}</span>
            )}
            {!work.nsfw && (
              <span className="rounded-sm bg-[var(--m3e-primary-container)] px-1.5 py-0.5 text-xs">
                全年龄
              </span>
            )}
          </div>
        </div>
      )}

      {!thumbnail && work.tags.length > 0 && (
        <div slot="actions" className="flex flex-wrap gap-1">
          {work.tags.slice(0, 6).map((tag) => (
            <Link key={tag.id} to="/works" search={{ tagId: tag.id }}>
              <M3eChip>{tag.name}</M3eChip>
            </Link>
          ))}
        </div>
      )}
    </M3eCard>
  );
}

function dlsiteUrl(workId: number): string {
  const rj = String(workId).padStart(6, '0');
  return `https://www.dlsite.com/home/work/=/product_id/RJ${rj}.html`;
}

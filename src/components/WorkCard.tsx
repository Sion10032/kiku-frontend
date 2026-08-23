import { Link, useNavigate } from '@tanstack/react-router';
import { M3eCard } from '@m3e/react/card';
import { M3eAssistChip, M3eChipSet } from '@m3e/react/chips';
import '@m3e/icons/outlined/mic';
import type { Work } from '../types';
import CoverSFW from './CoverSFW';
import { M3eIcon } from '@m3e/react/icon';
import { UnreadDot, ReadDot } from './WorkProgress';
import { useUserStore } from '../stores/userStore';

interface WorkCardProps {
  work: Work;
  /** 缩略图模式（隐藏文字详情，仅封面 + 标题） */
  thumbnail?: boolean;
}

/**
 * 作品卡片（网格视图）。
 *
 * 展示：封面、标题、社团、评分（平均分 + 评分人数）、评论数、
 * 价格、售出数、NSFW 标记、标签、声优。
 */
export default function WorkCard({ work, thumbnail = false }: WorkCardProps) {
  const navigate = useNavigate();
  // 未读角标仅登录用户显示（未登录时 userProgress 恒 null，无法区分）
  const authed = useUserStore(s => s.auth);

  // m3e-card 的 slot 边距全部来自 --m3e-card-padding（默认 16px）：
  // 非媒体 header（header slot 直接子节点非 img/video）会被 shadow DOM
  // 加上 margin-inline/block-start 导致封面占不满卡片宽度，此即本卡片的
  // 场景（封面需要 Link 包裹跳转/NSFW 模糊/回退，无法用裸 img 入 slot）。
  // 归零变量后由 content/actions 自行补边距，封面即可铺满全宽。
  const cardVars = thumbnail ? '' : '[--m3e-card-padding:0px]';

  return (
    <M3eCard className={[ 'h-full', cardVars ].join(' ')}>
      <div slot='header' className='relative p-0'>
        <CoverSFW workId={work.id} nsfw={work.nsfw} release={work.release} />
        {/* 状态角标：未读红点 / 已读主色点（仅登录显示） */}
        {authed && (work.userProgress ? <ReadDot /> : <UnreadDot />)}
      </div>

      {!thumbnail && (
        <div slot='content' className={[ 'flex flex-col gap-2 p-4' ].join(' ')}>
          <Link
            to='/work/$id'
            params={{ id: work.id }}
            className='line-clamp-2 text-lg font-normal no-underline'>
            {work.title}
          </Link>

          <Link
            to='/works'
            search={{ circleId: work.circle.id }}
            className='truncate text-sm no-underline opacity-70'>
            {work.circle.name}
          </Link>

          <div className='flex flex-wrap items-center gap-x-2 gap-y-1 text-sm'>
            {/* 平均评分 */}
            {work.rate_average_2dp != null && (
              <span className='font-medium text-(--m3e-error)'>
                ★
                {' '}
                {work.rate_average_2dp.toFixed(1)}
                <span className='font-normal opacity-60'>
                  {' '}
                  (
                  {work.rate_count ?? 0}
                  )
                </span>
              </span>
            )}
            {/* 评论数 */}
            {work.review_count != null && work.review_count > 0 && (
              <span className='opacity-70'>💬 {work.review_count}</span>
            )}
            {/* DLsite 链接 */}
            <a
              href={dlsiteUrl(work.id)}
              target='_blank'
              rel='noreferrer noopener'
              className='no-underline'>
              DLsite
            </a>
          </div>

          <div className='flex flex-wrap items-center gap-x-2 text-sm'>
            {work.price != null && (
              <span className='font-medium text-(--m3e-error)'>
                {work.price} 日元
              </span>
            )}
            {work.dl_count != null && (
              <span className='opacity-70'>售出 {work.dl_count}</span>
            )}
            {!work.nsfw && (
              <span className='rounded-sm bg-(--m3e-primary-container) px-1.5 py-0.5 text-xs'>
                全年龄
              </span>
            )}
          </div>

          {(work.tags.length > 0 || work.vas.length > 0) && (
            <div className='flex flex-col items-start gap-2'>
              {work.tags.length > 0 && (
                <M3eChipSet className='density-1'>
                  {work.tags.slice(0, 6).map(tag => (
                    <M3eAssistChip
                      key={tag.id}
                      variant='elevated'
                      onClick={(e) => {
                        e.preventDefault();
                        navigate({
                          to: '/works',
                          search: { tagId: tag.id },
                        });
                      }}>
                      {tag.name}
                    </M3eAssistChip>
                  ))}
                </M3eChipSet>
              )}
              {work.vas.length > 0 && (
                <M3eChipSet
                  className='density-1'
                  style={{
                    '--m3e-elevated-chip-container-color': 'var(--md-sys-color-primary)',
                    '--m3e-chip-label-text-color': 'var(--md-sys-color-on-primary)',
                    '--m3e-chip-icon-color': 'var(--md-sys-color-on-primary)',
                  } as React.CSSProperties}>
                  {work.vas.slice(0, 6).map(va => (
                    <M3eAssistChip
                      variant='elevated'
                      onClick={(e) => {
                        e.preventDefault();
                        navigate({
                          to: '/works',
                          search: { vaId: va.id },
                        });
                      }}>
                      <M3eIcon slot='icon' name='mic'></M3eIcon>
                      {va.name}
                    </M3eAssistChip>
                  ))}
                </M3eChipSet>
              )}
            </div>
          )}
        </div>
      )}
    </M3eCard>
  );
}

/** DLsite 作品页链接（id 为完整 RJ code） */
function dlsiteUrl(workId: string): string {
  return `https://www.dlsite.com/home/work/=/product_id/${workId}.html`;
}

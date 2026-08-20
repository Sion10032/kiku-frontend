import { Link } from '@tanstack/react-router';
import { M3eListAction } from '@m3e/react/list';
import type { Work } from '../types';
import CoverThumbnail from './CoverThumbnail';
import { useM3eListActionStyle } from '../hooks/useM3eListActionStyle';
import { UnreadDot, ReadDot } from './WorkProgress';
import { useUserStore } from '../stores/userStore';

interface WorkListItemProps {
  work: Work;
  /** 是否显示标签（窄屏可隐藏） */
  showLabel?: boolean;
}

/**
 * 作品列表项（列表视图）。
 *
 * 缩略图（sam）+ 标题 + 圈子 / 声优 + 标签。
 */
export default function WorkListItem({
  work,
  showLabel = true,
}: WorkListItemProps) {
  const ref = useM3eListActionStyle({
    buttonStyle: {
      'slot[name="leading"]': {
        alignSelf: 'center',
      },
      '.content': {
        flex: '1 !important',
      },
    },
  });

  // 状态角标仅登录用户显示（未登录时 userProgress 恒 null，无法区分）
  const authed = useUserStore((s) => s.auth);

  return (
    <M3eListAction ref={ref}>
      <div slot="leading" className="relative">
        <CoverThumbnail workId={work.id} size='lg'/>
        {/* 状态角标：未读红点 / 已读主色点（仅登录显示） */}
        {authed && (work.userProgress ? <ReadDot /> : <UnreadDot />)}
      </div>

      <div className="min-w-0 flex-1">
        <Link
          to="/work/$id"
          params={{ id: work.id }}
          className="line-clamp-2 text-base no-underline"
        >
          {work.title}
        </Link>

        <div className="mt-1 flex flex-wrap items-center gap-x-2 text-sm">
          <Link
            to="/works"
            search={{ circleId: work.circle.id }}
            className="no-underline opacity-70"
          >
            {work.circle.name}
          </Link>
          {work.vas.map((va) => (
            <Link
              key={va.id}
              to="/works"
              search={{ vaId: va.id }}
              className="no-underline"
              style={{ color: 'var(--m3e-primary)' }}
            >
              {va.name}
            </Link>
          ))}
        </div>

        {showLabel && work.tags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-x-2 text-sm opacity-70">
            {work.tags.map((tag) => (
              <Link
                key={tag.id}
                to="/works"
                search={{ tagId: tag.id }}
                className="no-underline"
              >
                {tag.name}
              </Link>
            ))}
          </div>
        )}
      </div>
    </M3eListAction>
  );
}

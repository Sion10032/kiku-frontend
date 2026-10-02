import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { M3eListAction } from '@m3e/react/list';
import type { Work } from '../../types';
import AgeRatingBadge from '../common/AgeRatingBadge';
import CoverThumbnail from '../common/CoverThumbnail';
import { useM3eListActionStyle } from '../../hooks/useM3eListActionStyle';
import { fieldQuery } from '../../utils/query';
import { formatProgress } from '../../utils/format';
import clsx from 'clsx';

interface WorkListItemProps {
  work: Work;
  /** 是否显示标签（窄屏可隐藏） */
  showLabel?: boolean;
}

/**
 * 作品列表项（列表视图）。
 *
 * 缩略图（sam，右下收听状态角标）+ workcode / 分级徽章 + 标题 + 社团 / 声优 + 标签。
 */
export default function WorkListItem({
  work,
  showLabel = true,
}: WorkListItemProps) {
  const { t } = useTranslation();
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

  // 右下角收听状态角标（样式同 WorkCard 封面右下角，按需求省略总时长）：
  // 已读 → 「已读」；有进度 → 百分比 / 「正在听」；未听/未登录（read=false、
  // userProgress=null）不渲染，无需 authed 门控
  const cornerText = work.read
    ? t('common.read')
    : formatProgress(work.userProgress);

  return (
    <M3eListAction ref={ref}>
      <div slot='leading' className='relative'>
        <CoverThumbnail workId={work.id} size='lg' />
        {/* 收听状态角标：已读 / 进度百分比 / 正在听 */}
        {cornerText && (
          <span className='absolute right-1 bottom-1 z-10 rounded-sm bg-(--md-sys-color-surface-container) px-1.5 py-0.5 text-xs text-(--md-sys-color-on-surface-container)'>
            {cornerText}
          </span>
        )}
      </div>

      <div className='min-w-0 flex-1'>
        {/* workcode / 分级徽章内联在标题行首：换行后标题回到左缘，不流空列；
            徽章占据首行部分宽度，两行裁剪仍在 Link 上生效 */}
        <Link
          to='/work/$id'
          params={{ id: work.id }}
          className='line-clamp-2 text-base no-underline'
        >
          <span className='mr-2 rounded-sm bg-(--md-sys-color-surface-container) px-1.5 py-0.5 text-xs text-(--md-sys-color-on-surface-container)'>
            {work.id}
          </span>
          <span className='mr-2'>
            <AgeRatingBadge rating={work.ageRating} />
          </span>
          {work.title}
        </Link>

        <div className='mt-1 flex flex-wrap items-center gap-x-2 text-sm'>
          <Link
            to='/works'
            search={{ q: fieldQuery('circle', work.circle.name) }}
            className='no-underline opacity-70'
          >
            {work.circle.name}
          </Link>
          {work.series && (
            <>
              <span className='opacity-70'>·</span>
              <Link
                to='/works'
                search={{ q: fieldQuery('series', work.series.name) }}
                className='no-underline opacity-70'
              >
                {work.series.name}
              </Link>
            </>
          )}
          {work.vas.map((va) => (
            <Link
              key={va.id}
              to='/works'
              search={{ q: fieldQuery('va', va.name) }}
              className={clsx('no-underline', va.overridden && 'opacity-80')}
              style={{ color: 'var(--m3e-primary)' }}
              title={va.overridden ? t('works.overridden-added') : undefined}
            >
              {va.name}
            </Link>
          ))}
        </div>

        {showLabel && work.tags.length > 0 && (
          <div className='mt-1 flex flex-wrap gap-x-2 text-sm opacity-70'>
            {work.tags.map((tag) => (
              <Link
                key={tag.id}
                to='/works'
                search={{ q: fieldQuery('tag', tag.name) }}
                className={clsx('no-underline', tag.overridden && 'opacity-80')}
                title={tag.overridden ? t('works.overridden-added') : undefined}
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

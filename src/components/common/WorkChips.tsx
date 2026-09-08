import { useNavigate } from '@tanstack/react-router';
import { M3eAssistChip, M3eChipSet } from '@m3e/react/chips';
import { M3eIcon } from '@m3e/react/icon';
import '@m3e/icons/outlined/mic';
import type { Work } from '../../types';
import { vaChipSetStyles } from './chipStyles';
import { fieldQuery } from '../../utils/query';

interface WorkChipsProps {
  work: Work;
}

/**
 * 标签 + 声优 ChipSet（WorkCard / WorkDetails 共用）。
 *
 * 点击跳转 /works 对应字段筛选；两者皆空时渲染 null。
 * 声优 chip 为主色容器 + mic 图标（样式见 chipStyles）。
 */
export default function WorkChips({ work }: WorkChipsProps) {
  const navigate = useNavigate();

  if (work.tags.length === 0 && work.vas.length === 0) return null;

  return (
    <div className='flex flex-col items-start gap-2'>
      {work.tags.length > 0 && (
        <M3eChipSet className='density-1'>
          {work.tags.map((tag) => (
            <M3eAssistChip
              key={tag.id}
              variant='elevated'
              onClick={() =>
                navigate({
                  to: '/works',
                  search: { q: fieldQuery('tag', tag.name) },
                })
              }
              className={tag.overridden ? 'opacity-60' : undefined}
            >
              {tag.name}
            </M3eAssistChip>
          ))}
        </M3eChipSet>
      )}
      {work.vas.length > 0 && (
        <M3eChipSet className='density-1' style={vaChipSetStyles}>
          {work.vas.map((va) => (
            <M3eAssistChip
              key={va.id}
              variant='elevated'
              onClick={() =>
                navigate({
                  to: '/works',
                  search: { q: fieldQuery('va', va.name) },
                })
              }
              className={va.overridden ? 'opacity-60' : undefined}
            >
              <M3eIcon slot='icon' name='mic' />
              {va.name}
            </M3eAssistChip>
          ))}
        </M3eChipSet>
      )}
    </div>
  );
}

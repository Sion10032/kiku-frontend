import { M3eDialog } from '@m3e/react/dialog';
import { M3eButton } from '@m3e/react/button';
import FavButton from './FavButton';
import { useFavouriteStatus } from '../../queries/useFavouritesQuery';
import type { Work } from '../../types';

interface FavDialogProps {
  /** 对话框是否打开（M3eDialog 受控 open 属性） */
  open: boolean;
  /** 关闭回调（点取消 / 点 backdrop / 关闭按钮时触发） */
  onClose: () => void;
  /** 当前作品（决定可收藏目标：作品本体 / 系列 / 社团 / 声优） */
  work: Work;
}

/**
 * 收藏对话框：作品详情页唯一的收藏入口。
 * 列出当前作品所有可收藏目标（作品本体 / 系列 / 社团 / 每个声优），
 * 每行行内 FavButton 直接切换收藏状态（乐观更新，无需确定按钮）。
 *
 * - 四类 useFavouriteStatus 无条件调用（未登录时 hook 内部自动 disabled；
 *   系列 / 声优可能为空，空 ids 同样不发请求）
 * - favourited 直接传三态 data?.[id]：undefined 时 FavButton 不渲染，
 *   匿名用户看不到心形
 * - 行不可点击、无跳转，纯切换用途
 */
export default function FavDialog({ open, onClose, work }: FavDialogProps) {
  // 社团 id 后端为 number，收藏接口统一用 string
  const circleId = String(work.circle.id);

  // 收藏状态（四类目标各一次批量查询）
  const workFav = useFavouriteStatus('work', [work.id]);
  const circleFav = useFavouriteStatus('circle', [circleId]);
  const seriesFav = useFavouriteStatus(
    'series',
    work.series ? [work.series.id] : [],
  );
  const vaFav = useFavouriteStatus(
    'va',
    work.vas.map((v) => v.id),
  );

  return (
    <M3eDialog open={open} onClosed={onClose} dismissible closeLabel='关闭'>
      <span slot='header'>收藏</span>

      <div className='flex flex-col gap-4 py-2'>
        {/* 作品：仅标题行（按需求不放封面缩略图 / RJ 号） */}
        <section className='flex flex-col gap-1'>
          <span className='text-xs opacity-60'>作品</span>
          <div className='flex items-center justify-between gap-3'>
            <span className='min-w-0 truncate text-sm'>{work.title}</span>
            <FavButton
              size='sm'
              targetType='work'
              targetId={work.id}
              favourited={workFav.data?.[work.id]}
            />
          </div>
        </section>

        {/* 系列（单值归属，无系列时不渲染该节） */}
        {work.series && (
          <section className='flex flex-col gap-1'>
            <span className='text-xs opacity-60'>系列</span>
            <div className='flex items-center justify-between gap-3'>
              <span className='min-w-0 truncate text-sm'>
                {work.series.name}
              </span>
              <FavButton
                size='sm'
                targetType='series'
                targetId={work.series.id}
                favourited={seriesFav.data?.[work.series.id]}
              />
            </div>
          </section>
        )}

        {/* 社团 */}
        <section className='flex flex-col gap-1'>
          <span className='text-xs opacity-60'>社团</span>
          <div className='flex items-center justify-between gap-3'>
            <span className='min-w-0 truncate text-sm'>{work.circle.name}</span>
            <FavButton
              size='sm'
              targetType='circle'
              targetId={circleId}
              favourited={circleFav.data?.[circleId]}
            />
          </div>
        </section>

        {/* 声优（每个声优一行） */}
        {work.vas.length > 0 && (
          <section className='flex flex-col gap-1'>
            <span className='text-xs opacity-60'>声优</span>
            {work.vas.map((va) => (
              <div
                key={va.id}
                className='flex items-center justify-between gap-3'
              >
                <span className='min-w-0 truncate text-sm'>{va.name}</span>
                <FavButton
                  size='sm'
                  targetType='va'
                  targetId={va.id}
                  favourited={vaFav.data?.[va.id]}
                />
              </div>
            ))}
          </section>
        )}
      </div>

      {/* 底部操作：状态切换即时生效，仅保留取消（关闭） */}
      <div slot='actions' className='flex justify-end'>
        <M3eButton variant='text' onClick={onClose}>
          取消
        </M3eButton>
      </div>
    </M3eDialog>
  );
}

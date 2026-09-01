import type { Work } from '../../types';

interface WorkFactsRowProps {
  work: Work;
  /** 发售日文本（详情页显示，卡片不显示） */
  release?: string | null;
}

/**
 * 作品数据行：价格 / 售出数 / 发售日，全部条件渲染。
 *
 * 总时长不在此行（叠加在封面右下角，见 CoverSFW）；
 * 分级徽章叠加在封面左上角。
 */
export default function WorkFactsRow({ work, release }: WorkFactsRowProps) {
  return (
    <div className='flex flex-wrap items-center gap-x-3 gap-y-1 text-sm'>
      {work.price != null && (
        <span className='font-medium text-(--md-sys-color-error)'>
          {work.price} 日元
        </span>
      )}
      {work.dl_count != null && (
        <span className='opacity-70'>售出 {work.dl_count}</span>
      )}
      {release && <span className='opacity-70'>{release}</span>}
    </div>
  );
}

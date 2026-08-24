import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { mediaUrl } from '../../api/client';
import { useSettingsStore } from '../../stores/settingsStore';

interface CoverSFWProps {
  /** 作品 id，完整 RJ code（如 "RJ01173549"） */
  workId: string;
  /** 是否为 NSFW 作品（PC 端默认模糊，hover 显示） */
  nsfw?: boolean;
  release?: string | null;
  /** 缩略图模式（列表用，固定小尺寸） */
}

/**
 * 封面图（NSFW 模糊）。
 *
 * - 显示 RJ 编号角标与发售日期（加载失败时同样显示）
 * - 加载失败时仅用同尺寸占位替换 img，角标/日期 overlay 不受影响
 * - 模糊行为由设置项「NSFW 封面」控制（settingsStore.coverBlurMode）：
 *   始终模糊 / 悬浮显示（默认模糊，鼠标悬停显示）/ 始终显示，对所有端生效
 *
 * 后端 cover 端点：/api/cover/:id（?type=sam 缩略图）。
 */
export default function CoverSFW({
  workId,
  nsfw = true,
  release,
}: CoverSFWProps) {
  const [ hovering, setHovering ] = useState(false);
  const [ failed, setFailed ] = useState(false);
  const blurMode = useSettingsStore(s => s.coverBlurMode);
  const src = mediaUrl(`/api/cover/${workId}/file`);

  const shouldBlur = nsfw && (blurMode === 'always' || (blurMode === 'hover' && !hovering));

  // img 与占位共享的尺寸类，失败时占位保持与封面相同的占位大小
  const frameClass = 'aspect-[4/3] w-full';

  return (
    <Link
      to='/work/$id'
      params={{ id: workId }}
      // w-full：m3e-card 会把 slotted 的 header 强制为 flex 容器
      // （::slotted([slot=header]) { display: flex }），Link 作为 flex item
      // 默认收缩到内容宽度，封面/占位会缩成小块，需显式占满。
      // 非 thumbnail：顶部圆角对齐卡片圆角（corner-medium 12px）并裁剪
      // NSFW 模糊时 filter 的边缘溢出
      className={[
        'relative block w-full',
        'overflow-hidden rounded-t-xl',
      ].join(' ')}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}>
      {failed
        ? (
          <div className={[ 'bg-black/10', frameClass ].join(' ')} />
        )
        : (
          <img
            src={src}
            alt={workId}
            loading='lazy'
            onError={() => setFailed(true)}
            className={[
              'w-full bg-black/5 object-cover transition-[filter] duration-200',
              frameClass,
              shouldBlur ? 'blur-[10px]' : '',
            ].join(' ')} />
        )}

      <span className='absolute left-0 top-0 m-2 rounded-sm bg-black/70 px-1.5 py-0.5 text-xs text-white'>
        {workId}
      </span>
      {release && (
        <span className='absolute bottom-0 right-0 m-1 rounded bg-black/60 px-1 text-xs text-white'>
          {release}
        </span>
      )}
    </Link>
  );
}

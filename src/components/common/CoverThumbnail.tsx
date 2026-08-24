import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { mediaUrl } from '../../api/client';

interface CoverThumbnailProps {
  /** 作品 id，完整 RJ code（如 "RJ01173549"） */
  workId: string;
  /** 封面尺寸，默认 w-14 h-14 (56px) */
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_MAP = {
  sm: 'w-10 h-10', // 40px
  md: 'w-14 h-14', // 56px
  lg: 'w-20 h-20', // 80px
};

/**
 * 列表视图缩略图封面。
 *
 * 固定正方形尺寸，圆角裁剪。
 * 缩略图不显示发售日期、RJ 号角标，不做 NSFW 模糊。
 */
export default function CoverThumbnail({
  workId,
  size = 'md',
}: CoverThumbnailProps) {
  const [ failed, setFailed ] = useState(false);
  const src = mediaUrl(`/api/cover/${workId}/file?type=sam`);
  const sizeClass = SIZE_MAP[size];

  return (
    <Link
      to='/work/$id'
      params={{ id: workId }}
      className={`relative block shrink-0 overflow-hidden rounded-lg ${sizeClass}`}>
      {failed
        ? (
          <div className='h-full w-full bg-black/10' />
        )
        : (
          <img
            src={src}
            alt={workId}
            loading='lazy'
            onError={() => setFailed(true)}
            className='h-full w-full bg-black/5 object-cover' />
        )}
      {/* <span className="absolute left-0 top-0 m-0.5 rounded-sm bg-black/70 px-1 py-px text-[10px] leading-tight text-white">
        {workId}
      </span> */}
    </Link>
  );
}

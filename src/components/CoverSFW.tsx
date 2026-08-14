import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { mediaUrl } from '../api/client';

interface CoverSFWProps {
  workId: number;
  /** 是否为 NSFW 作品（PC 端默认模糊，hover 显示） */
  nsfw?: boolean;
  release?: string | null;
  /** 缩略图模式（列表用，固定小尺寸） */
  thumbnail?: boolean;
}

/**
 * 封面图（NSFW 模糊）。
 *
 * - 显示 RJ 编号角标与发售日期
 * - PC 端 NSFW 封面默认模糊，鼠标悬停显示
 * - 移动端始终清晰显示
 *
 * 后端 cover 端点：/api/cover/:id（?type=sam 缩略图）。
 */
export default function CoverSFW({
  workId,
  nsfw = true,
  release,
  thumbnail = false,
}: CoverSFWProps) {
  const [blur, setBlur] = useState(true);
  const rjcode = `000000${workId}`.slice(-6);
  const src = mediaUrl(`/api/cover/${workId}${thumbnail ? '?type=sam' : ''}`);

  const shouldBlur = nsfw && blur && !isMobile() && !thumbnail;

  return (
    <Link
      to="/work/$id"
      params={{ id: workId }}
      className="relative block"
      onMouseEnter={() => setBlur(false)}
      onMouseLeave={() => setBlur(true)}
    >
      <img
        src={src}
        alt={`RJ${rjcode}`}
        loading="lazy"
        className={[
          'w-full bg-black/5 object-cover transition-[filter] duration-200',
          thumbnail ? 'h-[60px] w-[60px]' : 'aspect-[4/3]',
          shouldBlur ? 'blur-[10px]' : '',
        ].join(' ')}
      />
      <span className="absolute left-0 top-0 m-2 rounded-sm bg-black/70 px-1.5 py-0.5 text-xs text-white">
        RJ{rjcode}
      </span>
      {release && !thumbnail && (
        <span className="absolute bottom-0 right-0 m-1 rounded bg-black/60 px-1 text-xs text-white">
          {release}
        </span>
      )}
    </Link>
  );
}

function isMobile(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(pointer: coarse)').matches;
}

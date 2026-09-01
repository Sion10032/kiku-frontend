import { useState } from 'react';
import clsx from 'clsx';
import { Link } from '@tanstack/react-router';
import { mediaUrl } from '../../api/client';
import { useSettingsStore } from '../../stores/settingsStore';
import { formatProgress, formatTotalDuration } from '../../utils/format';
import type { AgeRating, UserWorkProgress } from '../../types';
import AgeRatingBadge from './AgeRatingBadge';

interface CoverSFWProps {
  /** 作品 id，完整 RJ code（如 "RJ01173549"） */
  workId: string;
  /** 年龄分级（仅 r18 模糊；缺省 'r18' 保守处理，与旧 nsfw=true 一致） */
  ageRating?: AgeRating;
  /** 播放进度聚合；有记录时右下角显示进度（xx% / 正在听） */
  progress?: UserWorkProgress | null;
  /** 作品总时长（秒）；有数据时右下角与进度并排显示（如 "5.4 小时"） */
  duration?: number | null;
  /** 缩略图模式（列表用，固定小尺寸） */
}

/**
 * 封面图（R18 模糊）。
 *
 * - 左上角 RJ 编号角标、右上角分级徽章、右下角进度 · 总时长（加载失败时同样显示）
 * - 加载失败时仅用同尺寸占位替换 img，角标/日期 overlay 不受影响
 * - 年龄分级（仅 R18 模糊）
 * - 模糊行为由设置项「R18 封面」控制（settingsStore.coverBlurMode）：
 *   始终模糊 / 悬浮显示（默认模糊，鼠标悬停显示）/ 始终显示，对所有端生效
 *
 * 后端 cover 端点：/api/cover/:id（?type=sam 缩略图）。
 */
export default function CoverSFW({
  workId,
  ageRating = 'r18',
  progress,
  duration,
}: CoverSFWProps) {
  const [hovering, setHovering] = useState(false);
  const [failed, setFailed] = useState(false);
  const blurMode = useSettingsStore((s) => s.coverBlurMode);
  const src = mediaUrl(`/api/cover/${workId}/file`);
  const progressText = formatProgress(progress);
  const durationText = formatTotalDuration(duration);
  // 右下角：进度 · 总时长，按数据可用性显示两项/一项/不显示
  const cornerText = [progressText, durationText]
    .filter(Boolean)
    .join(' · ');

  const shouldBlur =
    ageRating === 'r18'
    && (blurMode === 'always' || (blurMode === 'hover' && !hovering));

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
      // R18 模糊时 filter 的边缘溢出
      className={clsx(
        'relative block w-full',
        'overflow-hidden rounded-t-(--md-sys-shape-corner-medium)',
      )}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {failed ? (
        <div className={clsx('bg-black/10', frameClass)} />
      ) : (
        <img
          src={src}
          alt={workId}
          loading='lazy'
          onError={() => setFailed(true)}
          className={clsx(
            // block：无 preflight 时 img 仍是 inline，基线下方 descender 空隙会撑高 <a>
            'block w-full bg-black/5 object-cover transition-[filter] duration-200',
            frameClass,
            shouldBlur && 'blur-[10px]',
          )}
        />
      )}

      {/* 左上角 RJ 编号 */}
      <span className='absolute left-0 top-0 m-2 rounded-sm bg-(--md-sys-color-surface-container)/85 px-1.5 py-0.5 text-xs text-white'>
        {workId}
      </span>
      {/* 右上角分级徽章（原内容区 AgeRatingBadge 上移，缩略图模式也能看到分级） */}
      <span className='absolute right-0 top-0 m-2'>
        <AgeRatingBadge rating={ageRating} />
      </span>
      {/* 右下角：进度 · 总时长（两项/一项/不显示，视数据而定） */}
      {cornerText && (
        <span className='absolute bottom-0 right-0 m-2 rounded-sm bg-(--md-sys-color-surface-container)/85 px-1.5 py-0.5 text-xs text-white'>
          {cornerText}
        </span>
      )}
    </Link>
  );
}

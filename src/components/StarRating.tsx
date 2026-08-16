import { useState } from 'react';
import { M3eIcon } from '@m3e/react/icon';
import '@m3e/icons/outlined/star';

const STAR_POINTS = [1, 2, 3, 4, 5] as const;

interface StarRatingProps {
  /** 当前评分（0-5，0 表示未评分） */
  value: number;
  /** 点击第 n 颗星时回调（1-5） */
  onChange: (value: number) => void;
  /** 图标大小（CSS font-size，默认 1.5rem 对齐 m3e 图标默认尺寸） */
  size?: string;
  /** 是否禁用交互 */
  disabled?: boolean;
}

/**
 * 自定义星级评分组件：M3eIcon star（filled 实心）/ 未填充（描边）自绘。
 *
 * 交互：
 * - 点击第 n 颗星即选中（onChange(n)）
 * - 悬停预览：悬停到第 n 颗星时临时高亮 1..n，移出后恢复为已选值
 *
 * 未填充星用 opacity 弱化（与 FavListItem 的评价星一致），填充星用
 * primary token 着色，不硬编码颜色。
 */
export default function StarRating({
  value,
  onChange,
  size = '1.5rem',
  disabled = false,
}: StarRatingProps) {
  const [hover, setHover] = useState(0);
  // 悬停预览优先于已选值
  const active = hover > 0 ? hover : value;

  return (
    <div
      role="radiogroup"
      aria-label="评分"
      className="flex items-center"
      onMouseLeave={() => setHover(0)}
    >
      {STAR_POINTS.map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} 星`}
          disabled={disabled}
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          className="cursor-pointer border-none bg-transparent p-0 leading-none disabled:cursor-default"
          style={{ fontSize: size }}
        >
          <M3eIcon
            name="star"
            filled={n <= active}
            className={
              n <= active
                ? 'text-[var(--md-sys-color-primary)]'
                : 'opacity-25'
            }
          />
        </button>
      ))}
    </div>
  );
}

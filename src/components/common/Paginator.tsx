import { M3eIconButton } from '@m3e/react/icon-button';
import { M3eIcon } from '@m3e/react/icon';
import '@m3e/icons/outlined/first_page';
import '@m3e/icons/outlined/chevron_left';
import '@m3e/icons/outlined/chevron_right';
import '@m3e/icons/outlined/last_page';

/**
 * 自研分页控件，替换 m3e-paginator。
 *
 * 替换原因：m3e-paginator 的 shadow DOM（内部 tooltip / popover 常挂载元素）
 * 在 Firefox 下逃逸 main 滚动容器的裁剪，导致视口级溢出
 * （复现与调查证据见 plans/replace-m3e-paginator.md）。
 *
 * 仅实现调用点用到的能力：首末页 / 上下页按钮 + 范围文本，
 * 无 popover / tooltip / 定位浮层（提示用 title 属性替代）。
 * 受控模式：组件不维护页码状态，翻页通过 onPage 上报。
 */
interface PaginatorProps {
  /** 总条数 */
  length: number;
  /** 每页条数 */
  pageSize: number;
  /** 当前页码（0 起） */
  pageIndex: number;
  /** 禁用全部按钮（如翻页请求进行中） */
  disabled?: boolean;
  /** 翻页回调（0 起） */
  onPage: (pageIndex: number) => void;
}

/** 范围文本，语义照抄 m3e-paginator 默认 formatter：「0 of N」/「start - end of N」 */
function rangeLabel(
  length: number,
  pageSize: number,
  pageIndex: number,
): string {
  const len = Math.max(length, 0);
  if (len === 0 || pageSize <= 0) return `0 of ${len}`;

  const start = pageIndex * pageSize;
  const end = start < len ? Math.min(start + pageSize, len) : start + pageSize;
  return `${start + 1} - ${end} of ${len}`;
}

export default function Paginator({
  length,
  pageSize,
  pageIndex,
  disabled = false,
  onPage,
}: PaginatorProps) {
  // 页数与边界判断，语义对齐 m3e-paginator 的 pageCount / hasPreviousPage / hasNextPage
  const pageCount = pageSize > 0 ? Math.ceil(length / pageSize) : 0;
  const hasPrevious = pageIndex >= 1;
  const hasNext = pageIndex < pageCount - 1;

  return (
    <>
      <span className='mx-2 text-sm opacity-70'>
        {rangeLabel(length, pageSize, pageIndex)}
      </span>
      <M3eIconButton
        aria-label='第一页'
        title='第一页'
        disabled={disabled || !hasPrevious}
        onClick={() => onPage(0)}
      >
        <M3eIcon name='first_page' />
      </M3eIconButton>
      <M3eIconButton
        aria-label='上一页'
        title='上一页'
        disabled={disabled || !hasPrevious}
        onClick={() => onPage(pageIndex - 1)}
      >
        <M3eIcon name='chevron_left' />
      </M3eIconButton>
      <M3eIconButton
        aria-label='下一页'
        title='下一页'
        disabled={disabled || !hasNext}
        onClick={() => onPage(pageIndex + 1)}
      >
        <M3eIcon name='chevron_right' />
      </M3eIconButton>
      <M3eIconButton
        aria-label='最后一页'
        title='最后一页'
        disabled={disabled || !hasNext}
        onClick={() => onPage(pageCount - 1)}
      >
        <M3eIcon name='last_page' />
      </M3eIconButton>
    </>
  );
}

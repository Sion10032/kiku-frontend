import { useState } from 'react';
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
 * 仅实现调用点用到的能力：首末页 / 上下页按钮 + 「当前页 / 总页数」，
 * 当前页为可编辑输入框，回车或失焦提交跳页（无 popover / tooltip / 定位浮层，
 * 提示用 title 属性替代）。受控模式：组件不维护页码状态，翻页通过 onPage 上报。
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

/** 展示用的当前页（1 起），pageIndex 越界时按总页数收敛，避免显示幽灵页码 */
function displayPage(pageIndex: number, pageCount: number): number {
  return Math.min(pageIndex + 1, Math.max(pageCount, 1));
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
  const currentPage = displayPage(pageIndex, pageCount);

  // 跳页输入框的 draft：null 表示非编辑态，直接显示当前页——外部 pageIndex
  // 变化（翻页成功）即时反映，无需 effect 同步；非 null 仅在编辑期间持有
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? String(currentPage);

  // 提交跳页：解析失败回滚；越界 clamp 到 [1, 总页数]；与当前页相同则不上报
  const commitDraft = () => {
    if (draft == null) return;
    const n = Number.parseInt(draft, 10);
    setDraft(null);
    if (Number.isNaN(n)) return;
    const target = Math.min(Math.max(n, 1), Math.max(pageCount, 1));
    if (target !== currentPage) onPage(target - 1);
  };

  return (
    <>
      <span
        className='mx-2 flex items-center gap-1 whitespace-nowrap text-sm'
        title={`共 ${length} 条`}
      >
        <input
          aria-label='当前页码，输入后回车跳页'
          inputMode='numeric'
          // leading 显式等于 content-box 高（h-6 24px − 上下 border 2px）：
          // 输入框文字垂直居中的跨浏览器保底，避免依赖 UA 默认行为
          className='h-5 w-9 rounded-(--md-sys-shape-corner-extra-small) border border-current/30 bg-transparent px-1 py-0 text-center text-sm tabular-nums outline-none hover:border-current/50 focus:border-current/80 disabled:opacity-50'
          value={shown}
          disabled={disabled || pageCount <= 0}
          onChange={(e) => setDraft(e.target.value.replace(/\D+/g, ''))}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitDraft();
            if (e.key === 'Escape') {
              setDraft(null);
              e.currentTarget.blur();
            }
          }}
        />
        <span className='opacity-70'>/ {Math.max(pageCount, 1)}</span>
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

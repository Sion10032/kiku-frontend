import clsx from 'clsx';
import type { ReactNode } from 'react';

import PageContainer, { type PageWidthBase } from '../common/PageContainer';

interface DashboardPageProps {
  /** 页面版式基准（默认 form，672px 档） */
  base?: PageWidthBase;
  /**
   * 滚动模式（默认 true）：由外层全宽容器滚动，滚动条贴视口右缘；
   * 传 false 则外层不滚动，限宽列撑满高度，由页面自行划分固定区 / 滚动区。
   */
  scroll?: boolean;
  /** 附加到限宽列：页面在此声明 flex / gap 等块间布局 */
  className?: string;
  children: ReactNode;
}

/**
 * 管理后台页壳：外层全宽滚动容器 + 内层限宽列。
 *
 * 分两层的原因：限宽列（PageContainer，mx-auto max-w-*）不能同时充当滚动容器，
 * 否则滚动条会落在内容列右缘 —— 列越窄、屏幕越宽越靠屏幕中间。内边距同理放
 * 外层，限宽列的 border-box 才是完整宽度（form 档 672px）。
 *
 * - 默认（scroll）：整页滚动，限宽列按内容自然高度；普通页传
 *   `flex flex-col gap-4` 即可。
 * - `scroll={false}`：外层只给高度，限宽列 `h-full`，页面自行划分固定区 /
 *   滚动区（音声管理：扫描器 / 搜索行 / 已选栏 / 分页常驻，表体
 *   `min-h-0 flex-1 overflow-auto` 滚动）。
 * - gap 同样由各页面显式声明，壳不代为设置。
 * - 加载 / 错误等早退分支也应包在本壳内，保证窄容器版式一致。
 */
export default function DashboardPage({
  base = 'form',
  scroll = true,
  className,
  children,
}: DashboardPageProps) {
  return (
    <div
      className={clsx(
        'h-full p-6',
        scroll ? 'overflow-y-auto' : 'overflow-hidden',
      )}
    >
      <PageContainer
        base={base}
        className={clsx(!scroll && 'h-full', className)}
      >
        {children}
      </PageContainer>
    </div>
  );
}

import type { ReactNode } from 'react';
import clsx from 'clsx';
import {
  useSettingsStore,
  type ContentWidth,
} from '../../stores/settingsStore';

/**
 * 页面版式基准：决定 standard 档下页面自身保留的上限。
 *
 * - narrow：窄列表页（收藏/列表/我的评论，768px）
 * - form：单列表单页（设置/管理后台，672px）
 * - detail：作品详情（1400px）
 * - wide：宽列表页（作品库/收听历史，1680px）
 */
export type PageWidthBase = 'narrow' | 'form' | 'detail' | 'wide';

/**
 * base × contentWidth 档位 → max-w 类字面量映射。
 * 规则：实际上限 = max(页面自身上限, 档位上限)，只会放宽不会收窄；
 * 档位上限 standard 无 / wide 1280px / ultra 1680px / full 不限宽。
 * 必须写成完整类名字面量，Tailwind JIT 才能扫描到。
 */
const MAX_W_CLASSES: Record<ContentWidth, Record<PageWidthBase, string>> = {
  standard: {
    narrow: 'max-w-3xl',
    form: 'max-w-2xl',
    detail: 'max-w-350',
    wide: 'max-w-[1680px]',
  },
  wide: {
    narrow: 'max-w-[1280px]',
    form: 'max-w-[1280px]',
    // 1400px > 1280px，维持自身上限
    detail: 'max-w-350',
    wide: 'max-w-[1680px]',
  },
  ultra: {
    narrow: 'max-w-[1680px]',
    form: 'max-w-[1680px]',
    detail: 'max-w-[1680px]',
    wide: 'max-w-[1680px]',
  },
  // 不限宽：块级 div 默认占满，空串即去掉 max-w
  full: { narrow: '', form: '', detail: '', wide: '' },
};

interface PageContainerProps {
  /** 页面版式基准（默认 narrow） */
  base?: PageWidthBase;
  className?: string;
  children: ReactNode;
}

/**
 * 页面内容容器：居中限宽，宽度受设置 contentWidth 档位控制
 * （标准 / 宽 1280px / 更宽 1680px / 铺满，见 settingsStore）。
 * 替代各页写死的 `mx-auto max-w-*`；登录/注册/Setup 等独立整页表单不使用本组件。
 */
export default function PageContainer({
  base = 'narrow',
  className,
  children,
}: PageContainerProps) {
  const contentWidth = useSettingsStore((s) => s.contentWidth);
  return (
    <div
      className={clsx(
        'mx-auto w-full',
        MAX_W_CLASSES[contentWidth][base],
        className,
      )}
    >
      {children}
    </div>
  );
}

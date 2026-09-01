import type { ReactNode } from 'react';

/**
 * 管理后台页壳：与主站设置页（pages/Settings.tsx）一致的版式 ——
 * 居中 max-w-2xl 容器 + text-2xl 页标题，块间 gap-4。
 * 加载 / 错误等早退分支也应包在本壳内，保证窄容器版式一致。
 */
export default function DashboardPage({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className='mx-auto flex max-w-2xl flex-col gap-4'>
      <h1 className='m-0 text-2xl font-normal'>{title}</h1>
      {children}
    </div>
  );
}

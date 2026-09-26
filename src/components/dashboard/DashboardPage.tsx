import type { ReactNode } from 'react';

import PageContainer from '../common/PageContainer';

/**
 * 管理后台页壳：与主站设置页（pages/Settings.tsx）一致的版式 ——
 * form 基准容器（PageContainer，standard 档 672px）+ text-2xl 页标题，块间 gap-4。
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
    <PageContainer base='form' className='flex flex-col gap-4'>
      <h1 className='m-0 text-2xl font-normal'>{title}</h1>
      {children}
    </PageContainer>
  );
}

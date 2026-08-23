import { Outlet, Link } from '@tanstack/react-router';
import { M3eAppBar } from '@m3e/react/app-bar';
import { M3eButton } from '@m3e/react/button';

interface NavEntry {
  to: string;
  label: string;
}

const NAV_ENTRIES: NavEntry[] = [
  { to: '/admin', label: '文件夹' },
  { to: '/admin/scanner', label: '扫描器' },
  { to: '/admin/advanced', label: '高级' },
  { to: '/admin/usermanage', label: '用户管理' },
];

/**
 * 管理后台布局：顶部应用栏（含返回主站）+ 横向导航 + 内容区。
 * 各页面在步骤 13 实现。
 */
export default function DashboardLayout() {
  return (
    <div className='flex h-dvh flex-col overflow-hidden'>
      <M3eAppBar>
        <span slot='leading'>
          <Link to='/works' className='no-underline'>
            <M3eButton variant='text'>← 返回</M3eButton>
          </Link>
        </span>
        <span slot='headline' className='text-xl font-medium'>
          管理后台
        </span>
      </M3eAppBar>

      <nav className='flex min-h-12 flex-0 items-center gap-1 overflow-x-auto border-b border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container)] px-4 py-2'>
        {NAV_ENTRIES.map(entry => (
          <Link
            key={entry.to}
            to={entry.to}
            className='whitespace-nowrap rounded-full px-4 py-2 text-[var(--md-sys-color-on-surface)] no-underline data-[active]:font-semibold data-[active]:bg-[var(--md-sys-color-primary-container)]'
            activeProps={{ 'data-active': '' }}
            activeOptions={{ exact: entry.to === '/admin' }}>
            {entry.label}
          </Link>
        ))}
      </nav>

      <main className='flex-1 overflow-y-auto p-6'>
        <Outlet />
      </main>
    </div>
  );
}

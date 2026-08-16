import { Outlet, Link, useNavigate } from '@tanstack/react-router';
import { M3eAppBar } from '@m3e/react/app-bar';
import { M3eButton } from '@m3e/react/button';
import { useAuth } from '../hooks/useAuth';

interface NavEntry {
  to: string;
  label: string;
}

const NAV_ENTRIES: NavEntry[] = [
  { to: '/works', label: '作品库' },
  { to: '/favourites', label: '收藏' },
  { to: '/list/circles', label: '圈子' },
  { to: '/list/tags', label: '标签' },
  { to: '/list/vas', label: '声优' },
];

/**
 * 主布局：顶部应用栏 + 侧栏导航 + 内容区。
 *
 * 播放器条（PlayerBar）与全屏播放器（AudioPlayer）在步骤 8 接入；
 * 移动端底部导航栏在步骤 15 接入。
 */
export default function MainLayout() {
  const navigate = useNavigate();
  const { name, isAdmin, logout } = useAuth();

  function handleLogout() {
    logout();
    navigate({ to: '/login' });
  }

  return (
    <div className="grid h-dvh grid-cols-[240px_1fr] grid-rows-[auto_1fr] overflow-hidden [grid-template-areas:'appbar_appbar''drawer_content']">
      <M3eAppBar className="[grid-area:appbar]">
        <span slot="headline" className="text-xl font-medium">
          Kiku
        </span>
        <span slot="trailing" className="me-2 inline-flex items-center gap-2">
          {name}
          <M3eButton variant="text" onClick={handleLogout}>
            退出
          </M3eButton>
        </span>
      </M3eAppBar>

      <nav className="[grid-area:drawer] overflow-y-auto border-ie p-2">
        {NAV_ENTRIES.map((entry) => (
          <Link
            key={entry.to}
            to={entry.to}
            className="mb-0.5 block rounded-full px-4 py-3 text-[0.95rem] no-underline data-[active]:font-semibold"
            activeProps={{ 'data-active': '' }}
          >
            {entry.label}
          </Link>
        ))}
        {isAdmin && (
          <Link
            to="/admin"
            className="mb-0.5 block rounded-full px-4 py-3 text-[0.95rem] no-underline data-[active]:font-semibold"
            activeProps={{ 'data-active': '' }}
          >
            管理后台
          </Link>
        )}
      </nav>

      <main className="[grid-area:content] overflow-y-auto p-4 px-6">
        <Outlet />
      </main>
    </div>
  );
}

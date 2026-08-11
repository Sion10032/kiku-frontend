import { Outlet, Link } from '@tanstack/react-router';
import { M3eAppBar } from '@m3e/react/app-bar';
import { useUserStore } from '../stores/userStore';
import { M3eButton } from '@m3e/react/button';
import styles from './MainLayout.module.css';

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
 *
 * 认证守卫：未登录时由 mainLayoutRoute.beforeLoad 重定向到 /login，
 * 因此此组件假定用户已登录。顶部展示当前用户名（步骤 5 完善下拉菜单）。
 */
export default function MainLayout() {
  const name = useUserStore((s) => s.name);
  const logout = useUserStore((s) => s.logout);

  return (
    <div className={styles.layout}>
      <M3eAppBar className={styles.appBar}>
        <span slot="headline" className={styles.headline}>
          Kiku
        </span>
        <span slot="trailing" className={styles.user}>
          {name}
          <M3eButton variant="text" onClick={() => logout()}>
            退出
          </M3eButton>
        </span>
      </M3eAppBar>

      <nav className={styles.drawer}>
        {NAV_ENTRIES.map((entry) => (
          <Link
            key={entry.to}
            to={entry.to}
            className={styles.navLink}
            activeProps={{ 'data-active': '' }}
          >
            {entry.label}
          </Link>
        ))}
      </nav>

      <main className={styles.content}>
        <Outlet />
      </main>
    </div>
  );
}

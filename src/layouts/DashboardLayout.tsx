import { Outlet, Link } from '@tanstack/react-router';
import { M3eAppBar } from '@m3e/react/app-bar';
import { M3eButton } from '@m3e/react/button';
import styles from './DashboardLayout.module.css';

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
    <div className={styles.layout}>
      <M3eAppBar className={styles.appBar}>
        <span slot="leading">
          <Link to="/works" style={{ textDecoration: 'none' }}>
            <M3eButton variant="text">← 返回</M3eButton>
          </Link>
        </span>
        <span slot="headline" className={styles.headline}>
          管理后台
        </span>
      </M3eAppBar>

      <nav className={styles.tabs}>
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


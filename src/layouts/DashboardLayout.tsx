import {
  Link,
  Outlet,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router';
import { M3eAppBar } from '@m3e/react/app-bar';
import { M3eButton } from '@m3e/react/button';
import { M3eIcon } from '@m3e/react/icon';
import { M3eTab, M3eTabs } from '@m3e/react/tabs';
import { useTranslation } from 'react-i18next';
import '@m3e/icons/outlined/document_scanner';
import '@m3e/icons/outlined/edit';
import '@m3e/icons/outlined/folder';
import '@m3e/icons/outlined/graphic_eq';
import '@m3e/icons/outlined/group';
import '@m3e/icons/outlined/tune';

/** 导航文案为字典 key（渲染处经 t() 转换），与管理页标题共用同一 key。 */
type NavLabelKey =
  | 'dashboard.folders.title'
  | 'dashboard.scan.title'
  | 'dashboard.analysis.title'
  | 'dashboard.advanced.title'
  | 'dashboard.users.title'
  | 'dashboard.metadata.title';

interface NavEntry {
  to: string;
  label: NavLabelKey;
  /** M3 outlined 图标名（需配套 side-effect 导入 @m3e/icons/outlined/<name>） */
  icon: string;
}

const NAV_ENTRIES: NavEntry[] = [
  { to: '/admin', label: 'dashboard.folders.title', icon: 'folder' },
  {
    to: '/admin/scanner',
    label: 'dashboard.scan.title',
    icon: 'document_scanner',
  },
  {
    to: '/admin/analysis',
    label: 'dashboard.analysis.title',
    icon: 'graphic_eq',
  },
  { to: '/admin/advanced', label: 'dashboard.advanced.title', icon: 'tune' },
  { to: '/admin/usermanage', label: 'dashboard.users.title', icon: 'group' },
  { to: '/admin/metadata', label: 'dashboard.metadata.title', icon: 'edit' },
];

/**
 * 复刻 TanStack `activeOptions.exact` 的选中语义：
 * - `/admin` 仅精确匹配，避免与子路由（/admin/scanner 等）双高亮；
 * - 其余条目按「等于或子路径」前缀匹配（`/admin/scannerx` 不会误匹配 /admin/scanner）。
 */
function isActive(pathname: string, entry: NavEntry): boolean {
  if (entry.to === '/admin') return pathname === '/admin';
  return pathname === entry.to || pathname.startsWith(`${entry.to}/`);
}

/**
 * 管理后台布局：顶部应用栏（含返回主站）+ M3eTabs 导航 + 内容区。
 *
 * - 选中态由路由单一数据源派生（受控），点击仅触发 navigate；
 *   M3eTab 点击时内部也会先置位自身 selected，随后路由重渲染
 *   以受控属性纠正，两者目标一致（信任路由渲染即为纠正机制）。
 * - 页面内容由 <Outlet/> 渲染，tabs 仅承担导航与指示器，不用 TabPanel。
 */
export default function DashboardLayout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className='flex h-dvh flex-col overflow-hidden'>
      <M3eAppBar>
        <span slot='leading'>
          <Link to='/works' className='no-underline'>
            <M3eButton variant='text'>← {t('common.back')}</M3eButton>
          </Link>
        </span>
        <span slot='headline' className='text-xl font-medium'>
          {t('common.admin-console')}
        </span>
      </M3eAppBar>

      <M3eTabs
        className='[--m3e-tab-spacing:0] sm:[--m3e-tab-spacing:var(--md-sys-measurement-space100)]'
        stretch
      >
        {NAV_ENTRIES.map((entry) => (
          <M3eTab
            key={entry.to}
            selected={isActive(pathname, entry)}
            aria-label={t(entry.label)}
            onClick={() => navigate({ to: entry.to })}
          >
            <M3eIcon slot='icon' name={entry.icon} />
            {/* 窄屏仅图标（文字隐藏后可访问名由 aria-label 保证），≥sm 恢复图标+文字 */}
            <span className='hidden sm:inline'>{t(entry.label)}</span>
          </M3eTab>
        ))}
      </M3eTabs>

      <main className='flex-1 overflow-y-auto p-6'>
        <Outlet />
      </main>
    </div>
  );
}

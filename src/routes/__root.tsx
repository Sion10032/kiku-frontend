import {
  createRootRoute,
  createRoute,
  Outlet,
  redirect,
} from '@tanstack/react-router';
import { useUserStore } from '../stores/userStore';
import { restoreSession } from '../hooks/useAuth';
import { ensureSetupStatus, getSetupNeeded } from '../api/setup';
import MainLayout from '../layouts/MainLayout';
import DashboardLayout from '../layouts/DashboardLayout';

/**
 * 根路由：仅渲染 <Outlet/>。
 * 404、/login、/setup、/register 作为 root 的直接子路由（无布局包裹）。
 *
 * beforeLoad：恢复会话 → 拉取 setup 状态（promise 缓存）。
 * 首次部署（用户表为空）时，除 /setup 外一律重定向到 /setup 向导。
 */
export const rootRoute = createRootRoute({
  beforeLoad: async ({ location }) => {
    await restoreSession();
    await ensureSetupStatus();
    if (location.pathname !== '/setup' && getSetupNeeded()) {
      throw redirect({ to: '/setup' });
    }
  },
  component: () => <Outlet />,
});

/**
 * 主布局路由（pathless，仅作 layout）。
 * 实例模式开关不再预取：私有模式下由后端 401/403（已本地化）拒绝。
 */
export const mainLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'main',
  component: MainLayout,
});

/**
 * 管理后台布局路由（pathless，仅作 layout）。
 * 认证守卫 + 管理员校验（group === 'administrator'）。
 */
export const dashboardLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'dashboard',
  beforeLoad: () => {
    const { auth, group } = useUserStore.getState();
    if (!auth) {
      throw redirect({ to: '/login' });
    }
    if (group !== 'administrator') {
      // 非管理员退回作品库
      throw redirect({ to: '/works' });
    }
  },
  component: DashboardLayout,
});

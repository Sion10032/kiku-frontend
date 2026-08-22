import {
  createRootRouteWithContext,
  createRoute,
  Outlet,
  redirect,
} from '@tanstack/react-router';
import type { QueryClient } from '@tanstack/react-query';
import { useUserStore } from '../stores/userStore';
import { restoreSession } from '../hooks/useAuth';
import {
  ensureSetupStatus,
  ensureSharedConfig,
  getCachedSharedConfig,
  getSetupNeeded,
} from '../api/sharedConfig';
import MainLayout from '../layouts/MainLayout';
import DashboardLayout from '../layouts/DashboardLayout';

/**
 * 根路由：承载 router context（QueryClient），仅渲染 <Outlet/>。
 * 404、/login、/setup、/register 作为 root 的直接子路由（无布局包裹）。
 *
 * beforeLoad：恢复会话 → 拉取 setup 状态与 sharedConfig（均 promise 缓存）。
 * 首次部署（用户表为空）时，除 /setup 外一律重定向到 /setup 向导。
 */
export const rootRoute = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  beforeLoad: async ({ location }) => {
    await restoreSession();
    await Promise.all([ ensureSetupStatus(), ensureSharedConfig() ]);
    if (location.pathname !== '/setup' && getSetupNeeded()) {
      throw redirect({ to: '/setup' });
    }
  },
  component: () => <Outlet />,
});

/**
 * 主布局路由（pathless，仅作 layout）。
 * 私有模式：未登录跳 /login；公开模式匿名放行（只读浏览）。
 */
export const mainLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'main',
  beforeLoad: () => {
    const { auth } = useUserStore.getState();
    const shared = getCachedSharedConfig();
    if (shared?.instanceMode === 'private' && !auth) {
      throw redirect({ to: '/login' });
    }
  },
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

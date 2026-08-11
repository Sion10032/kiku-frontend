import {
  createRootRouteWithContext,
  createRoute,
  Outlet,
  redirect,
} from '@tanstack/react-router';
import type { QueryClient } from '@tanstack/react-query';
import { useUserStore } from '../stores/userStore';
import { restoreSession } from '../hooks/useAuth';
import MainLayout from '../layouts/MainLayout';
import DashboardLayout from '../layouts/DashboardLayout';

/**
 * 根路由：承载 router context（QueryClient），仅渲染 <Outlet/>。
 * 404 与 /login 作为 root 的直接子路由（无布局包裹）。
 *
 * beforeLoad 恢复会话：首次访问时若有 token，调用 GET /auth/me 填充 userStore。
 * restoreSession 内部用 promise 缓存，整个生命周期只请求一次。
 */
export const rootRoute = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  beforeLoad: async () => {
    await restoreSession();
  },
  component: () => <Outlet />,
});

/**
 * 主布局路由（pathless，仅作 layout）。
 * 认证守卫：未登录跳转 /login。
 */
export const mainLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'main',
  beforeLoad: () => {
    const { auth } = useUserStore.getState();
    if (!auth) {
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

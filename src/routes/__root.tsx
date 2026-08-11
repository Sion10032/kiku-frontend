import {
  createRootRouteWithContext,
  createRoute,
  Outlet,
} from '@tanstack/react-router';
import type { QueryClient } from '@tanstack/react-query';
import MainLayout from '../layouts/MainLayout';
import DashboardLayout from '../layouts/DashboardLayout';

/**
 * 根路由：承载 router context（QueryClient），仅渲染 <Outlet/>。
 * 404 与 /login 作为 root 的直接子路由（无布局包裹）。
 */
export const rootRoute = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  component: () => <Outlet />,
});

/**
 * 主布局路由（pathless，仅作 layout）。
 * 认证守卫暂时关闭，待步骤 5 接入 useAuth 后恢复：
 *   beforeLoad: () => {
 *     const { auth } = useUserStore.getState();
 *     if (!auth) throw redirect({ to: '/login' });
 *   },
 */
export const mainLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'main',
  component: MainLayout,
});

/**
 * 管理后台布局路由（pathless，仅作 layout）。
 * 认证守卫 + 管理员校验在步骤 13 完善（暂时关闭）。
 */
export const dashboardLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'dashboard',
  component: DashboardLayout,
});

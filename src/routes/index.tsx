import { createRoute, redirect } from '@tanstack/react-router';
import { z } from 'zod';
import { rootRoute, mainLayoutRoute, dashboardLayoutRoute } from './__root';
import { worksRoute } from './works';
import { workRoute } from './work';
import List from '../pages/List';
import Favourites from '../pages/Favourites';
import Login from '../pages/Login';
import Error404 from '../pages/Error404';
import Folders from '../pages/Dashboard/Folders';
import Scanner from '../pages/Dashboard/Scanner';
import Advanced from '../pages/Dashboard/Advanced';
import UserManage from '../pages/Dashboard/UserManage';

// / → 重定向到 /works
const indexRoute = createRoute({
  getParentRoute: () => mainLayoutRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/works' });
  },
});

// 作品详情：路径参数 id → number（定义见 routes/work.tsx）

// 圈子/标签/声优：path param 收敛为枚举（替代三个独立 prop 路由）
const listRoute = createRoute({
  getParentRoute: () => mainLayoutRoute,
  path: '/list/$type',
  params: {
    parse: (raw) => ({
      type: z.enum(['circles', 'tags', 'vas']).parse(raw.type),
    }),
    stringify: ({ type }) => ({ type }),
  },
  component: function ListPage() {
    const { type } = listRoute.useParams();
    return <List type={type} />;
  },
});

// 收藏
const favouritesRoute = createRoute({
  getParentRoute: () => mainLayoutRoute,
  path: '/favourites',
  component: () => <Favourites route="review" />,
});
const favouritesReviewRoute = createRoute({
  getParentRoute: () => mainLayoutRoute,
  path: '/favourites/review',
  component: () => <Favourites route="review" />,
});
const favouritesProgressRoute = createRoute({
  getParentRoute: () => mainLayoutRoute,
  path: '/favourites/progress/$status',
  params: {
    parse: (raw) => ({
      status: z
        .enum(['not-started', 'in-progress', 'done'])
        .parse(raw.status),
    }),
    stringify: ({ status }) => ({ status }),
  },
  component: function FavouritesProgress() {
    const { status } = favouritesProgressRoute.useParams();
    return <Favourites route="progress" status={status} />;
  },
});

// 管理后台
const foldersRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/admin',
  component: Folders,
});
const scannerRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/admin/scanner',
  component: Scanner,
});
const advancedRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/admin/advanced',
  component: Advanced,
});
const userManageRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/admin/usermanage',
  component: UserManage,
});

// 登录 / 404（无布局包裹）
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: Login,
});
const notFoundRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '*',
  component: Error404,
});

export const routeTree = rootRoute.addChildren([
  mainLayoutRoute.addChildren([
    indexRoute,
    worksRoute,
    workRoute,
    listRoute,
    favouritesRoute,
    favouritesReviewRoute,
    favouritesProgressRoute,
  ]),
  dashboardLayoutRoute.addChildren([
    foldersRoute,
    scannerRoute,
    advancedRoute,
    userManageRoute,
  ]),
  loginRoute,
  notFoundRoute,
]);

export { worksRoute };

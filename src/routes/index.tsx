import { createRoute, redirect } from '@tanstack/react-router';
import { z } from 'zod';
import { rootRoute, mainLayoutRoute, dashboardLayoutRoute } from './__root';
import { worksRoute } from './works';
import { workRoute } from './work';
import { historyRoute } from './history';
import { settingsRoute } from './settings';
import List from '../pages/List';
import Favourites from '../pages/Favourites';
import MyReviews from '../pages/MyReviews';
import Login from '../pages/Login';
import Setup from '../pages/Setup';
import Register from '../pages/Register';
import Error404 from '../pages/Error404';
import Folders from '../pages/Dashboard/Folders';
import Scanner from '../pages/Dashboard/Scanner';
import Analysis from '../pages/Dashboard/Analysis';
import Advanced from '../pages/Dashboard/Advanced';
import UserManage from '../pages/Dashboard/UserManage';
import MetadataOverride from '../pages/Dashboard/MetadataOverride';

// / → 重定向到 /works
const indexRoute = createRoute({
  getParentRoute: () => mainLayoutRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/works' });
  },
});

// 作品详情：路径参数 id → number（定义见 routes/work.tsx）

// 社团/标签/声优/系列：path param 收敛为枚举（替代三个独立 prop 路由）
const listRoute = createRoute({
  getParentRoute: () => mainLayoutRoute,
  path: '/list/$type',
  params: {
    parse: (raw) => ({
      type: z.enum(['circles', 'tags', 'vas', 'series']).parse(raw.type),
    }),
    stringify: ({ type }) => ({ type }),
  },
  component: function ListPage() {
    const { type } = listRoute.useParams();
    return <List type={type} />;
  },
});

// 收藏（收藏的作品 / 系列 / 声优 / 社团 四视图，见 pages/Favourites.tsx）
const favouritesIndexRoute = createRoute({
  getParentRoute: () => mainLayoutRoute,
  path: '/favourites',
  beforeLoad: () => {
    // 默认进「作品」Tab
    throw redirect({ to: '/favourites/$tab', params: { tab: 'works' } });
  },
});
const favouritesTabRoute = createRoute({
  getParentRoute: () => mainLayoutRoute,
  path: '/favourites/$tab',
  params: {
    parse: (raw) => ({
      tab: z.enum(['works', 'series', 'vas', 'circles']).parse(raw.tab),
    }),
    stringify: ({ tab }) => ({ tab }),
  },
  component: function FavouritesPage() {
    const { tab } = favouritesTabRoute.useParams();
    return <Favourites tab={tab} />;
  },
});

// 我的评价（原收藏页评价视图独立成页）
const myReviewsRoute = createRoute({
  getParentRoute: () => mainLayoutRoute,
  path: '/my-reviews',
  component: MyReviews,
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
const analysisRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/admin/analysis',
  component: Analysis,
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
const metadataAdminRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/admin/metadata',
  component: MetadataOverride,
});

// 登录 / 初始化 / 注册 / 404（无布局包裹）
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: Login,
});
const setupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/setup',
  beforeLoad: async () => {
    // 已初始化时访问 /setup → 回首页（此时已有登录态，无需要求再登录）
    const { ensureSetupStatus } = await import('../api/setup');
    if (!(await ensureSetupStatus())) {
      throw redirect({ to: '/' });
    }
  },
  component: Setup,
});
const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/register',
  component: Register,
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
    historyRoute,
    listRoute,
    favouritesIndexRoute,
    favouritesTabRoute,
    myReviewsRoute,
    settingsRoute,
  ]),
  dashboardLayoutRoute.addChildren([
    foldersRoute,
    scannerRoute,
    analysisRoute,
    advancedRoute,
    userManageRoute,
    metadataAdminRoute,
  ]),
  loginRoute,
  setupRoute,
  registerRoute,
  notFoundRoute,
]);

export { worksRoute };

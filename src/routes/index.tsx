import { createRoute, redirect } from '@tanstack/react-router';
import { z } from 'zod';
import { rootRoute, mainLayoutRoute, dashboardLayoutRoute } from './__root';
import { worksRoute } from './works';
import { workRoute } from './work';
import { settingsRoute } from './settings';
import List from '../pages/List';
import Favourites from '../pages/Favourites';
import Login from '../pages/Login';
import Setup from '../pages/Setup';
import Register from '../pages/Register';
import Error404 from '../pages/Error404';
import Folders from '../pages/Dashboard/Folders';
import Scanner from '../pages/Dashboard/Scanner';
import Advanced from '../pages/Dashboard/Advanced';
import UserManage from '../pages/Dashboard/UserManage';
import { getCachedSharedConfig } from '../api/sharedConfig';

// / → 重定向到 /works
const indexRoute = createRoute({
  getParentRoute: () => mainLayoutRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/works' });
  },
});

// 作品详情：路径参数 id → number（定义见 routes/work.tsx）

// 社团/标签/声优：path param 收敛为枚举（替代三个独立 prop 路由）
const listRoute = createRoute({
  getParentRoute: () => mainLayoutRoute,
  path: '/list/$type',
  params: {
    parse: raw => ({
      type: z.enum([ 'circles', 'tags', 'vas' ]).parse(raw.type),
    }),
    stringify: ({ type }) => ({ type }),
  },
  component: function ListPage() {
    const { type } = listRoute.useParams();
    return <List type={type} />;
  },
});

// 收藏（我的评价 / 我的进度 / 分类整理 三视图，见 pages/Favourites.tsx）
const favouritesRoute = createRoute({
  getParentRoute: () => mainLayoutRoute,
  path: '/favourites',
  component: () => <Favourites route='review' />,
});
const favouritesReviewRoute = createRoute({
  getParentRoute: () => mainLayoutRoute,
  path: '/favourites/review',
  component: () => <Favourites route='review' />,
});

// /favourites/progress → 默认标记进度 marked（对齐原项目路由语义）
const favouritesProgressIndexRoute = createRoute({
  getParentRoute: () => mainLayoutRoute,
  path: '/favourites/progress',
  beforeLoad: () => {
    throw redirect({
      to: '/favourites/progress/$status',
      params: { status: 'marked' },
    });
  },
});

// 进度 5 值枚举：marked/listening/listened/replay/postponed（对齐后端 reviewSchema.progress）
const favouritesProgressRoute = createRoute({
  getParentRoute: () => mainLayoutRoute,
  path: '/favourites/progress/$status',
  params: {
    parse: raw => ({
      status: z
        .enum([ 'marked', 'listening', 'listened', 'replay', 'postponed' ])
        .parse(raw.status),
    }),
    stringify: ({ status }) => ({ status }),
  },
  component: function FavouritesProgress() {
    const { status } = favouritesProgressRoute.useParams();
    return <Favourites route='progress' status={status} />;
  },
});

// /favourites/folder（路由收藏夹，原项目语义：分类整理视图）
const favouritesFolderRoute = createRoute({
  getParentRoute: () => mainLayoutRoute,
  path: '/favourites/folder',
  component: () => <Favourites route='folder' />,
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
    const { ensureSetupStatus } = await import('../api/sharedConfig');
    if (!(await ensureSetupStatus())) {
      throw redirect({ to: '/' });
    }
  },
  component: Setup,
});
const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/register',
  beforeLoad: () => {
    const shared = getCachedSharedConfig();
    if (!shared?.allowRegistration) {
      throw redirect({ to: '/login' });
    }
  },
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
    listRoute,
    favouritesRoute,
    favouritesReviewRoute,
    favouritesProgressIndexRoute,
    favouritesProgressRoute,
    favouritesFolderRoute,
    settingsRoute,
  ]),
  dashboardLayoutRoute.addChildren([
    foldersRoute,
    scannerRoute,
    advancedRoute,
    userManageRoute,
  ]),
  loginRoute,
  setupRoute,
  registerRoute,
  notFoundRoute,
]);

export { worksRoute };

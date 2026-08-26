import { createRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { mainLayoutRoute } from './__root';
import History from '../pages/History';

/**
 * 收听历史路由（仅 page 一个 search param）。
 * 数据不预取（无 loader）：组件挂载时自行请求（useHistoryPage）。
 */
export const historyRoute = createRoute({
  getParentRoute: () => mainLayoutRoute,
  path: '/history',
  validateSearch: z.object({
    page: z.number().int().min(1).optional(),
  }),
  component: History,
});

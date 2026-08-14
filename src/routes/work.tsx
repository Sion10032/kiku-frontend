import { createRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { mainLayoutRoute } from './__root';
import Work from '../pages/Work';

/**
 * 作品详情路由：/work/:id（id 为 number）。
 *
 * 独立成模块以便 pages/Work.tsx 通过 `workRoute.useParams()` 取参
 * （pathless 布局 id 计入 route id，勿用 useParams({ from })）。
 */
export const workRoute = createRoute({
  getParentRoute: () => mainLayoutRoute,
  path: '/work/$id',
  params: {
    parse: (raw) => ({ id: z.coerce.number().int().parse(raw.id) }),
    stringify: ({ id }) => ({ id: String(id) }),
  },
  component: Work,
});

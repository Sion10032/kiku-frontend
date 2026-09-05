import { createRoute } from '@tanstack/react-router';
import { mainLayoutRoute } from './__root';
import Work from '../pages/Work';
import { normalizeWorkId } from '../utils/workId';

/**
 * 作品详情路由：/work/:id（id 为完整作品代码，如 "RJ01173549" / "VJ01003042"）。
 *
 * 独立成模块以便 pages/Work.tsx 通过 `workRoute.useParams()` 取参
 * （pathless 布局 id 计入 route id，勿用 useParams({ from })）。
 */
export const workRoute = createRoute({
  getParentRoute: () => mainLayoutRoute,
  path: '/work/$id',
  params: {
    parse: (raw) => ({ id: normalizeWorkId(raw.id) }),
    stringify: ({ id }) => ({ id: String(id) }),
  },
  component: Work,
});

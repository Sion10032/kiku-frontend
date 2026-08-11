import { createRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { mainLayoutRoute } from './__root';
import Works from '../pages/Works';

/**
 * 作品库路由。
 *
 * Search params 用 zod 校验，跳转/读取全程类型安全：
 *   <Link to="/works" search={{ order: 'rating', sort: 'desc' }} />
 *   const { order, sort } = worksRoute.useSearch();
 *
 * 数据预取（loader + ensureQueryData）在步骤 3 接入 getWorks 后启用。
 */
export const worksRoute = createRoute({
  getParentRoute: () => mainLayoutRoute,
  path: '/works',
  validateSearch: z.object({
    order: z
      .enum([
        'release',
        'rating',
        'download',
        'price',
        'duration',
        'review',
        'random',
      ])
      .optional(),
    sort: z.enum(['desc', 'asc']).optional(),
    page: z.number().int().min(1).optional(),
    seed: z.number().optional(),
    circleId: z.number().optional(),
    tagId: z.number().optional(),
    vaId: z.number().optional(),
    keyword: z.string().optional(),
  }),
  // loaderDeps / loader 在步骤 3 接入 API 后启用：
  //   loaderDeps: ({ search }) => search,
  //   loader: ({ deps, context }) =>
  //     context.queryClient.ensureQueryData({
  //       queryKey: ['works', deps],
  //       queryFn: () => getWorks({ ...deps, page: deps.page ?? 1 }),
  //     }),
  component: Works,
});

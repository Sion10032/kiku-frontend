import { createRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { mainLayoutRoute } from './__root';
import Works from '../pages/Works';

/**
 * 作品库路由。
 *
 * Search params 用 zod 校验，跳转/读取全程类型安全：
 *   <Link to="/works" search={{ order: 'release', sort: 'desc' }} />
 *   const { order, sort } = worksRoute.useSearch();
 *
 * 数据不预取（无 loader）：组件挂载时自行请求（useWorksPage / useWorksInfinite），
 * keepPreviousData 提供翻页时的旧数据缓冲。
 */
export const worksRoute = createRoute({
  getParentRoute: () => mainLayoutRoute,
  path: '/works',
  validateSearch: z.object({
    order: z
      .enum([
        'release',
        'id',
        'random',
        'betterRandom',
      ])
      .optional(),
    sort: z.enum([ 'desc', 'asc' ]).optional(),
    page: z.number().int().min(1).optional(),
    seed: z.number().optional(),
    circleId: z.number().optional(),
    tagId: z.number().optional(),
    vaId: z.string().optional(),
    keyword: z.string().optional(),
  }),
  component: Works,
});

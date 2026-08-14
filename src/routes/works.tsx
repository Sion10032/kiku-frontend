import { createRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { mainLayoutRoute } from './__root';
import Works from '../pages/Works';
import { getWorks } from '../api/works';

/**
 * 作品库路由。
 *
 * Search params 用 zod 校验，跳转/读取全程类型安全：
 *   <Link to="/works" search={{ order: 'rating', sort: 'desc' }} />
 *   const { order, sort } = worksRoute.useSearch();
 *
 * 数据预取（loader + ensureQueryData）：进入页面时提前写入 QueryClient 缓存。
 */
export const worksRoute = createRoute({
  getParentRoute: () => mainLayoutRoute,
  path: '/works',
  validateSearch: z.object({
    order: z
      .enum([
        'release',
        'rating',
        'dl_count',
        'price',
        'rate_average_2dp',
        'review_count',
        'id',
        'nsfw',
        'random',
      ])
      .optional(),
    sort: z.enum(['desc', 'asc']).optional(),
    page: z.number().int().min(1).optional(),
    seed: z.number().optional(),
    circleId: z.number().optional(),
    tagId: z.number().optional(),
    vaId: z.string().optional(),
    keyword: z.string().optional(),
  }),
  // 预取作品列表缓存：key 与 useWorksInfinite 完全一致（['works', {order,sort,seed}]），
  // 命中后页面不再重复请求。筛选场景由页面上的独立查询负责，此处跳过。
  loaderDeps: ({ search }) => search,
  loader: ({ deps, context }) => {
    const filtered =
      deps.circleId != null ||
      deps.tagId != null ||
      deps.vaId != null ||
      !!deps.keyword;
    if (filtered) return undefined;
    const params = {
      order: deps.order,
      sort: deps.sort,
      seed: deps.seed,
    };
    return context.queryClient.ensureQueryData({
      queryKey: ['works', params],
      queryFn: () => getWorks({ ...params, page: deps.page ?? 1 }),
    });
  },
  component: Works,
});

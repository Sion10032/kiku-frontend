import { createRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { mainLayoutRoute } from './__root';
import Works from '../pages/Works';
import { getWorksList } from '../api/works';
import { worksListQueryKey } from '../queries/useWorksQuery';

/**
 * 作品库路由。
 *
 * Search params 用 zod 校验，跳转/读取全程类型安全：
 *   <Link to="/works" search={{ order: 'release', sort: 'desc' }} />
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
  // 预取作品列表缓存：key 由 worksListQueryKey 构造，与 useWorksPage 完全一致
  // （['works', {order,sort,seed,circleId,tagId,vaId,keyword}, page]），
  // 命中后页面不再重复请求。含筛选场景同样预取（getWorksList 自动路由子端点）。
  loaderDeps: ({ search }) => search,
  loader: ({ deps, context }) => {
    // 键序与 useWorksPage 侧同构（listKeyParts 内部显式写全七个键，不会漂移）
    const params = {
      order: deps.order,
      sort: deps.sort,
      seed: deps.seed,
      circleId: deps.circleId,
      tagId: deps.tagId,
      vaId: deps.vaId,
      keyword: deps.keyword,
    };
    const page = deps.page ?? 1;
    return context.queryClient.ensureQueryData({
      queryKey: worksListQueryKey({ ...params, page }),
      queryFn: () => getWorksList({ ...params, page }),
    });
  },
  component: Works,
});

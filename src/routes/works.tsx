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
 * 筛选用 q 参数承载 LQL 查询文本（如 `circle:"社团名" tag:3 "Re:0"`），
 * 旧 circleId/tagId/vaId/keyword 参数由 zod object 默认剥离（见计划 D5）。
 *
 * 数据不预取（无 loader）：组件挂载时自行请求（useWorksPage / useWorksInfinite），
 * keepPreviousData 提供翻页时的旧数据缓冲。
 */
export const worksRoute = createRoute({
  getParentRoute: () => mainLayoutRoute,
  path: '/works',
  validateSearch: z.object({
    order: z.enum(['release', 'id', 'random', 'betterRandom']).optional(),
    sort: z.enum(['desc', 'asc']).optional(),
    page: z.number().int().min(1).optional(),
    seed: z.number().optional(),
    /**
     * LQL 查询文本（旧 circleId/tagId/vaId/keyword 参数被 zod 剥离，见计划 D5）。
     * .catch(undefined)：手输/外部分享 URL 经 parseSearchWith(JSON.parse) 可能
     * 把 `?q=7` 解析成 number（`?q=false`→boolean），z.string() 校验失败会
     * 抛错崩溃到 errorComponent；校验失败时回落 undefined。catch 需包在
     * optional 外层（zod v4 的 catch 参数类型为 output<T>）；应用内导航经
     * stringifySearch 会给纯数字字符串加引号，对称往返不受影响。
     */
    q: z.string().optional().catch(undefined),
  }),
  component: Works,
});

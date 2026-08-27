import { createRoute } from '@tanstack/react-router';
import { mainLayoutRoute } from './__root';
import Work from '../pages/Work';

/**
 * 规范化作品 id：完整 RJ code（如 "RJ01173549"）。
 *
 * 与后端 extractRJId 行为一致：接受 "RJ01173549" / "rj1173549" / "1173549"
 * 等形式，统一补齐前缀与 8 位数字；无法解析时抛错（走路由错误边界）。
 */
function normalizeRJId(raw: string): string {
  const match = raw.match(/^([Rr][Jj])?(\d{4,8})$/);
  if (!match?.[2]) {
    throw new Error(`Invalid work id: ${raw}`);
  }
  return `RJ${match[2].padStart(8, '0')}`;
}

/**
 * 作品详情路由：/work/:id（id 为完整 RJ code，如 "RJ01173549"）。
 *
 * 独立成模块以便 pages/Work.tsx 通过 `workRoute.useParams()` 取参
 * （pathless 布局 id 计入 route id，勿用 useParams({ from })）。
 */
export const workRoute = createRoute({
  getParentRoute: () => mainLayoutRoute,
  path: '/work/$id',
  params: {
    parse: (raw) => ({ id: normalizeRJId(raw.id) }),
    stringify: ({ id }) => ({ id: String(id) }),
  },
  component: Work,
});

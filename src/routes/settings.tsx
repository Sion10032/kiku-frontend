import { createRoute } from '@tanstack/react-router';
import { mainLayoutRoute } from './__root';
import Settings from '../pages/Settings';

/** 设置页：纯本地偏好（动态取色 / 颜色模式），详见 pages/Settings.tsx。 */
export const settingsRoute = createRoute({
  getParentRoute: () => mainLayoutRoute,
  path: '/settings',
  component: Settings,
});

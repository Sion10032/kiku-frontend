import { createRouter } from '@tanstack/react-router';
import { QueryClient } from '@tanstack/react-query';
import { routeTree } from './routes';

export const queryClient = new QueryClient();

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent', // 悬停/聚焦时预取
});

// 让 <Link> / useSearch / useParams 全局类型安全
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

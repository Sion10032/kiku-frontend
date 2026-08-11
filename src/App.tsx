import { createRouter, RouterProvider } from '@tanstack/react-router';
import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { routeTree } from './routes';

const queryClient = new QueryClient();

export const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent', // 悬停/聚焦时预取
});

// 让 <Link> / useSearch / useParams 全局类型安全
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}

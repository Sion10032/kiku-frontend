// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { APP_COMMIT, APP_VERSION } from '../utils/appVersion';
import VersionCard from './VersionCard';

const h = vi.hoisted(() => ({ getVersion: vi.fn() }));

vi.mock('../api/version', () => ({ getVersion: h.getVersion }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
// @m3e/web 组件在 jsdom 无法注册 custom elements，mock 成轻量转发组件
vi.mock('@m3e/react/card', () => ({
  M3eCard: (props: { children?: ReactNode }) => <div>{props.children}</div>,
}));

function renderCard() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <VersionCard />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  h.getVersion.mockReset();
});

describe('VersionCard', () => {
  it('前端行显示构建期注入的版本，服务端行显示接口返回的版本', async () => {
    h.getVersion.mockResolvedValue({
      current: '1.0.0',
      commit: 'e4f5g6h',
      latest: null,
      updateAvailable: false,
    });
    renderCard();

    expect(screen.getByText(`${APP_VERSION}-${APP_COMMIT}`)).toBeTruthy();
    await waitFor(() => expect(screen.getByText('1.0.0-e4f5g6h')).toBeTruthy());
  });

  it('服务端请求失败显示 —，加载中留空（两者不混用）', async () => {
    h.getVersion.mockRejectedValue(new Error('offline'));
    renderCard();

    expect(screen.queryByText('—')).toBeNull();
    await waitFor(() => expect(screen.getByText('—')).toBeTruthy());
  });
});

// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

// vi.hoisted 保证 mock 工厂先于提升后的 vi.mock 求值可用
const h = vi.hoisted(() => ({
  ensureSetupStatus: vi.fn(),
  restoreSession: vi.fn(),
}));

vi.mock('../api/setup', () => ({
  ensureSetupStatus: h.ensureSetupStatus,
  getSetupNeeded: () => null,
}));

vi.mock('../hooks/useAuth', () => ({
  restoreSession: h.restoreSession,
}));

// 布局会拉起 @m3e/web 侧效应，测试只关心守卫，替换成空组件
vi.mock('../layouts/MainLayout', () => ({ default: () => null }));
vi.mock('../layouts/DashboardLayout', () => ({ default: () => null }));

import { rootRoute } from './__root';

type BeforeLoad = (opts: { location: { pathname: string } }) => Promise<void>;
const beforeLoad = rootRoute.options.beforeLoad as BeforeLoad;

describe('rootRoute.beforeLoad', () => {
  beforeEach(() => {
    h.ensureSetupStatus.mockReset();
    h.restoreSession.mockReset();
    h.restoreSession.mockResolvedValue(undefined);
  });

  it('业务路径上只恢复会话，不探测 setup 状态', async () => {
    await beforeLoad({ location: { pathname: '/works' } });

    expect(h.restoreSession).toHaveBeenCalledTimes(1);
    expect(h.ensureSetupStatus).not.toHaveBeenCalled();
  });

  it('/setup 上同样不探测（探测已移到 loginRoute / setupRoute）', async () => {
    await beforeLoad({ location: { pathname: '/setup' } });

    expect(h.ensureSetupStatus).not.toHaveBeenCalled();
  });
});

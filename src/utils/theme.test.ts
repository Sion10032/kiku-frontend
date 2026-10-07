// @vitest-environment jsdom
// withThemeTransition：View Transitions 交叉淡化。jsdom 无 startViewTransition /
// matchMedia，按用例分别 stub。
import { afterEach, describe, expect, it, vi } from 'vitest';
// 隔离副作用导入：@m3e/web/theme 顶层访问 jsdom 未实现的 adoptedStyleSheets；
// 本文件只测 withThemeTransition，取色相关实现与本测试无关
vi.mock('@m3e/web/theme', () => ({ getColorFromImage: vi.fn() }));
vi.mock('../api/client', () => ({ mediaUrl: (p: string) => p }));
import { withThemeTransition } from './theme';

function stubViewTransition(impl: (cb: () => void) => unknown) {
  (document as unknown as Record<string, unknown>).startViewTransition =
    vi.fn(impl);
}

function stubMatchMedia(matches: boolean) {
  window.matchMedia = vi
    .fn()
    .mockReturnValue({ matches }) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete (document as unknown as Record<string, unknown>).startViewTransition;
  // @ts-expect-error 测试后清理 stub
  delete window.matchMedia;
});

describe('withThemeTransition', () => {
  it('无 startViewTransition（旧浏览器/jsdom）时直接同步更新', () => {
    let ran = false;
    withThemeTransition(() => {
      ran = true;
    });
    expect(ran).toBe(true);
  });

  it('prefers-reduced-motion 时跳过过渡直接更新', () => {
    stubMatchMedia(true);
    stubViewTransition((cb) => cb());
    let ran = false;
    withThemeTransition(() => {
      ran = true;
    });
    expect(ran).toBe(true);
    expect(document.startViewTransition).not.toHaveBeenCalled();
  });

  it('支持 VT 时包 flushSync 交给浏览器交叉淡化，update 在回调内同步完成', () => {
    stubMatchMedia(false);
    let ranInCallback = false;
    stubViewTransition((cb) => {
      cb();
      return { ready: Promise.resolve() };
    });

    withThemeTransition(() => {
      ranInCallback = true;
    });
    expect(ranInCallback).toBe(true);
    expect(document.startViewTransition).toHaveBeenCalledOnce();
  });
});

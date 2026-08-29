import { useEffect, useState } from 'react';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { M3eSearchBar } from '@m3e/react/search';
import { M3eIcon } from '@m3e/react/icon';
import '@m3e/icons/outlined/search';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';

/**
 * 顶栏全局搜索框：输入防抖 300ms 后导航到 /works 并写入 q。
 *
 * - 仅在 /works 路由时读 URL q（双向同步，浏览器后退/前进保持一致）；
 *   离开 /works 时 q 从 URL 消失，输入框随之清空。
 * - 在其他页面输入即跳转 /works 搜索，是全局入口。
 * - 支持统一查询语言语法：tag:xxx、circle:xxx、-tag:yyy 等（LQL）。
 */
export default function GlobalSearchBar() {
  const navigate = useNavigate();
  const urlQ = useRouterState({
    select: (s) =>
      s.location.pathname === '/works'
        ? (s.location.search as { q?: string }).q
        : undefined,
  });

  // 搜索输入（URL q 为初始值，防抖 300ms 后写回 URL）
  const [qInput, setQInput] = useState(() => urlQ ?? '');
  const debouncedQ = useDebouncedValue(qInput);

  // 输入 → /works URL（空值移除 q 参数）
  useEffect(() => {
    if (debouncedQ !== (urlQ ?? '')) {
      navigate({
        to: '/works',
        search: (prev) => ({ ...prev, q: debouncedQ || undefined }),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]);

  // URL → 输入（浏览器后退/前进时保持同步；渲染期调整 state，
  // 仅 urlQ 变化的渲染中执行，替代 effect 中 setState）
  const [prevUrlQ, setPrevUrlQ] = useState(urlQ);
  if (urlQ !== prevUrlQ) {
    setPrevUrlQ(urlQ);
    if ((urlQ ?? '') !== debouncedQ) {
      setQInput(urlQ ?? '');
    }
  }

  return (
    <M3eSearchBar clearable className='w-full' onClear={() => setQInput('')}>
      <M3eIcon slot='leading' name='search' />
      <input
        slot='input'
        type='text'
        placeholder='搜索作品/社团/标签/声优，支持 tag:xxx、circle:xxx、-tag:yyy…'
        value={qInput}
        onInput={(e) => setQInput((e.target as HTMLInputElement).value)}
      />
    </M3eSearchBar>
  );
}

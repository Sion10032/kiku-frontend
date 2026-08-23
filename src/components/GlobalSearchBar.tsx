import { useEffect, useState } from 'react';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { M3eSearchBar } from '@m3e/react/search';
import { M3eIcon } from '@m3e/react/icon';
import '@m3e/icons/outlined/search';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

/**
 * 顶栏全局搜索框：输入防抖 300ms 后导航到 /works 并写入 keyword。
 *
 * - 仅在 /works 路由时读 URL keyword（双向同步，浏览器后退/前进保持一致）；
 *   离开 /works 时 keyword 从 URL 消失，输入框随之清空。
 * - 在其他页面输入即跳转 /works 搜索，是全局入口。
 */
export default function GlobalSearchBar() {
  const navigate = useNavigate();
  const urlKeyword = useRouterState({
    select: s =>
      s.location.pathname === '/works'
        ? (s.location.search as { keyword?: string; }).keyword
        : undefined,
  });

  // 搜索输入（URL keyword 为初始值，防抖 300ms 后写回 URL）
  const [ keywordInput, setKeywordInput ] = useState(() => urlKeyword ?? '');
  const debouncedKeyword = useDebouncedValue(keywordInput);

  // 输入 → /works URL（空值移除 keyword 参数）
  useEffect(() => {
    if (debouncedKeyword !== (urlKeyword ?? '')) {
      navigate({
        to: '/works',
        search: prev => ({ ...prev, keyword: debouncedKeyword || undefined }),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ debouncedKeyword ]);

  // URL → 输入（浏览器后退/前进时保持同步）
  useEffect(() => {
    if ((urlKeyword ?? '') !== debouncedKeyword) {
      setKeywordInput(urlKeyword ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ urlKeyword ]);

  return (
    <M3eSearchBar
      clearable
      className='w-full'
      onClear={() => setKeywordInput('')}>
      <M3eIcon slot='leading' name='search' />
      <input
        slot='input'
        type='text'
        placeholder='搜索作品/社团/标签/声优，或输入 RJ 号…'
        value={keywordInput}
        onInput={e => setKeywordInput((e.target as HTMLInputElement).value)} />
    </M3eSearchBar>
  );
}

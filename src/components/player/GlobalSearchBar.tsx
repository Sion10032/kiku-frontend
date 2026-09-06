import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { M3eSearchView } from '@m3e/react/search';
import type { M3eSearchViewElement } from '@m3e/react/search';
import { M3eList, M3eListItem } from '@m3e/react/list';
import type { M3eListItemElement } from '@m3e/react/list';
import { M3eIconButton } from '@m3e/react/icon-button';
import { M3eIcon } from '@m3e/react/icon';
import '@m3e/icons/outlined/close';
import '@m3e/icons/outlined/history';
import clsx from 'clsx';
import {
  useCirclesQuery,
  useTagsQuery,
  useVasQuery,
} from '../../queries/useListQuery';
import { fieldQuery } from '../../utils/query';
import {
  addSearchHistory,
  loadSearchHistory,
  removeSearchHistory,
} from '../../utils/searchHistory';

/** 面板可选项（历史项或建议项）：键盘导航与点击共用的最小单元 */
interface SearchItem {
  key: string;
  /** 展示文本（历史项为词条本身，建议项为实体名） */
  name: string;
  /** confirmSearch 目标（历史项为原词，建议项为 fieldQuery 生成的 LQL） */
  q: string;
}

/** 输入态面板的分组建议（空组在构建时已过滤） */
interface SuggestionGroup {
  title: string;
  items: SearchItem[];
}

/**
 * 顶栏全局搜索（M3eSearchView 搜索视图宿主，确认制导航）。
 *
 * - 回车/点击确认后才导航到 /works 并写入最近搜索（防抖直跳已移除）；
 * - 面板内容（默认 slot）仅展开时渲染：默认态显示最近搜索 + LQL 语法提示，
 *   输入态显示 标签/社团/声优 三组建议（各最多 4 条）+「查看全部结果」入口；
 *   三查询 hooks 位于仅 open 时挂载的 SearchPanel 内，首开才请求，此后走缓存；
 * - 仅在 /works 路由时读 URL q（渲染期 prevUrlQ 同步，浏览器后退/前进一致）；
 * - 关闭态为 48px 幽灵描边外观（透明底 + 描边），展开态恢复 M3 默认填充；
 *   高度 token 常挂统一 48px：docked 模式下关闭态锚点与展开态 header 均吃
 *   --m3e-search-view-docked-header-container-height（默认 56px），
 *   内嵌 bar 吃 --m3e-search-bar-container-height；auto 模式 <600px 切
 *   fullscreen，展开态 header 吃 --m3e-search-view-full-screen-header-
 *   container-height（默认 72px）、fullscreen 关闭态 header 与展开态 bar
 *   均吃 --m3e-search-view-contained-full-screen-bar-container-height
 *   （默认 56px），需一并设为 48px。
 */
export default function GlobalSearchBar() {
  const navigate = useNavigate();
  const urlQ = useRouterState({
    select: (s) =>
      s.location.pathname === '/works'
        ? (s.location.search as { q?: string }).q
        : undefined,
  });

  // 搜索输入（URL q 为初始值，onQuery 事件驱动更新）
  const [term, setTerm] = useState(() => urlQ ?? '');
  // 面板展开态（onToggle 维护，面板内容与外观 class 都依赖它）
  const [open, setOpen] = useState(false);
  // 最近搜索（初始读存储；增删用工具函数返回值同步 state）
  const [history, setHistory] = useState(loadSearchHistory);
  // 键盘高亮（-1 = 无高亮）
  const [highlightIndex, setHighlightIndex] = useState(-1);

  const viewRef = useRef<M3eSearchViewElement | null>(null);
  // slot input 元素 ref：供下方原生 input 监听直读 DOM 值
  const inputRef = useRef<HTMLInputElement | null>(null);
  // 面板扁平可选项（SearchPanel 渲染期写入，input onKeyDown 事件时读取）
  const itemsRef = useRef<SearchItem[]>([]);
  // 高亮行 ref map：keydown 时直接 scrollIntoView，无需 effect
  const rowRefs = useRef<Map<number, M3eListItemElement | null>>(new Map());
  // 最近一次清除按钮 click 的时间戳（wrapper onClickCapture 写入）：
  // 下方 clear() 放行判别与 handleClear 的 URL q 移除判别共用
  const lastClickAtRef = useRef(0);

  // 覆盖组件 clear()：docked 失焦/ESC 会同步清空输入框 DOM（React 恢复渲染
  // 晚一拍，产生「先空后恢复」闪烁），组件又无开关可关，故 patch 实例方法——
  // 仅放行「清除按钮点击」路径（click 与 clear 同一事件循环，间隔 <1ms；
  // 失焦路径 clear 在 blur 后 40ms debounce，间隔远大于 8ms），其余 no-op：
  // DOM 不动、面板照常收起，term 由下方 prevOpen 恢复逻辑拉回 urlQ。
  // 注意：m3e 升级后需复查 #handleClearClick/#handleInputKeyDown 的 clear 调用点。
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const originalClear = view.clear.bind(view);
    view.clear = () => {
      if (Date.now() - lastClickAtRef.current < 8) {
        originalClear();
      }
    };
    return () => {
      view.clear = originalClear;
    };
  }, []);

  // URL → 输入（浏览器后退/前进时保持同步；渲染期调整 state，
  // 仅 urlQ 变化的渲染中执行，替代 effect 中 setState）
  const [prevUrlQ, setPrevUrlQ] = useState(urlQ);
  if (urlQ !== prevUrlQ) {
    setPrevUrlQ(urlQ);
    if ((urlQ ?? '') !== term) {
      setTerm(urlQ ?? '');
    }
  }

  // term 变化重置键盘高亮（渲染期调整 state，替代 effect 中 setState）
  const [prevTerm, setPrevTerm] = useState(term);
  if (term !== prevTerm) {
    setPrevTerm(term);
    setHighlightIndex(-1);
  }

  // 面板关闭时复位高亮，避免下次打开残留旧索引（渲染期调整 state）
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    setHighlightIndex(-1);
    // 面板收起时输入框恢复与 URL 同步的确认态：上方 patch 后失焦/ESC 的
    // clear() 已是 no-op（DOM 不变），但仍须把 term 拉回 urlQ 对齐——
    // URL q 仍在过滤列表，且未确认的草稿随收起放弃（确认制）
    if (!open) {
      setTerm(urlQ ?? '');
    }
  }

  // 原生 input 监听：IME 组合期间 React 合成事件不可靠，且组件在面板
  // 未开时首次输入只开面板不派发 query，term 必须直读 DOM 保持同步
  // （受控 value 的写回才不会清掉组合中的文本）；仅挂订阅，非 effect setState
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const sync = () => setTerm(el.value);
    el.addEventListener('input', sync);
    return () => el.removeEventListener('input', sync);
  }, []);

  /** 确认制导航唯一入口：历史/建议/底部行/键盘 Enter 全部收敛到这里 */
  function confirmSearch(q: string) {
    setHistory(addSearchHistory(q));
    navigate({ to: '/works', search: { q: q || undefined } });
    if (viewRef.current) {
      viewRef.current.open = false;
    }
    setTerm('');
  }

  /** 删除一条历史（行尾按钮）：用返回值同步 state，不触发搜索不关面板 */
  function handleRemoveHistory(item: string) {
    setHistory(removeSearchHistory(item));
  }

  /** 清除（组件 clear() 派发 clear 事件）有三种触发源：清除按钮 click、
   *  docked 模式失焦（内部 _handleFocusChange，40ms 防抖）、ESC（内部
   *  #handleInputKeyDown / #handleKeyDown）。用户裁决：仅按钮点击移除
   *  /works 的 URL q（保留 order/sort 等其余参数），失焦/ESC 只清输入框。
   *
   *  判别依据（时间戳）：wrapper 的 onClickCapture 记录 click 时刻，点击
   *  与 clear() 在同一事件循环（#handleClearClick 同步调用，间隔 <1ms），
   *  必命中 8ms 窗口；失焦路径 clear 在 blur 后 40ms 防抖、ESC 路径无
   *  click，均不命中。顺带修复 Safari 不给点击的按钮焦点、旧 activeElement
   *  判别失灵的例外。
   *
   *  term 无需在此清空：clear() 内部先派发 query('')（onQuery 已置空）
   *  再派发 clear，两个事件同步先后到达。 */
  function handleClear() {
    if (urlQ && Date.now() - lastClickAtRef.current < 8) {
      navigate({
        to: '/works',
        search: (prev) => ({ ...prev, q: undefined }),
      });
    }
  }

  /** 输入框键盘导航：↑↓ 循环移动高亮，Enter 确认高亮项或原词，Esc 关闭面板 */
  function handleInputKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.nativeEvent.isComposing) return; // IME 组合中的按键不参与导航
    // 面板未展开时无可选项（itemsRef 为上次展开的残留，须跳过）
    const items = open ? itemsRef.current : [];

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (items.length === 0) return;
      const delta = e.key === 'ArrowDown' ? 1 : -1;
      let next: number;
      if (highlightIndex < 0) {
        // 无高亮时 ↓ 从首项进入，↑ 从末项进入
        next = delta === 1 ? 0 : items.length - 1;
      } else {
        next = (highlightIndex + delta + items.length) % items.length;
      }
      setHighlightIndex(next);
      rowRefs.current.get(next)?.scrollIntoView({ block: 'nearest' });
      return;
    }

    if (e.key === 'Enter') {
      const hit = highlightIndex >= 0 ? items[highlightIndex] : undefined;
      if (hit) {
        confirmSearch(hit.q);
        return;
      }
      const q = term.trim();
      if (q) confirmSearch(q);
      return;
    }

    if (e.key === 'Escape' && viewRef.current) {
      viewRef.current.open = false;
    }
  }

  return (
    <div
      onClickCapture={() => {
        lastClickAtRef.current = Date.now();
      }}
    >
      <M3eSearchView
        ref={viewRef}
        mode='auto'
        className='w-full [--m3e-search-bar-container-height:3rem] [--m3e-search-view-docked-header-container-height:3rem] [--m3e-search-view-full-screen-header-container-height:3rem] [--m3e-search-view-contained-full-screen-bar-container-height:3rem]'
        onQuery={(e) => setTerm(e.detail.term)}
        onClear={handleClear}
        onToggle={(e) => setOpen((e as ToggleEvent).newState === 'open')}
      >
        <input
          ref={inputRef}
          slot='input'
          type='text'
          className='w-full'
          placeholder='搜索作品、标签、社团、声优…'
          value={term}
          onKeyDown={handleInputKeyDown}
          // term 双保险同步：原生 input 监听为主（IME 组合期可靠，见上方
          // useEffect），onQuery 兜底组件 clear() 直接写 input.value 不派发
          // 原生事件的情况；此处空 onInput 仅为满足 React 受控输入检查
          onInput={() => {}}
        />
        {open && (
          <SearchPanel
            term={term}
            history={history}
            highlightIndex={highlightIndex}
            itemsRef={itemsRef}
            rowRefs={rowRefs}
            onPick={confirmSearch}
            onRemoveHistory={handleRemoveHistory}
          />
        )}
      </M3eSearchView>
    </div>
  );
}

interface SearchPanelProps {
  term: string;
  history: string[];
  highlightIndex: number;
  /** 回写扁平可选项序列（渲染期写入，父组件 keydown 读取） */
  itemsRef: React.RefObject<SearchItem[]>;
  /** 行元素注册表（索引 → 元素），父组件 keydown 时滚动高亮行 */
  rowRefs: React.RefObject<Map<number, M3eListItemElement | null>>;
  /** 选中某项：历史/建议/底部行共用同一 confirmSearch 入口 */
  onPick: (q: string) => void;
  /** 删除一条历史 */
  onRemoveHistory: (item: string) => void;
}

/**
 * 搜索面板（SearchView 默认 slot，仅展开时挂载）。
 *
 * - 默认态（term 为空）：最近搜索行 + 底部 LQL 语法提示；
 * - 输入态（term 非空）：标签/社团/声优 三组建议（名称子串匹配，各取 4 条，
 *   空组不渲染）+ 底部「Enter 查看全部结果」行；
 * - 三查询 hooks 在此组件内：首开才发请求，此后走 React Query 缓存；
 * - 分组标题为非交互行，键盘导航的扁平序列只含可点行（历史项或建议项）。
 */
function SearchPanel({
  term,
  history,
  highlightIndex,
  itemsRef,
  rowRefs,
  onPick,
  onRemoveHistory,
}: SearchPanelProps) {
  const tags = useTagsQuery();
  const circles = useCirclesQuery();
  const vas = useVasQuery();

  const isInputMode = term.trim() !== '';

  // 输入态建议：按名称子串匹配，每组最多 4 条，空组不渲染
  const groups = useMemo<SuggestionGroup[]>(() => {
    const kw = term.trim().toLowerCase();
    const take = <T extends { id: number | string; name: string }>(
      data: T[] | undefined,
      field: 'tag' | 'circle' | 'va',
    ): SearchItem[] =>
      (data ?? [])
        .filter((x) => x.name.toLowerCase().includes(kw))
        .slice(0, 4)
        .map((x) => ({
          key: String(x.id),
          name: x.name,
          q: fieldQuery(field, x.name),
        }));
    return [
      { title: '标签', items: take(tags.data, 'tag') },
      { title: '社团', items: take(circles.data, 'circle') },
      { title: '声优', items: take(vas.data, 'va') },
    ].filter((g) => g.items.length > 0);
  }, [term, tags.data, circles.data, vas.data]);

  // 扁平可选项序列：输入态为建议项，默认态为历史项。
  // commit 期写入 ref 供父组件 keydown 读取：React 在派发下一个离散事件前会
  // flush 掉 pending 的 passive effect，事件时机读到的必是本次渲染的 items。
  const items: SearchItem[] = isInputMode
    ? groups.flatMap((g) => g.items)
    : history.map((h) => ({ key: h, name: h, q: h }));
  useEffect(() => {
    itemsRef.current = items;
  }, [items, itemsRef]);

  // 各分组的扁平索引起点（历史行索引即数组下标，无需换算）
  let offset = 0;
  const groupsWithOffset = groups.map((g) => {
    const entry = { title: g.title, items: g.items, offset };
    offset += g.items.length;
    return entry;
  });

  /** 键盘高亮视觉：直接给高亮行加背景 class（M3eListItem 无 selected 属性） */
  const rowClass = (index: number) =>
    clsx(
      'cursor-pointer',
      index === highlightIndex
        && 'bg-(--md-sys-color-surface-container-highest)',
    );

  const setRowRef = (index: number) => (el: M3eListItemElement | null) => {
    rowRefs.current.set(index, el);
  };

  return (
    <div>
      {isInputMode ? (
        <>
          {groupsWithOffset.map((g) => (
            <div key={g.title}>
              {/* 分组标题：非交互行 */}
              <div className='px-4 pt-2 pb-1 text-xs text-(--md-sys-color-on-surface-variant)'>
                {g.title}
              </div>
              <M3eList>
                {g.items.map((item, i) => {
                  const index = g.offset + i;
                  return (
                    <M3eListItem
                      key={item.key}
                      ref={setRowRef(index)}
                      className={rowClass(index)}
                      onClick={() => onPick(item.q)}
                    >
                      <span className='block truncate'>{item.name}</span>
                    </M3eListItem>
                  );
                })}
              </M3eList>
            </div>
          ))}
          {/* 底部行：回车 = 全量搜索当前输入词 */}
          <div
            role='button'
            tabIndex={-1}
            onClick={() => onPick(term.trim())}
            className='cursor-pointer px-4 py-3 text-sm text-(--md-sys-color-on-surface-variant) hover:bg-(--md-sys-color-surface-container-high)'
          >
            Enter 查看全部结果 →
          </div>
        </>
      ) : (
        <>
          {history.length > 0 && (
            <M3eList>
              {items.map((item, index) => (
                <M3eListItem
                  key={item.key}
                  ref={setRowRef(index)}
                  className={rowClass(index)}
                  onClick={() => onPick(item.q)}
                >
                  <span
                    slot='leading'
                    className='me-3 flex items-center opacity-60'
                  >
                    <M3eIcon name='history' />
                  </span>
                  <span className='block truncate'>{item.name}</span>
                  <span slot='trailing'>
                    <M3eIconButton
                      aria-label={`删除历史记录 ${item.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveHistory(item.name);
                      }}
                    >
                      <M3eIcon name='close' />
                    </M3eIconButton>
                  </span>
                </M3eListItem>
              ))}
            </M3eList>
          )}
          {/* 底部行：LQL 语法提示 */}
          <div className='px-4 py-3 text-xs text-(--md-sys-color-on-surface-variant)'>
            支持 tag:xxx、circle:xxx、va:xxx、series:xxx，-tag:yyy 排除
          </div>
        </>
      )}
    </div>
  );
}

import { useEffect, useState, useSyncExternalStore } from 'react';
import clsx from 'clsx';
import { Outlet } from '@tanstack/react-router';
import { M3eAppBar } from '@m3e/react/app-bar';
import { M3eIcon } from '@m3e/react/icon';
import { M3eIconButton } from '@m3e/react/icon-button';
import { useTranslation } from 'react-i18next';
import '@m3e/icons/outlined/menu';
import GlobalSearchBar from '../components/player/GlobalSearchBar';
import NavDrawer from '../components/player/NavDrawer';
import AudioElement from '../components/player/AudioElement';
import AudioPlayer from '../components/player/AudioPlayer';
import PlayerBar from '../components/player/PlayerBar';
import { useUiStore } from '../stores/uiStore';

/** 视口 ≥64rem（lg 断点）视为宽屏；窄屏时侧栏自动收起。
 *
 * 用 rem 而非 1024px：与 Tailwind --breakpoint-lg（64rem）生成的媒体查询
 * 字面同源。media query 中的 rem 基于浏览器初始字号（不受页面 uiScale
 * 修改 html font-size 影响），用户调大浏览器默认字号时 Tailwind 断点与
 * 此查询同步移动，不会出现“侧栏已展开而 lg: 类仍是窄屏形态”的错位。 */
const WIDE_QUERY = '(min-width: 64rem)';
let wideMq: MediaQueryList | null = null;
function getWideMq(): MediaQueryList {
  wideMq ??= window.matchMedia(WIDE_QUERY);
  return wideMq;
}
function subscribeNarrow(callback: () => void): () => void {
  const mq = getWideMq();
  mq.addEventListener('change', callback);
  return () => mq.removeEventListener('change', callback);
}
/** 是否窄屏（<64rem / lg）：窄屏下侧栏强制隐藏，菜单按钮改以浮层抽屉打开。 */
function isNarrowViewport(): boolean {
  return !getWideMq().matches;
}

/**
 * 主布局（方案 B，YT Music 式）：侧栏通顶到底，顶栏与播放条只跨内容区。
 *
 * grid 两列三行：drawer 列（跨三行通顶，宽度 240px ↔ 0px 随隐藏状态切换，
 * 品牌与主导航见 NavDrawer）+ 内容列（appbar / content / player）；
 * 侧栏隐藏后内容区占满全宽，顶栏 leading 常驻菜单按钮负责显示/隐藏。
 *
 * 响应式：<lg（64rem）时侧栏自动收起（不覆盖用户偏好，回到宽屏后还原），
 * 菜单按钮此时以浮层抽屉（带遮罩）临时展开导航，点击抽屉或遮罩关闭。
 *
 * AudioElement 承载 Howler 实例（无 UI）；AudioPlayer 为全屏覆盖层
 * （fixed 定位，不占 grid 行）；LyricsBar 在 PlayerBar 内部（浮动歌词）；
 * 移动端正式适配在步骤 15 接入。
 */
export default function MainLayout() {
  const { t } = useTranslation();
  const navHidden = useUiStore((s) => s.navHidden);
  const toggleNavHidden = useUiStore((s) => s.toggleNavHidden);
  const isNarrow = useSyncExternalStore(
    subscribeNarrow,
    isNarrowViewport,
    () => false,
  );
  const [overlayOpen, setOverlayOpen] = useState(false);

  // 回到宽屏时关掉可能残留的浮层抽屉（渲染期调整 state，替代 effect 中 setState）
  const [prevIsNarrow, setPrevIsNarrow] = useState(isNarrow);
  if (isNarrow !== prevIsNarrow) {
    setPrevIsNarrow(isNarrow);
    if (!isNarrow) setOverlayOpen(false);
  }

  // Esc 关闭浮层抽屉（开启时监听）
  useEffect(() => {
    if (!overlayOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOverlayOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [overlayOpen]);

  // 窄屏强制隐藏；宽屏尊重用户偏好
  const drawerHidden = isNarrow || navHidden;

  return (
    <>
      <div
        className={clsx(
          'grid h-dvh grid-rows-[auto_1fr_auto] overflow-hidden transition-[grid-template-columns] duration-200',
          `[grid-template-areas:'drawer_appbar''drawer_content''drawer_player']`,
          drawerHidden ? 'grid-cols-[0px_1fr]' : 'grid-cols-[240px_1fr]',
        )}
      >
        <div className='[grid-area:drawer] min-h-0 overflow-hidden'>
          <NavDrawer />
        </div>

        <M3eAppBar className='[grid-area:appbar]'>
          <M3eIconButton
            slot='leading'
            size='medium'
            className='density-2'
            aria-label={
              isNarrow
                ? t('common.open-nav')
                : navHidden
                  ? t('common.show-nav')
                  : t('common.hide-nav')
            }
            title={
              isNarrow
                ? t('common.open-nav')
                : navHidden
                  ? t('common.show-nav')
                  : t('common.hide-nav')
            }
            onClick={() =>
              isNarrow ? setOverlayOpen(true) : toggleNavHidden()
            }
          >
            <M3eIcon name='menu' />
          </M3eIconButton>
          {/* 全局搜索：任意页面输入即跳 /works 搜索（详见组件注释）。
              靠左紧跟菜单按钮（Gmail/Drive 式）：AppBar small 态 shadow 内
              .title 为普通块级容器、无 margin auto 居中样式，去掉 mx-auto
              后 w-full max-w-xl 自然靠左，无需 me-auto 覆盖 */}
          <div slot='title' className='w-full max-w-xl pr-3'>
            <GlobalSearchBar />
          </div>
        </M3eAppBar>

        <main className='[grid-area:content] overflow-y-auto p-4 px-6'>
          <Outlet />
        </main>

        {/* 迷你播放条（队列为空时自渲染 null，行高为 0） */}
        <PlayerBar />
      </div>

      <AudioElement />
      <AudioPlayer />

      {/* 窄屏浮层抽屉：悬浮于内容上方，滑入/淡出过渡（200ms）；
          抽屉常挂载由 overlayOpen 控制位移，关闭态 pointer-events-none；
          点击遮罩或抽屉内任意处（含导航跳转）关闭 */}
      {isNarrow && (
        <>
          <div
            aria-hidden='true'
            className={clsx(
              'fixed inset-0 z-60 bg-black/40 transition-opacity duration-200',
              overlayOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
            )}
            onClick={() => setOverlayOpen(false)}
          />
          <div
            className={clsx(
              'fixed inset-y-0 left-0 z-70 shadow-2xl transition-transform duration-200',
              overlayOpen
                ? 'translate-x-0'
                : 'pointer-events-none -translate-x-full',
            )}
            onClickCapture={() => setOverlayOpen(false)}
          >
            <NavDrawer />
          </div>
        </>
      )}
    </>
  );
}

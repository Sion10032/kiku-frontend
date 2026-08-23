import { Link, useNavigate } from '@tanstack/react-router';
import { M3eIcon } from '@m3e/react/icon';
import { M3eIconButton } from '@m3e/react/icon-button';
import {
  M3eNavMenu,
  M3eNavMenuItem,
  M3eNavMenuItemGroup,
} from '@m3e/react/nav-menu';
import '@m3e/icons/outlined/library_music';
import '@m3e/icons/outlined/favorite';
import '@m3e/icons/outlined/groups';
import '@m3e/icons/outlined/tag';
import '@m3e/icons/outlined/record_voice_over';
import '@m3e/icons/outlined/admin_panel_settings';
import '@m3e/icons/outlined/settings';
import '@m3e/icons/outlined/person';
import '@m3e/icons/outlined/logout';
import { useAuth } from '../hooks/useAuth';

/**
 * 桌面端侧栏导航（方案 B：侧栏通顶到底，YT Music 式）。
 *
 * 三段式结构：
 * - 品牌头部：应用名「Kiku」
 * - 导航区：m3e nav-menu 原生组件，按「资料库 / 浏览 / 管理」分组；
 *   激活胶囊、hover、focus 等状态全部由组件内建，不写覆盖样式
 * - 用户区：头像圆片 + 用户名 + 退出登录，钉在侧栏底部
 *
 * 侧栏整体显示/隐藏由 MainLayout 控制（列宽 240px ↔ 0px，容器裁切），
 * 本组件固定 240px 宽不随外层列宽重排。
 *
 * 激活判定由 @tanstack/router Link 的 render prop 提供 isActive；
 * 列表类路由（/list/*、/admin）用 exact 避免子路由误高亮。
 */
export default function NavDrawer() {
  const navigate = useNavigate();
  const { name, auth, isAdmin, logout } = useAuth();

  function handleLogout() {
    logout();
    navigate({ to: '/login' });
  }

  const initial = name.trim().charAt(0).toUpperCase();

  return (
    <aside className='flex h-full w-60 shrink-0 flex-col border-e border-(--md-sys-color-outline-variant) bg-(--md-sys-color-surface)'>
      {/* 品牌头部 */}
      <div className='px-5 pb-2 pt-5 text-xl font-medium'>Kiku</div>

      {/* 导航区（可滚动） */}
      <M3eNavMenu className='min-h-0 flex-1 overflow-y-auto'>
        {/* 资料库 */}
        <M3eNavMenuItemGroup>
          <Link to='/works' className='block no-underline text-inherit'>
            {({ isActive }) => (
              <M3eNavMenuItem selected={isActive}>
                <M3eIcon slot='icon' name='library_music' />
                <span slot='label'>作品库</span>
              </M3eNavMenuItem>
            )}
          </Link>
          {/* 收藏以用户名为主键，匿名态隐藏 */}
          {auth && (
            <Link to='/favourites' className='block no-underline text-inherit'>
              {({ isActive }) => (
                <M3eNavMenuItem selected={isActive}>
                  <M3eIcon slot='icon' name='favorite' />
                  <span slot='label'>收藏</span>
                </M3eNavMenuItem>
              )}
            </Link>
          )}
        </M3eNavMenuItemGroup>

        {/* 浏览 */}
        <M3eNavMenuItemGroup>
          <span slot='label'>浏览</span>
          <Link
            to='/list/$type'
            params={{ type: 'circles' }}
            className='block no-underline text-inherit'
            activeOptions={{ exact: true }}>
            {({ isActive }) => (
              <M3eNavMenuItem selected={isActive}>
                <M3eIcon slot='icon' name='groups' />
                <span slot='label'>社团</span>
              </M3eNavMenuItem>
            )}
          </Link>
          <Link
            to='/list/$type'
            params={{ type: 'tags' }}
            className='block no-underline text-inherit'
            activeOptions={{ exact: true }}>
            {({ isActive }) => (
              <M3eNavMenuItem selected={isActive}>
                <M3eIcon slot='icon' name='tag' />
                <span slot='label'>标签</span>
              </M3eNavMenuItem>
            )}
          </Link>
          <Link
            to='/list/$type'
            params={{ type: 'vas' }}
            className='block no-underline text-inherit'
            activeOptions={{ exact: true }}>
            {({ isActive }) => (
              <M3eNavMenuItem selected={isActive}>
                <M3eIcon slot='icon' name='record_voice_over' />
                <span slot='label'>声优</span>
              </M3eNavMenuItem>
            )}
          </Link>
        </M3eNavMenuItemGroup>

        {/* 管理（仅管理员可见） */}
        {isAdmin && (
          <M3eNavMenuItemGroup>
            <span slot='label'>管理</span>
            <Link
              to='/admin'
              className='block no-underline text-inherit'
              activeOptions={{ exact: true }}>
              {({ isActive }) => (
                <M3eNavMenuItem selected={isActive}>
                  <M3eIcon slot='icon' name='admin_panel_settings' />
                  <span slot='label'>管理后台</span>
                </M3eNavMenuItem>
              )}
            </Link>
          </M3eNavMenuItemGroup>
        )}
      </M3eNavMenu>

      {/* 设置：钉在导航区底部 */}
      <M3eNavMenu className='shrink-0 border-t border-(--md-sys-color-outline-variant)'>
        <M3eNavMenuItemGroup>
          <Link to='/settings' className='block no-underline text-inherit' activeOptions={{ exact: true }}>
            {({ isActive }) => (
              <M3eNavMenuItem selected={isActive}>
                <M3eIcon slot='icon' name='settings' />
                <span slot='label'>设置</span>
              </M3eNavMenuItem>
            )}
          </Link>
        </M3eNavMenuItemGroup>
      </M3eNavMenu>

      {/* 用户区（钉在底部）：公开模式匿名态显示登录入口 */}
      {auth
        ? (
          <div className='mt-auto flex items-center gap-3 border-t border-(--md-sys-color-outline-variant) px-4 py-3'>
            <span className='flex size-9 shrink-0 items-center justify-center rounded-full bg-(--md-sys-color-primary-container) text-base font-medium text-(--md-sys-color-on-primary-container)'>
              {initial || <M3eIcon name='person' />}
            </span>
            <span className='min-w-0 flex-1 truncate'>{name}</span>
            <M3eIconButton
              aria-label='退出登录'
              title='退出登录'
              onClick={handleLogout}>
              <M3eIcon name='logout' />
            </M3eIconButton>
          </div>
        )
        : (
          <div className='mt-auto border-t border-(--md-sys-color-outline-variant) px-4 py-3'>
            <Link
              to='/login'
              className='flex items-center gap-3 no-underline text-inherit'>
              <span className='flex size-9 shrink-0 items-center justify-center rounded-full bg-(--md-sys-color-primary-container) text-(--md-sys-color-on-primary-container)'>
                <M3eIcon name='person' />
              </span>
              <span className='flex-1'>登录</span>
            </Link>
          </div>
        )}
    </aside>
  );
}

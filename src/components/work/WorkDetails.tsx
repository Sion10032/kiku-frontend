import { Fragment, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { M3eCard } from '@m3e/react/card';
import { M3eButton } from '@m3e/react/button';
import { M3eIcon } from '@m3e/react/icon';
import { M3eIconButton } from '@m3e/react/icon-button';
import { useNavigate } from '@tanstack/react-router';
import { M3eMenu, M3eMenuItem, type M3eMenuElement } from '@m3e/react/menu';
import { M3eDialog } from '@m3e/react/dialog';
import '@m3e/icons/outlined/favorite';
import '@m3e/icons/outlined/check_circle';
import '@m3e/icons/outlined/rate_review';
import '@m3e/icons/outlined/more_vert';
import '@m3e/icons/outlined/sync';
import '@m3e/icons/outlined/av_timer';
import '@m3e/icons/outlined/delete';
import '@m3e/icons/outlined/edit';
import type { Work } from '../../types';
import { useThemeStore, DEFAULT_SEED } from '../../stores/themeStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { getSeedColorForWork } from '../../utils/theme';
import CoverSFW from '../common/CoverSFW';
import WorkCircleSeriesLinks from '../common/WorkCircleSeriesLinks';
import WorkRatingRow from '../common/WorkRatingRow';
import WorkFactsRow from '../common/WorkFactsRow';
import WorkChips from '../common/WorkChips';
import { useUserStore } from '../../stores/userStore';
import { useFavouriteStatus } from '../../queries/useFavouritesQuery';
import { useReadStateMutation } from '../../queries/useProgressMutation';
import {
  useRefreshWorkMetadataMutation,
  useSoftDeleteWorkMutation,
  useSyncWorkTracksMutation,
} from '../../queries/useWorkAdminMutation';
import FavDialog from '../favourites/FavDialog';
import WriteReview from './WriteReview';
import MetadataEditDialog from './MetadataEditDialog';

interface WorkDetailsProps {
  work: Work;
}

/**
 * 作品详情信息卡：封面（右上分级徽章、右下播放进度）、标题、社团 · 系列、
 * 评分/评论/DLsite 行、价格/售出/发售日行、标签、声优、
 * 操作行（「我的评价」+ 收藏心形 + 已读/未读切换）。
 * 元信息行由 common/ 下的 Work* 共享组件提供（与 WorkCard 一致）。
 * 操作行心形图标按钮是全页唯一收藏入口，打开 FavDialog 列出所有可收藏目标。
 * 管理员另见操作行最右 ⋮ 菜单：更新元数据 / 更新音轨时长 / 删除（软删）。
 */
export default function WorkDetails({ work }: WorkDetailsProps) {
  const { t } = useTranslation();
  // 写评价对话框开关
  const [reviewOpen, setReviewOpen] = useState(false);
  // 收藏对话框开关
  const [favOpen, setFavOpen] = useState(false);

  // 作品收藏状态（驱动操作行心形；未登录自动 disabled）
  const workFav = useFavouriteStatus('work', [work.id]);
  // 匿名零侵入：未登录不渲染收藏入口（匿名用户不应看到任何收藏 UI）
  const auth = useUserStore((s) => s.auth);
  // 已读/未读切换（进度不动；pending 期间禁用按钮防连点）
  const readMutation = useReadStateMutation();

  // 管理员判定（对齐 __root.tsx 路由守卫的校验规则）
  const group = useUserStore((s) => s.group);
  const isAdmin = auth && group === 'administrator';

  // 管理菜单：{ anchor } 对象每次点击都新建，确保重复点击 ⋮ 也会重新 show（同 WorkTree）
  const [menu, setMenu] = useState<{ anchor: HTMLElement } | null>(null);
  const menuRef = useRef<M3eMenuElement>(null);
  // 删除确认对话框
  const [deleteOpen, setDeleteOpen] = useState(false);
  // 元数据覆盖编辑弹窗（仅管理员）
  const [editOpen, setEditOpen] = useState(false);

  const navigate = useNavigate();
  const refreshMutation = useRefreshWorkMetadataMutation();
  const syncTracksMutation = useSyncWorkTracksMutation();
  const deleteMutation = useSoftDeleteWorkMutation();

  // 菜单打开：以 ⋮ 按钮为锚点（m3e-menu 自动翻转防溢出）
  useEffect(() => {
    if (menu) void menuRef.current?.show(menu.anchor);
  }, [menu]);

  // 动态取色：切换作品时从封面提取种子色，失败保持当前主题。
  // 设置中关闭动态取色时跳过提取并恢复默认色。
  // cancelled 守卫防止快速切换作品时旧请求晚到覆盖新主题；
  // 用 getState() 而非 hook 订阅，避免组件因 seed 变化重渲。
  useEffect(() => {
    const { dynamicColor } = useSettingsStore.getState();
    if (!dynamicColor) {
      useThemeStore.getState().setSeed(DEFAULT_SEED);
      return;
    }
    let cancelled = false;
    getSeedColorForWork(work.id).then((color) => {
      if (color && !cancelled) useThemeStore.getState().setSeed(color);
    });
    return () => {
      cancelled = true;
    };
  }, [work.id]);

  // 评分分布展示 JSX 暂被注释（原实现可从 git 历史/注释块恢复），
  // 对应 useMemo 因 noUnusedLocals 报错已移除。

  return (
    <Fragment>
      <M3eCard className='overflow-hidden [--m3e-card-padding:0px]'>
        <div slot='header' className='p-0'>
          <CoverSFW
            workId={work.id}
            ageRating={work.ageRating}
            progress={work.userProgress}
            duration={work.duration}
            read={work.read}
          />
        </div>

        <div slot='content' className='flex flex-col gap-3 p-4'>
          {/* 标题 */}
          <h1 className='m-0 min-w-0 text-xl font-normal leading-snug'>
            {work.title}
            {work.overriddenFields?.includes('title') && (
              <span
                className='ml-2 align-middle text-xs opacity-60'
                title={t('works.field-overridden')}
              >
                *
              </span>
            )}
          </h1>

          <WorkCircleSeriesLinks work={work} />

          <WorkRatingRow work={work} />

          {/* 评分分布 */}
          {/* {work.rate_count_detail &&
          Object.keys(work.rate_count_detail).length > 0 && (
            <div className="flex flex-col gap-1">
              {ratingDistribution.counts.map(({ point, count }) => (
                <div
                  key={point}
                  className="flex items-center gap-2 text-xs"
                >
                  <span className="w-8 shrink-0 text-right opacity-70">
                    {point}星
                  </span>
                  <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-(--md-sys-color-surface-container-high)">
                    <div
                      className="h-full rounded-full bg-(--md-sys-color-primary)"
                      style={{
                        width: `${(count / ratingDistribution.max) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="w-8 shrink-0 opacity-70">{count}</span>
                </div>
              ))}
            </div>
          )} */}

          {/* 详情页显示发售日（卡片不显示，封面右下角已有） */}
          <WorkFactsRow work={work} release={work.release} />

          <WorkChips work={work} />

          {/* 我的评价 + 收藏 + 已读切换 + 管理菜单（操作行并排；管理菜单推到最右） */}
          <div className='mt-1 flex items-center gap-2'>
            <M3eIconButton
              aria-label={
                work.userRating != null
                  ? t('works.my-rating')
                  : t('works.write-review')
              }
              title={
                work.userRating != null
                  ? t('works.my-rating-stars', {
                      stars: '★'.repeat(work.userRating),
                    })
                  : t('works.write-review')
              }
              onClick={() => setReviewOpen(true)}
            >
              <M3eIcon
                name='rate_review'
                filled={work.userRating != null}
                className={
                  work.userRating != null
                    ? 'text-[var(--md-sys-color-primary)]'
                    : ''
                }
              />
            </M3eIconButton>
            {auth && (
              <M3eIconButton
                aria-label={t('works.favourite')}
                onClick={() => setFavOpen(true)}
              >
                <M3eIcon
                  name='favorite'
                  filled={workFav.data?.[work.id] === true}
                  className={
                    workFav.data?.[work.id] === true
                      ? 'text-[var(--md-sys-color-primary)]'
                      : ''
                  }
                />
              </M3eIconButton>
            )}
            {auth && (
              <M3eIconButton
                aria-label={
                  work.read ? t('works.mark-unread') : t('works.mark-read')
                }
                title={
                  work.read ? t('works.mark-unread') : t('works.mark-read')
                }
                disabled={readMutation.isPending}
                onClick={() =>
                  readMutation.mutate({ workId: work.id, read: !work.read })
                }
              >
                <M3eIcon
                  name='check_circle'
                  filled={work.read}
                  className={
                    work.read ? 'text-[var(--md-sys-color-primary)]' : ''
                  }
                />
              </M3eIconButton>
            )}
            {isAdmin && (
              <M3eIconButton
                aria-label={t('works.admin-actions')}
                title={t('works.admin-actions')}
                className='ml-auto'
                onClick={(e) =>
                  setMenu({ anchor: e.currentTarget as HTMLElement })
                }
              >
                <M3eIcon name='more_vert' />
              </M3eIconButton>
            )}
          </div>
        </div>
      </M3eCard>

      {/**
       * WriteReview 必须渲染在 M3eCard 外部——M3eCard 有 shadow DOM，
       * <dialog> showModal() 在 shadow DOM 内会导致焦点陷阱冲突，页面卡死。
       */}
      <WriteReview
        work={work}
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
      />

      {/**
       * FavDialog 与 WriteReview 同理：必须渲染在 M3eCard 外部，
       * 避免嵌在 shadow DOM 内的 <dialog> 焦点陷阱冲突。
       */}
      <FavDialog open={favOpen} onClose={() => setFavOpen(false)} work={work} />

      {/**
       * MetadataEditDialog 与 WriteReview/FavDialog 同理：必须渲染在 M3eCard 外部，
       * 避免嵌在 shadow DOM 内的 <dialog> 焦点陷阱冲突。
       */}
      <MetadataEditDialog
        workId={work.id}
        open={editOpen}
        onClose={() => setEditOpen(false)}
      />

      {isAdmin && (
        <M3eMenu ref={menuRef}>
          <M3eMenuItem
            disabled={refreshMutation.isPending}
            onClick={() => refreshMutation.mutate(work.id)}
          >
            <span slot='icon'>
              <M3eIcon name='sync' />
            </span>
            {t('works.menu-refresh-metadata')}
          </M3eMenuItem>
          <M3eMenuItem
            disabled={syncTracksMutation.isPending}
            onClick={() => syncTracksMutation.mutate(work.id)}
          >
            <span slot='icon'>
              <M3eIcon name='av_timer' />
            </span>
            {t('works.menu-sync-tracks')}
          </M3eMenuItem>
          <M3eMenuItem onClick={() => setEditOpen(true)}>
            <span slot='icon'>
              <M3eIcon name='edit' />
            </span>
            {t('works.menu-edit-metadata')}
          </M3eMenuItem>
          <M3eMenuItem onClick={() => setDeleteOpen(true)}>
            <span slot='icon'>
              <M3eIcon name='delete' />
            </span>
            {t('works.delete')}
          </M3eMenuItem>
        </M3eMenu>
      )}

      {isAdmin && (
        /**
         * 删除确认：与 WriteReview/FavDialog 同理渲染在 M3eCard 外部。
         * 软删除语义：立即从库中隐藏；磁盘仍在的作品重扫时恢复。
         */
        <M3eDialog
          open={deleteOpen}
          onClosed={() => setDeleteOpen(false)}
          dismissible
          closeLabel={t('common.close')}
        >
          <span slot='header'>{t('works.delete-work-title')}</span>
          <div className='flex flex-col gap-4 py-2'>
            <p className='m-0 text-sm'>
              {t('works.delete-work-confirm', {
                title: work.title,
                id: work.id,
              })}
            </p>
            <div className='flex justify-end gap-2'>
              <M3eButton variant='text' onClick={() => setDeleteOpen(false)}>
                {t('common.cancel')}
              </M3eButton>
              <M3eButton
                variant='filled'
                disabled={deleteMutation.isPending}
                onClick={() =>
                  deleteMutation.mutate(work.id, {
                    onSuccess: () => {
                      setDeleteOpen(false);
                      navigate({ to: '/works' });
                    },
                  })
                }
              >
                {t('works.delete')}
              </M3eButton>
            </div>
          </div>
        </M3eDialog>
      )}
    </Fragment>
  );
}

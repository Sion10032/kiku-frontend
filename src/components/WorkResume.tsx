import { useState } from 'react';
import { M3eButton } from '@m3e/react/button';
import { M3eIconButton } from '@m3e/react/icon-button';
import { M3eIcon } from '@m3e/react/icon';
import { M3eDialog } from '@m3e/react/dialog';
import '@m3e/icons/outlined/play_arrow';
import '@m3e/icons/outlined/delete';
import '@m3e/icons/outlined/music_note';
import type { TrackNode, Work } from '../types';
import { formatDuration } from '../utils/format';
import { toTrack, flattenAudioLeaves } from '../utils/track';
import { usePlayerStore } from '../stores/playerStore';
import { useDeleteProgressMutation } from '../queries/useProgressMutation';
import { suppressWorkProgress } from '../utils/progressReporter';

interface WorkResumeProps {
  work: Work;
  /** 文件树根数组(/tracks/:id 响应;未加载完时继续播放禁用) */
  tree: TrackNode[];
}

/**
 * 「继续播放 + 删除播放记录」区块(作品详情页,文件树上方)。
 *
 * - 有进度(work.userProgress 非空,即登录且播放过)才渲染
 * - 布局:单行 继续播放按钮(轨名随宽度自适应压缩省略,不折行) +
 *   已听轨数 + 删除按钮(不换行,窄屏仅压缩轨名)
 * - 继续播放:整棵树深度优先扁平化为音频队列,定位上次音轨与时间点
 *   (Track.startAt,usePlayer 加载完成后 seek);上次音轨找不到(文件
 *   改名/移动)回退第一轨从头播放
 * - 删除:确认对话框(M3eDialog)防误删;成功后 suppressWorkProgress
 *   防止正在播放的该作品被下个上报窗口重建记录,并失效 works/work 查询
 */
export default function WorkResume({ work, tree }: WorkResumeProps) {
  const progress = work.userProgress;
  const setQueue = usePlayerStore(s => s.setQueue);
  const deleteMutation = useDeleteProgressMutation();
  const [ confirmOpen, setConfirmOpen ] = useState(false);

  if (!progress) return null;

  const hasTree = tree.length > 0;

  function resume() {
    const leaves = flattenAudioLeaves(tree);
    if (leaves.length === 0) return;
    const idx = leaves.findIndex(l => l.hash === progress!.mediaIndex);
    const index = idx === -1 ? 0 : idx;
    const queue = leaves.map(l => toTrack(work, l));
    // 上次音轨仍在:从上次时间点恢复;找不到:第一轨从头
    if (idx !== -1 && progress!.position > 0) {
      queue[index] = { ...queue[index], startAt: progress!.position };
    }
    setQueue(queue, index);
  }

  function onDeleteConfirm() {
    deleteMutation.mutate(work.id, {
      onSuccess: () => {
        // 正在播放该作品时停止上报,直到切到其他作品
        suppressWorkProgress(work.id);
        setConfirmOpen(false);
      },
    });
  }

  return (
    <div className='flex items-center gap-2'>
      <M3eButton
        variant='tonal'
        onClick={resume}
        disabled={!hasTree}
        className='min-w-0 flex-1'>
        {/* 轨名随可用宽度自适应压缩(组件 .label 自带 ellipsis),不折行 */}
        <M3eIcon slot='icon' name='play_arrow' />
        {progress.trackTitle ?? '继续播放'}
        {' '}
        ·
        {formatDuration(progress.position)}
      </M3eButton>

      <span className='shrink-0 text-sm opacity-70'>
        已听 {progress.listenedCount} 轨
      </span>

      <M3eIconButton
        aria-label='删除播放记录'
        title='删除播放记录'
        disabled={deleteMutation.isPending}
        onClick={() => setConfirmOpen(true)}>
        <M3eIcon name='delete' />
      </M3eIconButton>

      <M3eDialog
        open={confirmOpen}
        onClosed={() => setConfirmOpen(false)}
        dismissible
        closeLabel='关闭'>
        <span slot='header'>删除播放记录?</span>

        <div className='flex flex-col gap-4 py-2'>
          <p className='m-0'>
            将清除「
            {work.title}
            」的全部收听进度(已听
            {' '}
            {progress.listenedCount}
            {' '}
            轨),
            删除后无法恢复,该作品将回到未读状态。
          </p>
          <div className='flex justify-end gap-2'>
            <M3eButton variant='text' onClick={() => setConfirmOpen(false)}>
              取消
            </M3eButton>
            <M3eButton
              variant='text'
              disabled={deleteMutation.isPending}
              onClick={onDeleteConfirm}>
              删除
            </M3eButton>
          </div>
        </div>
      </M3eDialog>
    </div>
  );
}

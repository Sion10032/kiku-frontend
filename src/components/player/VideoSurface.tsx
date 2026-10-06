import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { mediaUrl } from '../../api/client';
import { getVideoElement, parkVideoElement } from '../../hooks/videoBackend';
import { usePlayerStore } from '../../stores/playerStore';

/**
 * 视频画面层：把模块级 <video> 单例（见 hooks/videoBackend.ts）
 * 挂载到全屏播放器的封面位置。
 *
 * - 宿主 div 为 display:contents：video 直接参与外层 flex 布局，
 *   以替换元素固有比例 + max-h/max-w 双约束收缩（与封面 img 同机制），
 *   容器贴合视频真实宽高比，无黑边；挂载/归还不中断播放
 * - 解码失败（如 mkv 在不支持的浏览器）：video 隐藏，回退封面图 +
 *   提示文案（按 16:9 假设）；新加载开始（loadstart）时自动恢复
 * - 点击 video = 播放/暂停 toggle（与底部控制条同源 togglePlaying）
 */
export default function VideoSurface({ workId }: { workId?: string }) {
  const { t } = useTranslation();
  const togglePlaying = usePlayerStore((s) => s.togglePlaying);
  const playing = usePlayerStore((s) => s.playing);
  const hostRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const video = getVideoElement();
    video.className =
      'max-h-full max-w-full cursor-pointer rounded-2xl object-contain';
    video.tabIndex = 0;
    const onError = () => setFailed(true);
    const onLoadStart = () => setFailed(false);
    video.addEventListener('error', onError);
    video.addEventListener('loadstart', onLoadStart);
    const host = hostRef.current;
    if (host && !failed) {
      host.appendChild(video);
    } else {
      parkVideoElement();
    }
    return () => {
      video.removeEventListener('error', onError);
      video.removeEventListener('loadstart', onLoadStart);
      parkVideoElement();
    };
  }, [failed]);

  // toggle 与 aria-label 同步（togglePlaying 为 store 稳定 action）
  useEffect(() => {
    const video = getVideoElement();
    const onClick = () => togglePlaying();
    video.setAttribute('role', 'button');
    video.setAttribute(
      'aria-label',
      playing ? t('player.pause') : t('player.play'),
    );
    video.addEventListener('click', onClick);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        togglePlaying();
      }
    };
    video.addEventListener('keydown', onKey);
    return () => {
      video.removeEventListener('click', onClick);
      video.removeEventListener('keydown', onKey);
    };
  }, [playing, togglePlaying, t]);

  return (
    <>
      {failed ? (
        <div className='relative flex aspect-video h-full max-h-full w-auto max-w-full items-center justify-center overflow-hidden rounded-2xl bg-black'>
          {workId ? (
            <img
              src={mediaUrl(`/api/cover/${workId}/file`)}
              alt=''
              className='absolute inset-0 h-full w-full object-cover opacity-60'
            />
          ) : null}
          <p className='relative z-10 mx-4 rounded-full bg-black/60 px-4 py-2 text-center text-sm text-white'>
            {t('player.video-unsupported')}
          </p>
        </div>
      ) : null}
      <div
        ref={hostRef}
        data-video-host=''
        className={failed ? 'hidden' : 'contents'}
      />
    </>
  );
}

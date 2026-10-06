import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { mediaUrl } from '../../api/client';
import { getVideoElement, parkVideoElement } from '../../hooks/videoBackend';
import { usePlayerStore } from '../../stores/playerStore';

/**
 * 视频画面层：把模块级 <video> 单例（见 hooks/videoBackend.ts）
 * 挂载到全屏播放器的封面位置。
 *
 * - 挂载/归还只是移动元素，播放不中断（折叠播放器=画面随收起、声音持续）
 * - 解码失败（如 mkv 在不支持的浏览器）：元素移回隐藏容器，回退封面图 +
 *   提示文案；新加载开始（loadstart）时自动恢复画面
 * - 点击宿主 = 播放/暂停 toggle（与底部控制条同源 togglePlaying）
 */
export default function VideoSurface({ workId }: { workId?: string }) {
  const { t } = useTranslation();
  const togglePlaying = usePlayerStore((s) => s.togglePlaying);
  const playing = usePlayerStore((s) => s.playing);
  const hostRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const video = getVideoElement();
    video.className = 'h-full w-full object-contain';
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

  return (
    <div
      role='button'
      tabIndex={0}
      aria-label={playing ? t('player.pause') : t('player.play')}
      onClick={togglePlaying}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          togglePlaying();
        }
      }}
      className='relative flex aspect-video w-[min(80vw,420px)] cursor-pointer items-center justify-center overflow-hidden rounded-2xl bg-black lg:w-auto lg:max-w-[min(60vw,720px)]'
    >
      {failed ? (
        <>
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
        </>
      ) : null}
      <div ref={hostRef} className='absolute inset-0' />
    </div>
  );
}

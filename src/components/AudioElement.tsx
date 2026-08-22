import { usePlayer } from '../hooks/usePlayer';
import { useMediaSession } from '../hooks/useMediaSession';

/**
 * 音频实例载体（无 UI）：在 MainLayout 挂载一次，
 * 负责 Howler 生命周期与 playerStore 的双向同步。
 *
 * 歌词展示（步骤 11）语义上也属于本组件，届时再扩展。
 *
 * MediaSession（锁屏/系统媒体面板）接入也在此挂载。
 */
export default function AudioElement() {
  usePlayer();
  useMediaSession();
  return null;
}

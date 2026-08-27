import { apiFetch } from './client';
import { mediaUrl } from './client';
import type { CheckLrcResponse } from '../types';

/**
 * 音频流 URL（供 Howler）。
 *
 * 后端 media index 是文件相对路径（如 `subfolder/track01.mp3`），
 * 需用 encodeURIComponent 编码路径分隔符。
 */
export function streamUrl(workId: string, mediaIndex: string): string {
  const path = `/api/media/stream/${workId}/${encodeMediaIndex(mediaIndex)}`;
  return mediaUrl(path);
}

/** 下载 URL（浏览器原生下载）。 */
export function downloadUrl(workId: string, mediaIndex: string): string {
  const path = `/api/media/download/${workId}/${encodeMediaIndex(mediaIndex)}`;
  return mediaUrl(path);
}

/** 检查歌词：GET /api/media/check-lrc/:id/:index */
export function checkLrc(
  workId: string,
  mediaIndex: string,
): Promise<CheckLrcResponse> {
  return apiFetch<CheckLrcResponse>(
    `media/check-lrc/${workId}/${encodeMediaIndex(mediaIndex)}`,
  );
}

/** 编码 media index 中的路径分隔符，保持后端可解析。 */
function encodeMediaIndex(mediaIndex: string): string {
  return mediaIndex.split('/').map(encodeURIComponent).join('/');
}

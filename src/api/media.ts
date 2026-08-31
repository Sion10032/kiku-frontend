import { api, mediaUrl } from './client';

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

/**
 * 拉取歌词原文（raw text）。解析由前端 parseLyrics 负责。
 * 走 api 实例：Authorization header 自动注入；404/网络错误由调用方静默。
 */
export async function fetchLyricsText(
  workId: string,
  lyricsHash: string,
): Promise<string> {
  const res = await api(
    `media/stream/${workId}/${encodeMediaIndex(lyricsHash)}`,
  );
  return await res.text();
}

/** 编码 media index 中的路径分隔符，保持后端可解析。 */
function encodeMediaIndex(mediaIndex: string): string {
  return mediaIndex.split('/').map(encodeURIComponent).join('/');
}

import { getColorFromImage } from '@m3e/web/theme';
import { mediaUrl } from '../api/client';

/** 种子色缓存（key 为封面 URL，value 为 #RRGGBB），避免对同一封面重复采样像素。 */
const seedColorCache = new Map<string, string>();

/**
 * 从图片 URL 提取种子色（#RRGGBB）。
 * 注意：m3e 版本接受 HTMLImageElement 而非 URL。
 * 失败（含封面 404 时 decode() reject）返回 null，保持当前主题。
 */
export async function getSeedColorFromUrl(
  imageUrl: string,
): Promise<string | null> {
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageUrl;
    await img.decode();
    return await getColorFromImage(img);
  } catch {
    return null;
  }
}

/**
 * 提取作品封面的主题种子色（带缓存）。
 * 封面 URL 与 CoverSFW 中的完整封面一致；取色失败返回 null。
 */
export async function getSeedColorForWork(
  workId: string,
): Promise<string | null> {
  const url = mediaUrl(`/api/cover/${workId}/file`);
  const cached = seedColorCache.get(url);
  if (cached) return cached;
  const color = await getSeedColorFromUrl(url);
  if (color) seedColorCache.set(url, color);
  return color;
}

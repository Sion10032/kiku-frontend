import type { PreviewFile, PreviewerDefinition } from './types';
import { ImagePreview } from './ImagePreview';
import { TextPreview } from './TextPreview';

/** 图片预览扩展名（img 原生可解码）。 */
const IMAGE_EXTS = new Set([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'avif',
  'svg',
  'bmp',
  'ico',
]);

/** 文本预览扩展名。 */
const TEXT_EXTS = new Set([
  'txt',
  'md',
  'log',
  'json',
  'xml',
  'html',
  'htm',
  'csv',
  'ini',
  'yaml',
  'yml',
  'lrc',
  'vtt',
]);

/**
 * 预览器注册表：新增格式 = 新组件文件 + 此数组加一行。
 * 匹配 = 扩展名命中或后端 leafType 分类命中（双保险）。
 */
const previewers: PreviewerDefinition[] = [
  {
    id: 'image',
    matches: (f) => IMAGE_EXTS.has(f.ext) || f.leafType === 'image',
    component: ImagePreview,
  },
  {
    id: 'text',
    matches: (f) => TEXT_EXTS.has(f.ext) || f.leafType === 'text',
    component: TextPreview,
  },
];

/** 查找可处理该文件的预览器；找不到返回 undefined。 */
export function findPreviewer(
  file: PreviewFile,
): PreviewerDefinition | undefined {
  return previewers.find((p) => p.matches(file));
}

/** 是否可预览（WorkTree 决定行点击行为与菜单项）。 */
export function isPreviewable(file: PreviewFile): boolean {
  return findPreviewer(file) !== undefined;
}

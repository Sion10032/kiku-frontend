import { flushSync } from 'react-dom';
import { getColorFromImage } from '@m3e/web/theme';
import { mediaUrl } from '../api/client';
import type {
  SeedColorRequest,
  SeedColorResponse,
} from './seed-color-protocol';

/** View Transitions 未被 TS DOM lib 覆盖的部分（Firefox 144+ / Safari 18+ / Chromium 111+） */
type DocumentWithVT = Document & {
  startViewTransition?: (callback: () => void) => unknown;
};

/**
 * 主题切换过渡：全页新旧配色交叉淡化（View Transitions 默认动画，~250ms）。
 * update 必须同步完成 DOM 更新（flushSync），否则浏览器捕获的
 * “新状态”仍是旧色。不支持 View Transitions 或用户偏好减少动效时
 * 退化为直接更新（现状跳变）。
 */
export function withThemeTransition(update: () => void): void {
  const reduceMotion = window.matchMedia?.(
    '(prefers-reduced-motion: reduce)',
  ).matches;
  const doc = document as DocumentWithVT;
  if (reduceMotion || typeof doc.startViewTransition !== 'function') {
    update();
    return;
  }
  doc.startViewTransition(() => flushSync(update));
}

/** 种子色缓存（key 为封面 URL，value 为 #RRGGBB），避免对同一封面重复采样像素。 */
const seedColorCache = new Map<string, string>();

/**
 * 从图片 URL 提取种子色（#RRGGBB）。
 * 注意：m3e 版本接受 HTMLImageElement 而非 URL，且在主线程对全图逐像素
 * 量化（Wu + 128 质心 K-Means），大图会阻塞 UI——仅作为 Worker 不可用时的回退。
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

// ---- 取色 Worker：量化全在工作线程，主线程只做 fetch 分发与结果配对 ----

let worker: Worker | null | undefined;
let nextId = 0;
const pending = new Map<number, (color: string | null) => void>();

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    const w = new Worker(new URL('./theme.worker.ts', import.meta.url), {
      type: 'module',
    });
    w.onmessage = (e: MessageEvent<SeedColorResponse>) => {
      const resolve = pending.get(e.data.id);
      pending.delete(e.data.id);
      resolve?.(e.data.ok ? e.data.color : null);
    };
    // worker 加载失败等：所有在途请求按失败收场，之后直接走回退
    w.onerror = () => {
      for (const resolve of pending.values()) resolve(null);
      pending.clear();
      worker = null;
      w.terminate();
    };
    worker = w;
  } catch {
    worker = null;
  }
  return worker;
}

/**
 * 提取作品封面的主题种子色（带缓存）；取色失败返回 null。
 * 取色源用 240x240 缩略图（m3e 取色主色调结果一致，且后端缺失缩略图时
 * 自动回退 main）；量化在 theme.worker.ts 的工作线程完成，不阻塞主线程。
 */
export async function getSeedColorForWork(
  workId: string,
): Promise<string | null> {
  const url = mediaUrl(`/api/cover/${workId}/file?type=240x240`);
  const cached = seedColorCache.get(url);
  if (cached) return cached;

  const w = getWorker();
  if (!w) return getSeedColorFromUrl(url);

  const id = ++nextId;
  const color = await new Promise<string | null>((resolve) => {
    pending.set(id, resolve);
    const req: SeedColorRequest = { id, url };
    w.postMessage(req);
  });
  if (color) seedColorCache.set(url, color);
  return color;
}

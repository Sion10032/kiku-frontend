// 主题种子色提取 Worker：fetch 封面 → 解码缩放到 96px → 量化取主色。
// 整条链路在工作线程执行，主线程零阻塞（m3e 的 getColorFromImage 在
// 主线程对全图逐像素跑 Wu+K-Means，手机上可达数百 ms）。
// 协议见 seed-color-protocol.ts；消费方以
// `new Worker(new URL('./theme.worker.ts', import.meta.url), { type: 'module' })` 创建，
// Vite 自动打包。协议处理与 self.postMessage 解耦：工厂注入 post 与 I/O，
// node/bun 下可驱动冒烟。
import {
  argbFromRgb,
  hexFromArgb,
  QuantizerCelebi,
  Score,
} from '@material/material-color-utilities';
import type {
  SeedColorRequest,
  SeedColorResponse,
} from './seed-color-protocol';

/** 采样边长：主色只需色彩分布不需细节；96px 量化耗时约为 240px 的 1/5 */
export const SAMPLE_SIZE = 96;
/** K-Means 质心数：m3e 用 128 属纯浪费，32 对主色结果几乎无影响 */
export const MAX_COLORS = 32;

/** I/O 能力注入：真 worker 传浏览器全局，测试传 fake */
export interface SeedColorIo {
  fetch: typeof fetch;
  createImageBitmap: typeof createImageBitmap;
  OffscreenCanvas: new (
    width: number,
    height: number,
  ) => {
    getContext: (id: '2d') => {
      drawImage: (bmp: ImageBitmap, dx: number, dy: number) => void;
      getImageData: (
        sx: number,
        sy: number,
        sw: number,
        sh: number,
      ) => { data: Uint8ClampedArray };
    } | null;
  };
}

/**
 * RGBA 像素数组 → 主题种子色（#RRGGBB）。
 * 与 m3e 实现一致：半透明像素跳过；无不透明像素返回 null。
 */
export function extractSeedColor(data: Uint8ClampedArray): string | null {
  const pixels: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 255) continue;
    pixels.push(argbFromRgb(data[i], data[i + 1], data[i + 2]));
  }
  if (pixels.length === 0) return null;
  const top = Score.score(QuantizerCelebi.quantize(pixels, MAX_COLORS))[0];
  return top === undefined ? null : hexFromArgb(top);
}

/** 取色 worker 协议处理器：fetch → 缩放 → getImageData → 量化 */
export function createSeedColorWorker(
  post: (msg: SeedColorResponse) => void,
  io: SeedColorIo,
) {
  return {
    async handle(req: SeedColorRequest): Promise<void> {
      try {
        const res = await io.fetch(req.url);
        const blob = await res.blob();
        const bmp = await io.createImageBitmap(blob, {
          resizeWidth: SAMPLE_SIZE,
          resizeHeight: SAMPLE_SIZE,
          resizeQuality: 'medium',
        });
        const canvas = new io.OffscreenCanvas(bmp.width, bmp.height);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('no 2d context');
        ctx.drawImage(bmp, 0, 0);
        const { data } = ctx.getImageData(0, 0, bmp.width, bmp.height);
        bmp.close();
        const color = extractSeedColor(data);
        post(
          color ? { id: req.id, ok: true, color } : { id: req.id, ok: false },
        );
      } catch {
        // 网络失败 / 解码失败 / OffscreenCanvas 不可用：主线程保持当前主题
        post({ id: req.id, ok: false });
      }
    },
  };
}

// ---- Worker 入口（浏览器 module worker 下生效；node/bun 导入时无害） ----
if (typeof self !== 'undefined') {
  const ctx = self as unknown as {
    postMessage: (msg: SeedColorResponse) => void;
    onmessage: ((e: MessageEvent<SeedColorRequest>) => void) | null;
  };
  const worker = createSeedColorWorker((msg) => ctx.postMessage(msg), {
    fetch: fetch.bind(globalThis),
    createImageBitmap: createImageBitmap.bind(globalThis),
    OffscreenCanvas: OffscreenCanvas,
  });
  ctx.onmessage = (e) => void worker.handle(e.data);
}

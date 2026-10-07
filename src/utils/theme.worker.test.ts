// 取色 worker 纯逻辑测试：无需 DOM / 真 worker，注入 fake I/O 驱动
import { describe, expect, it } from 'vitest';
import type {
  SeedColorRequest,
  SeedColorResponse,
} from './seed-color-protocol';
import { createSeedColorWorker, extractSeedColor } from './theme.worker';

/** 像素四元组 → RGBA 字节数组 */
function rgba(...px: [number, number, number, number][]): Uint8ClampedArray {
  return new Uint8ClampedArray(px.flat());
}

describe('extractSeedColor', () => {
  it('纯色图返回该色（hex 小写）', () => {
    const data = rgba(
      [255, 0, 0, 255],
      [255, 0, 0, 255],
      [255, 0, 0, 255],
      [255, 0, 0, 255],
    );
    expect(extractSeedColor(data)).toBe('#ff0000');
  });

  it('优势色按占比胜出', () => {
    const data = rgba(
      [255, 0, 0, 255],
      [255, 0, 0, 255],
      [255, 0, 0, 255],
      [255, 0, 0, 255],
      [255, 0, 0, 255],
      [255, 0, 0, 255],
      [255, 0, 0, 255],
      [255, 0, 0, 255],
      [0, 0, 255, 255],
    );
    expect(extractSeedColor(data)).toBe('#ff0000');
  });

  it('半透明像素不参与取色（与 m3e 一致）', () => {
    const data = rgba(
      [255, 0, 0, 128],
      [255, 0, 0, 128],
      [255, 0, 0, 128],
      [255, 0, 0, 128],
      [0, 0, 255, 255],
      [0, 0, 255, 255],
      [0, 0, 255, 255],
      [0, 0, 255, 255],
    );
    expect(extractSeedColor(data)).toBe('#0000ff');
  });

  it('无不透明像素返回 null', () => {
    const data = rgba([255, 0, 0, 0], [0, 255, 0, 128]);
    expect(extractSeedColor(data)).toBeNull();
  });
});

// ---- 工厂冒烟：注入 fake fetch / createImageBitmap / OffscreenCanvas ----

function fakeIo(data: Uint8ClampedArray) {
  const bmp = { width: 2, height: 2, close: () => {} };
  return {
    fetch: (async () => ({
      blob: async () => ({}),
    })) as unknown as typeof fetch,
    createImageBitmap: (async () => bmp) as unknown as typeof createImageBitmap,
    OffscreenCanvas: class {
      getContext() {
        return {
          drawImage: () => {},
          getImageData: () => ({ data }),
        };
      }
    },
  };
}

const req: SeedColorRequest = { id: 1, url: 'http://x/cover.png' };

describe('createSeedColorWorker', () => {
  it('成功路径：post 带 id 的取色结果', async () => {
    const posted: SeedColorResponse[] = [];
    const worker = createSeedColorWorker(
      (m) => posted.push(m),
      fakeIo(
        rgba(
          [0, 0, 255, 255],
          [0, 0, 255, 255],
          [0, 0, 255, 255],
          [0, 0, 255, 255],
        ),
      ),
    );
    await worker.handle(req);
    expect(posted).toEqual([{ id: 1, ok: true, color: '#0000ff' }]);
  });

  it('fetch 失败：post ok=false（不抛出）', async () => {
    const posted: SeedColorResponse[] = [];
    const io = fakeIo(rgba([0, 0, 255, 255]));
    io.fetch = (async () => {
      throw new Error('network');
    }) as unknown as typeof fetch;
    const worker = createSeedColorWorker((m) => posted.push(m), io);
    await worker.handle(req);
    expect(posted).toEqual([{ id: 1, ok: false }]);
  });

  it('空图（全透明）：post ok=false', async () => {
    const posted: SeedColorResponse[] = [];
    const worker = createSeedColorWorker(
      (m) => posted.push(m),
      fakeIo(rgba([0, 0, 0, 0])),
    );
    await worker.handle(req);
    expect(posted).toEqual([{ id: 1, ok: false }]);
  });
});

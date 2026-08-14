import type { Tracks, TrackFolder } from '../types';

/**
 * ⚠️ Mock 文件树 —— 临时兜底数据。
 *
 * 后端 `/tracks/:id` 目前是 501 stub（TODO.md 注意事项 13），无法拿到真实
 * 曲目列表。本模块构造与后端将返回结构一致的假文件树（type/title/hash/children，
 * 对齐原 kikoeru-quasar 的 tracks 响应），保证步骤 7 的 WorkTree 可渲染、可入队。
 *
 * 触发方式：`api/works.ts` 的 `getTracks` 在请求失败（501/404）时回退到
 * `buildMockTracks`。后端实现 `/tracks/:id` 后，删除 getTracks 中的 fallback
 * 与本文件即可（不影响其他代码）。
 */
export function buildMockTracks(workId: number): Tracks {
  const seed = workId % 7; // 按作品 id 取一个稳定的伪随机偏移，保证每次渲染一致

  return [
    buildFolder('01_本編', 6 + seed),
    buildFolder('02_特典', 4 + ((seed * 3) % 3)),
    buildFolder('03_フリートーク', 2 + (seed % 2)),
    { title: '説明書.txt', type: 'text', hash: '説明書.txt' },
    { title: 'サンプル画像.jpg', type: 'image', hash: 'サンプル画像.jpg' },
  ];
}

/** 构造一个文件夹节点（含若干音频 + 一个文本说明）。 */
function buildFolder(title: string, audioCount: number): TrackFolder {
  const children: Tracks = [];
  for (let i = 1; i <= audioCount; i++) {
    const file = `トラック${String(i).padStart(2, '0')}.mp3`;
    children.push({ title: file, type: 'audio', hash: `${title}/${file}` });
  }
  children.push({
    title: '内容説明.txt',
    type: 'text',
    hash: `${title}/内容説明.txt`,
  });
  return { title, type: 'folder', children };
}

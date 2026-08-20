import type { Track } from '../stores/playerStore';
import type { TrackLeaf, TrackNode, Work } from '../types';
import { downloadUrl, streamUrl } from '../api/media';

/** 由叶子节点构造播放队列项(hash = media index,供 stream/download)。 */
export function toTrack(work: Work, leaf: TrackLeaf): Track {
  return {
    hash: leaf.hash,
    title: leaf.title,
    workTitle: work.title,
    workId: work.id,
    mediaStreamUrl: streamUrl(work.id, leaf.hash),
    mediaDownloadUrl: downloadUrl(work.id, leaf.hash),
  };
}

/** 深度优先扁平化文件树,收集全部音频叶子(「继续播放」队列用)。 */
export function flattenAudioLeaves(nodes: TrackNode[]): TrackLeaf[] {
  const out: TrackLeaf[] = [];
  function walk(list: TrackNode[]): void {
    for (const n of list) {
      if (n.type === 'folder') walk(n.children);
      else if (n.type === 'audio') out.push(n);
    }
  }
  walk(nodes);
  return out;
}

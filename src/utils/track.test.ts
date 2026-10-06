import { describe, expect, it } from 'vitest';
import { flattenAudioLeaves, isVideoTrack, toTrack } from './track';
import type { Work } from '../types';

const work = { id: 'RJ123', title: '作品' } as unknown as Work;

describe('toTrack', () => {
  it('拷贝 lyrics 引用到 Track', () => {
    const track = toTrack(work, {
      type: 'audio',
      title: 'a.mp3',
      hash: 'sub/a.mp3',
      lyrics: { hash: 'sub/a.lrc', type: 'lrc' },
    });
    expect(track.lyrics).toEqual({ hash: 'sub/a.lrc', type: 'lrc' });
  });

  it('无歌词时不产生 lyrics 键', () => {
    const track = toTrack(work, {
      type: 'audio',
      title: 'a.mp3',
      hash: 'a.mp3',
    });
    expect('lyrics' in track).toBe(false);
  });

  it('携带作品响度快照（已分析）', () => {
    const analyzed = {
      id: 'RJ123',
      title: '作品',
      loudnessLufs: -18.4,
      loudnessTruePeakDb: -1.2,
    } as unknown as Work;
    const track = toTrack(analyzed, {
      type: 'audio',
      title: 'a.mp3',
      hash: 'a.mp3',
    });
    expect(track.loudness).toEqual({ lufs: -18.4, truePeakDb: -1.2 });
  });

  it('携带作品响度快照（未分析 → null）', () => {
    const unanalyzed = {
      id: 'RJ123',
      title: '作品',
      loudnessLufs: null,
      loudnessTruePeakDb: null,
    } as unknown as Work;
    const track = toTrack(unanalyzed, {
      type: 'audio',
      title: 'a.mp3',
      hash: 'a.mp3',
    });
    expect(track.loudness).toEqual({ lufs: null, truePeakDb: null });
  });
});

describe('isVideoTrack', () => {
  it('按 hash 扩展名判定视频（大小写不敏感）', () => {
    expect(isVideoTrack({ hash: 'v.mp4' })).toBe(true);
    expect(isVideoTrack({ hash: 'v.WEBM' })).toBe(true);
    expect(isVideoTrack({ hash: 'v.mkv' })).toBe(true);
  });

  it('音频扩展名与其它类型不误判', () => {
    expect(isVideoTrack({ hash: 'a.mp3' })).toBe(false);
    expect(isVideoTrack({ hash: 'a.m4a' })).toBe(false);
    expect(isVideoTrack({ hash: 'a.wv' })).toBe(false);
    expect(isVideoTrack({ hash: 'a.lrc' })).toBe(false);
  });
});

describe('flattenAudioLeaves', () => {
  it('深度优先收集 audio 与 video 叶子，跳过 text/image', () => {
    const leaves = flattenAudioLeaves([
      {
        type: 'folder',
        title: 'sub',
        children: [{ type: 'video', title: 'v.mkv', hash: 'sub/v.mkv' }],
      },
      { type: 'audio', title: 'a.mp3', hash: 'a.mp3' },
      { type: 'text', title: 'a.lrc', hash: 'a.lrc' },
    ]);
    expect(leaves.map((n) => n.hash)).toEqual(['sub/v.mkv', 'a.mp3']);
  });
});

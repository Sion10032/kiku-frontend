import { describe, expect, it } from 'vitest';
import { toTrack } from './track';
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
});

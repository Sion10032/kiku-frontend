import { describe, expect, it } from 'vitest';
import type { TrackLeaf } from '../../types';
import { toPreviewFile } from './types';

describe('toPreviewFile', () => {
  it('derives ext from the last path segment', () => {
    const leaf: TrackLeaf = { title: 'Foo.mp3', type: 'audio', hash: 'subfolder/foo.mp3' };
    expect(toPreviewFile('w1', leaf)).toEqual({
      workId: 'w1',
      hash: 'subfolder/foo.mp3',
      title: 'Foo.mp3',
      ext: 'mp3',
      leafType: 'audio',
    });
  });

  it('lowercases an uppercase extension', () => {
    const leaf: TrackLeaf = { title: 'X.TXT', type: 'text', hash: 'X.TXT' };
    expect(toPreviewFile('w1', leaf).ext).toBe('txt');
  });

  it('returns an empty ext when the name has no dot', () => {
    const leaf: TrackLeaf = { title: 'README', type: 'text', hash: 'README' };
    expect(toPreviewFile('w1', leaf).ext).toBe('');
  });

  it('treats a leading-dot name as extensionless', () => {
    const leaf: TrackLeaf = { title: '.gitignore', type: 'other', hash: '.gitignore' };
    expect(toPreviewFile('w1', leaf).ext).toBe('');
  });

  it('only considers the last path segment for the extension', () => {
    const leaf: TrackLeaf = { title: 'file.jpeg', type: 'image', hash: 'a/b/file.jpeg' };
    expect(toPreviewFile('w1', leaf).ext).toBe('jpeg');
  });

  it('passes through every leafType', () => {
    const types: TrackLeaf['type'][] = [ 'text', 'image', 'other' ];
    for (const type of types) {
      const leaf: TrackLeaf = { title: `f.${type}`, type, hash: `f.${type}` };
      expect(toPreviewFile('w1', leaf).leafType).toBe(type);
    }
  });
});

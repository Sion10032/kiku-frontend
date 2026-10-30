import { describe, expect, it } from 'vitest';
import { buildFileInfoSections } from './FileInfoDialog';
import type { TrackLeaf } from '../../types';

const label = (key: string) => key;
const audioLeaf: TrackLeaf = {
  type: 'audio',
  title: '01.mp3',
  hash: 'sub/01.mp3',
  sizeBytes: 1536,
  durationSec: 61,
  loudnessLufs: -18.5,
  loudnessTruePeakDb: -1.2,
  lyrics: { hash: 'sub/01.lrc', type: 'lrc' },
};

describe('buildFileInfoSections', () => {
  it('全量 audio：两组，行顺序固定', () => {
    const sections = buildFileInfoSections(audioLeaf, label);
    expect(sections.map((s) => s.title)).toEqual([
      'works.fileInfo.section-basic',
      'works.fileInfo.section-audio',
    ]);
    expect(sections[0]?.rows.map((r) => r.label)).toEqual([
      'works.fileInfo.field-name',
      'works.fileInfo.field-path',
      'works.fileInfo.field-type',
      'works.fileInfo.field-size',
    ]);
    expect(sections[1]?.rows.map((r) => r.label)).toEqual([
      'works.fileInfo.field-duration',
      'works.fileInfo.field-loudness',
      'works.fileInfo.field-true-peak',
      'works.fileInfo.field-lyrics',
    ]);
  });

  it('值格式化：大小 / 时长 / LUFS / dBTP', () => {
    const rows = buildFileInfoSections(audioLeaf, label).flatMap((s) => s.rows);
    expect(rows[3]?.value).toBe('1.5 KB');
    expect(rows[4]?.value).toBe('1:01');
    expect(rows[5]?.value).toBe('-18.5 LUFS');
    expect(rows[6]?.value).toBe('-1.2 dBTP');
    expect(rows[7]?.value).toBe('sub/01.lrc');
  });

  it('只有 文件名 / 相对路径 / 歌词 可复制', () => {
    const rows = buildFileInfoSections(audioLeaf, label).flatMap((s) => s.rows);
    expect(rows.filter((r) => r.copyable).map((r) => r.label)).toEqual([
      'works.fileInfo.field-name',
      'works.fileInfo.field-path',
      'works.fileInfo.field-lyrics',
    ]);
  });

  it('类型值走 i18n key，不暴露英文枚举', () => {
    const rows = buildFileInfoSections(audioLeaf, label).flatMap((s) => s.rows);
    expect(rows[2]?.value).toBe('works.fileInfo.type-audio');
  });

  it('旧响应字段缺失（sizeBytes/durationSec/响度 undefined）→ 对应行隐藏', () => {
    const sections = buildFileInfoSections(
      { type: 'audio', title: 'a.mp3', hash: 'a.mp3' },
      label,
    );
    expect(sections.map((s) => s.title)).toEqual([
      'works.fileInfo.section-basic',
    ]);
    expect(sections[0]?.rows.map((r) => r.label)).toEqual([
      'works.fileInfo.field-name',
      'works.fileInfo.field-path',
      'works.fileInfo.field-type',
    ]);
  });

  it('非 audio：无音频分组，有大小行', () => {
    const sections = buildFileInfoSections(
      { type: 'image', title: 'a.jpg', hash: 'a.jpg', sizeBytes: 8 },
      label,
    );
    expect(sections.map((s) => s.title)).toEqual([
      'works.fileInfo.section-basic',
    ]);
    expect(sections[0]?.rows.map((r) => r.value)).toEqual([
      'a.jpg',
      'a.jpg',
      'works.fileInfo.type-image',
      '8 B',
    ]);
  });

  it('响度为 null（未分析）→ 响度两行隐藏，时长/歌词保留', () => {
    const sections = buildFileInfoSections(
      { ...audioLeaf, loudnessLufs: null, loudnessTruePeakDb: null },
      label,
    );
    expect(sections[1]?.rows.map((r) => r.label)).toEqual([
      'works.fileInfo.field-duration',
      'works.fileInfo.field-lyrics',
    ]);
  });
});

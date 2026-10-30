/**
 * 文件信息 Dialog 的数据层：leaf → 分组键值行（纯函数，可单测）。
 *
 * 与组件分文件：FileInfoDialog.tsx 只导出组件，保证 Fast Refresh 可用
 * （同文件再导出非组件会触 react-refresh/only-export-components）。
 */
import type { TrackLeaf } from '../../types';
import { formatBytes, formatDuration } from '../../utils/format';

export interface FileInfoRow {
  /** 行标签（已翻译） */
  label: string;
  value: string;
  /** 是否值得复制（只给文件名 / 路径 / 歌词这类文本值；数值复制无意义）。
   *  当前 UI 未提供复制按钮，保留该标记以便恢复时无需重算规则。 */
  copyable?: boolean;
}

export interface FileInfoSection {
  /** 分组标题（已翻译） */
  title: string;
  rows: FileInfoRow[];
}

/** 文件类型枚举 → i18n key（界面上不直接暴露 audio/video 等英文枚举）。 */
const TYPE_LABEL_KEYS: Record<TrackLeaf['type'], string> = {
  audio: 'works.fileInfo.type-audio',
  video: 'works.fileInfo.type-video',
  text: 'works.fileInfo.type-text',
  image: 'works.fileInfo.type-image',
  other: 'works.fileInfo.type-other',
};

/**
 * 纯函数（可单测）：leaf → 分组键值行。
 * - 「基本信息」始终存在：文件名 → 相对路径 → 类型 → 大小（大小取不到则省略该行）
 * - 「音频分析」仅 audio 出现，且整组无有效行时省略：时长 → 整合响度 → 峰值响度 → 歌词
 */
export function buildFileInfoSections(
  leaf: TrackLeaf,
  label: (key: string) => string,
): FileInfoSection[] {
  const basic: FileInfoRow[] = [
    {
      label: label('works.fileInfo.field-name'),
      value: leaf.title,
      copyable: true,
    },
    {
      label: label('works.fileInfo.field-path'),
      value: leaf.hash,
      copyable: true,
    },
    {
      label: label('works.fileInfo.field-type'),
      value: label(TYPE_LABEL_KEYS[leaf.type]),
    },
  ];
  if (leaf.sizeBytes != null) {
    basic.push({
      label: label('works.fileInfo.field-size'),
      value: formatBytes(leaf.sizeBytes),
    });
  }

  const audio: FileInfoRow[] = [];
  if (leaf.type === 'audio') {
    if (leaf.durationSec != null) {
      audio.push({
        label: label('works.fileInfo.field-duration'),
        value: formatDuration(leaf.durationSec),
      });
    }
    if (leaf.loudnessLufs != null) {
      audio.push({
        label: label('works.fileInfo.field-loudness'),
        value: `${leaf.loudnessLufs.toFixed(1)} LUFS`,
      });
    }
    if (leaf.loudnessTruePeakDb != null) {
      audio.push({
        label: label('works.fileInfo.field-true-peak'),
        value: `${leaf.loudnessTruePeakDb.toFixed(1)} dBTP`,
      });
    }
    if (leaf.lyrics) {
      audio.push({
        label: label('works.fileInfo.field-lyrics'),
        value: leaf.lyrics.hash,
        copyable: true,
      });
    }
  }

  const sections: FileInfoSection[] = [
    { title: label('works.fileInfo.section-basic'), rows: basic },
  ];
  if (audio.length > 0) {
    sections.push({
      title: label('works.fileInfo.section-audio'),
      rows: audio,
    });
  }
  return sections;
}

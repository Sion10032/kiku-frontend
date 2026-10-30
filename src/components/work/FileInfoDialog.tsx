/**
 * 文件信息 Dialog：WorkTree 叶子节点 ⋮ 菜单「文件信息」项打开。
 * 纯静态展示（零网络请求），按「基本信息 / 音频分析」分组：
 * 文件名、相对路径、类型、大小；audio 另有 时长、整合响度、峰值响度、歌词。
 * 仅 文件名 / 相对路径 / 歌词 三行提供复制按钮（其余值复制无意义）。
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { M3eDialog } from '@m3e/react/dialog';
import { M3eIconButton } from '@m3e/react/icon-button';
import { M3eIcon } from '@m3e/react/icon';
import '@m3e/icons/outlined/check';
import '@m3e/icons/outlined/content_copy';
import type { TrackLeaf } from '../../types';
import { formatBytes, formatDuration } from '../../utils/format';

export interface FileInfoRow {
  /** 行标签（已翻译） */
  label: string;
  value: string;
  /** 是否提供复制按钮（只给值得复制的文本值：文件名 / 路径 / 歌词） */
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
 * 复制按钮：点击写剪贴板，成功后 1.5s 显示 ✓。
 * M3E 规定图标用默认插槽（直接子元素），选中态用内置 `selected` 插槽；
 * 包一层 `<span slot='icon'>` 会落进不存在的具名插槽 → 图标不渲染。
 */
function CopyButton(props: { text: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  function copy() {
    navigator.clipboard
      .writeText(props.text)
      .then(() => {
        setCopied(true);
        window.clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  }
  return (
    <M3eIconButton
      // 图标按钮默认 extra-small 容器 32px。压到 24px 让它在行内更紧凑；
      // 行高统一由 min-h-10 兜底（见列表行），即使该变量失效也不会不齐。
      className='[--m3e-icon-button-extra-small-container-height:24px] [--m3e-icon-button-extra-small-icon-size:16px]'
      variant='standard'
      size='extra-small'
      toggle
      selected={copied}
      aria-label={t('common.copy')}
      onClick={copy}
    >
      <M3eIcon name='content_copy' />
      <M3eIcon slot='selected' name='check' />
    </M3eIconButton>
  );
}

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

export function FileInfoDialog(props: {
  leaf: TrackLeaf | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  // 关闭即卸载（同 LoudnessCurveDialog）：leaf 为 null 时不渲染 M3eDialog，
  // 避免旧 leaf 的标题/内容在关闭动画后残留。
  if (props.leaf === null) return null;
  const leaf = props.leaf;
  // buildFileInfoSections 是纯函数，label 回调收 string；这里的 key 全部来自
  // 函数内部硬编码的 works.fileInfo.*（类型安全由其单测固化），
  // 转 t 的键联合类型即可。
  const sections = buildFileInfoSections(leaf, (key) => t(key as never));
  return (
    <M3eDialog
      className='[--m3e-dialog-min-width:min(420px,calc(100vw-2rem))] [--m3e-dialog-max-width:min(420px,calc(100vw-2rem))]'
      open
      onClosed={props.onClose}
      dismissible
      closeLabel={t('common.close')}
    >
      <span slot='header'>{t('works.fileInfo.title')}</span>
      <div className='flex flex-col gap-4'>
        {sections.map((section) => (
          <section key={section.title} className='flex flex-col gap-1.5'>
            <h3 className='text-sm font-medium opacity-60'>{section.title}</h3>
            <div className='flex flex-col divide-y divide-(--md-sys-color-outline-variant)'>
              {section.rows.map((row) => (
                <div
                  key={row.label}
                  // min-h-10 (40px) 同时盖过按钮默认 32px 与文本行，保证
                  // 有无复制按钮的行高一致；py-2 让长文件名/路径换行后
                  // 上下留出呼吸空间，不贴着分隔线。
                  className='flex min-h-10 items-center gap-3 py-2'
                >
                  <span className='w-20 shrink-0 text-sm opacity-60'>
                    {row.label}
                  </span>
                  <span className='min-w-0 flex-1 text-sm break-words'>
                    {row.value}
                  </span>
                  {/* 固定列宽：有无按钮的行值列右边界一致（按钮约 22–24px） */}
                  <span className='flex w-7 shrink-0 justify-end'>
                    {row.copyable && <CopyButton text={row.value} />}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </M3eDialog>
  );
}

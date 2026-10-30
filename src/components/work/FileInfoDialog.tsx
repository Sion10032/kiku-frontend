/**
 * 文件信息 Dialog：WorkTree 叶子节点 ⋮ 菜单「文件信息」项打开。
 * 纯静态展示（零网络请求，数据见 fileInfoSections.ts），按
 * 「基本信息 / 音频分析」分组：文件名、完整路径、类型、大小；
 * audio 另有 时长、整合响度、峰值响度、歌词。
 */
import { useTranslation } from 'react-i18next';
import { M3eDialog } from '@m3e/react/dialog';
import type { TrackLeaf } from '../../types';
import { buildFileInfoSections } from './fileInfoSections';

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
      // 高度：M3E 默认限高 min(560px, 100% - 48px)，是固定 px，
      // 而本弹窗内容全部是 rem（随「界面缩放」uiScale 线性放大），
      // uiScale ≥ 130% 或窗口较矮时内容就超过 560px，弹出滚动条。
      // 改用视口高度上限（同其他对话框），内容不多时不会滚动。
      className='[--m3e-dialog-min-width:min(420px,calc(100vw-2rem))] [--m3e-dialog-max-width:min(420px,calc(100vw-2rem))] [--m3e-dialog-max-height:90dvh]'
      open
      onClosed={props.onClose}
      dismissible
      closeLabel={t('common.close')}
    >
      <span slot='header'>{t('works.fileInfo.title')}</span>
      <div className='flex flex-col gap-3'>
        {sections.map((section) => (
          <section key={section.title} className='flex flex-col gap-1'>
            {/* 项目未引入 Tailwind preflight（index.css 里被注释），h3 会带
                浏览器默认的 margin-block: 1em（16px 字号 = 上下各 16px）。
                必须显式 m-0 抵消，否则组标题上下空得很多。 */}
            <h3 className='m-0 text-base font-medium text-(--md-sys-color-on-surface)'>
              {section.title}
            </h3>
            <div className='flex flex-col divide-y divide-(--md-sys-color-outline-variant)'>
              {section.rows.map((row) => (
                <div
                  key={row.label}
                  // min-h-10 (40px) 盖过文本行，让单行行高一致；
                  // py-2 让长文件名/路径换行后上下留出呼吸空间。
                  className='flex min-h-10 items-center gap-3 py-2'
                >
                  <span className='w-20 shrink-0 text-sm opacity-60'>
                    {row.label}
                  </span>
                  <span className='min-w-0 flex-1 text-sm wrap-break-word'>
                    {row.value}
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

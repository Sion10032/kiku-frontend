import { useEffect } from 'react';
import type { CSSProperties } from 'react';
import { M3eDialog } from '@m3e/react/dialog';
import type { M3eDialogElement } from '@m3e/react/dialog';
import { M3eIconButton } from '@m3e/react/icon-button';
import { M3eIcon } from '@m3e/react/icon';
import '@m3e/icons/outlined/chevron_left';
import '@m3e/icons/outlined/chevron_right';
import '@m3e/icons/outlined/download';
import '@m3e/icons/outlined/open_in_new';
import { downloadUrl, streamUrl } from '../../api/media';
import { findPreviewer } from './registry';
import type { PreviewFile } from './types';
import { useM3eStyle } from '../../hooks/useM3eStyle';

/**
 * 覆写 m3e 默认 35rem 宽度上限：CSS 变量从祖先 div 继承进
 * shadow DOM（不依赖 React wrapper 对 host style 的透传）。
 * 高度由 useM3eStyle 注入 shadow DOM（.base 90dvh + .content flex:1），
 * 见下方 dialogRef。
 */
const WRAPPER_STYLE = { '--m3e-dialog-max-width': '95vw' } as CSSProperties;

interface FilePreviewDialogProps {
  /** 受控开关（组件常驻，open=false 时不渲染内容避免后台 fetch） */
  open: boolean;
  /** 当前目录全部可预览文件（画廊翻页范围，打开时快照） */
  files: PreviewFile[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

/**
 * 预览壳：大模态框 + 画廊翻页（按钮 + ←/→ 键）+ 标题栏
 * （文件名、n/N、新标签页打开、下载；关闭按钮由 m3e dismissible 自带）。
 * 内容区按注册表查找预览器渲染；画廊逻辑在壳层，所有格式共用。
 */
export function FilePreviewDialog({
  open,
  files,
  index,
  onIndexChange,
  onClose,
}: FilePreviewDialogProps) {
  const file = files[index];
  const previewer = file ? findPreviewer(file) : undefined;
  const hasGallery = files.length > 1;

  const dialogRef = useM3eStyle<M3eDialogElement>({
    style: {
      '.base': { height: '90dvh' },
      '.content': {
        flex: 1,
        paddingBottom: 'var(--md-sys-measurement-space300, 24px)',
        marginBottom: '0 !important',
      },
    },
  });

  function go(delta: number) {
    onIndexChange((index + delta + files.length) % files.length);
  }

  // 键盘翻页（Esc 关闭由原生 dialog cancel / dismissible 处理）
  useEffect(() => {
    if (!open || !hasGallery) return;
    function onKeydown(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'ArrowRight') go(1);
    }
    window.addEventListener('keydown', onKeydown);
    return () => window.removeEventListener('keydown', onKeydown);
  });

  function openInNewTab() {
    if (file)
      window.open(streamUrl(file.workId, file.hash), '_blank', 'noopener');
  }

  function download() {
    if (!file) return;
    const a = document.createElement('a');
    a.href = downloadUrl(file.workId, file.hash);
    a.download = file.hash.split('/').pop() ?? file.hash;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <div style={WRAPPER_STYLE}>
      <M3eDialog
        ref={dialogRef}
        open={open}
        onClosed={onClose}
        dismissible
        closeLabel='关闭'
      >
        <span slot='header' className='flex min-w-0 flex-1 items-center gap-1'>
          <span className='truncate'>{file?.title}</span>
          {hasGallery && (
            <span className='flex-none text-sm opacity-60'>
              （{index + 1}/{files.length}）
            </span>
          )}
          <span className='ms-auto flex flex-none items-center'>
            <M3eIconButton aria-label='在新标签页打开' onClick={openInNewTab}>
              <M3eIcon name='open_in_new' />
            </M3eIconButton>
            <M3eIconButton aria-label='下载文件' onClick={download}>
              <M3eIcon name='download' />
            </M3eIconButton>
          </span>
        </span>

        {/* 内容区擑满 .content（h-full），预览器自身 h-full 铺满并内部滚动；
            翻页按钮绝对定位悬浮两侧 */}
        <div className='relative h-full w-full'>
          {hasGallery && (
            <>
              <div className='absolute inset-y-1/2 left-1 z-10 flex items-center'>
                <M3eIconButton aria-label='上一个' onClick={() => go(-1)}>
                  <M3eIcon name='chevron_left' />
                </M3eIconButton>
              </div>
              <div className='absolute inset-y-1/2 right-1 z-10 flex items-center'>
                <M3eIconButton aria-label='下一个' onClick={() => go(1)}>
                  <M3eIcon name='chevron_right' />
                </M3eIconButton>
              </div>
            </>
          )}
          {open && file && previewer && (
            <previewer.component key={file.hash} file={file} />
          )}
        </div>
      </M3eDialog>
    </div>
  );
}

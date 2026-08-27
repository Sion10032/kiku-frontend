import { useEffect, useState } from 'react';
import { M3eIconButton } from '@m3e/react/icon-button';
import { M3eIcon } from '@m3e/react/icon';
import { M3eCircularProgressIndicator } from '@m3e/react/progress-indicator';
import '@m3e/icons/outlined/text_decrease';
import '@m3e/icons/outlined/text_increase';
import '@m3e/icons/outlined/wrap_text';
import '@m3e/icons/outlined/refresh';
import { streamUrl } from '../../api/media';
import { useSettingsStore } from '../../stores/settingsStore';
import { decodeTextData, type DecodedText } from './encoding';
import type { PreviewerProps } from './types';
import { M3eCard } from '@m3e/react/card';

/** 渲染层字符截断（解码用完整 buffer，见 encoding.ts 注释）。 */
const MAX_CHARS = 200_000;

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'done'; result: DecodedText };

/**
 * 文本预览器。
 *
 * - fetch streamUrl → BOM/UTF-8/Shift-JIS 编码检测解码
 * - 工具条：字号 ±（写 settingsStore.preview）、自动换行开关（同上）
 * - 超过 MAX_CHARS 字符截断渲染并提示下载查看全文
 */
export function TextPreview({ file }: PreviewerProps) {
  const fontSize = useSettingsStore((s) => s.preview.textFontSize);
  const wordWrap = useSettingsStore((s) => s.preview.textWordWrap);
  const setPreviewSettings = useSettingsStore((s) => s.setPreview);
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  // 重试计数：递增触发 effect 重新 fetch
  const [attempt, setAttempt] = useState(0);

  // 注：加载态复位不在此 effect 内同步 setState（react-hooks/set-state-in-effect
  // 禁止）；首次挂载初始态即为 loading，文件切换由壳层 key={file.hash} 重挂载
  // 覆盖，重试路径在按钮 handler 内复位。
  useEffect(() => {
    const controller = new AbortController();
    fetch(streamUrl(file.workId, file.hash), { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.arrayBuffer();
      })
      .then((buf) => setState({ status: 'done', result: decodeTextData(buf) }))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setState({
          status: 'error',
          message: err instanceof Error ? err.message : String(err),
        });
      });
    return () => controller.abort();
  }, [file.workId, file.hash, attempt]);

  return (
    <div className='flex h-full min-h-0 flex-col'>
      <M3eCard className='min-h-0'>
        {state.status === 'loading' && (
          <div className='flex min-h-full items-center justify-center'>
            <M3eCircularProgressIndicator />
          </div>
        )}
        {state.status === 'error' && (
          <div className='flex min-h-full flex-col items-center justify-center gap-3 opacity-70'>
            <span>加载失败：{state.message}</span>
            <M3eIconButton
              aria-label='重试'
              onClick={() => {
                setState({ status: 'loading' });
                setAttempt((a) => a + 1);
              }}
            >
              <M3eIcon name='refresh' />
            </M3eIconButton>
          </div>
        )}
        {state.status === 'done' && (
          <div
            className='px-2 my-3 overflow-auto'
            style={{
              fontSize: `${fontSize}px`,
              lineHeight: 1.7,
              whiteSpace: wordWrap ? 'pre-wrap' : 'pre',
              wordBreak: wordWrap ? 'break-word' : 'normal',
            }}
          >
            {state.result.text.slice(0, MAX_CHARS)}
            {state.result.text.length > MAX_CHARS && (
              <span className='mt-4 block text-xs opacity-60'>
                （文件过大，仅显示前 {MAX_CHARS.toLocaleString()}{' '}
                字符，完整内容请下载查看）
              </span>
            )}
          </div>
        )}
      </M3eCard>

      {/* 工具条（卡片外，底部） */}
      <div className='flex flex-none items-center gap-1 pt-2'>
        <M3eIconButton
          aria-label='减小字号'
          disabled={fontSize <= 12}
          onClick={() =>
            setPreviewSettings({ textFontSize: Math.max(12, fontSize - 2) })
          }
        >
          <M3eIcon name='text_decrease' />
        </M3eIconButton>
        <span className='w-10 text-center text-xs tabular-nums opacity-60'>
          {fontSize}px
        </span>
        <M3eIconButton
          aria-label='增大字号'
          disabled={fontSize >= 32}
          onClick={() =>
            setPreviewSettings({ textFontSize: Math.min(32, fontSize + 2) })
          }
        >
          <M3eIcon name='text_increase' />
        </M3eIconButton>
        <M3eIconButton
          aria-label={wordWrap ? '关闭自动换行' : '开启自动换行'}
          onClick={() => setPreviewSettings({ textWordWrap: !wordWrap })}
        >
          <M3eIcon name='wrap_text' />
        </M3eIconButton>
        {state.status === 'done' && (
          <span className='ms-2 text-xs opacity-60'>
            {state.result.encoding}
          </span>
        )}
      </div>
    </div>
  );
}

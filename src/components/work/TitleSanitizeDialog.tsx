import { useState } from 'react';
import { M3eButton } from '@m3e/react/button';
import { M3eDialog, type M3eDialogElement } from '@m3e/react/dialog';
import { M3eFormField } from '@m3e/react/form-field';
import { useSanitizeTitlesMutation } from '../../queries/useMetadataOverrideQuery';
import type { SanitizeTitlesResponse } from '../../types';
import { useM3eStyle } from '../../hooks/useM3eStyle';
import clsx from 'clsx';

interface Props {
  open: boolean;
  /** 处理范围：元数据覆盖页搜索框当前条件（LQL），空 = 全库。只读展示。 */
  q?: string;
  onClose: () => void;
}

/**
 * 标题净化弹窗（入口按钮在元数据覆盖页搜索框旁，见 MetadataOverride）：
 * 正则批量替换 original title（管理员一次性工具）。
 * 范围由 props 只读给定（页面搜索框当前条件），不再手填 LQL。
 * 「预览」先行（before/after + 已覆盖标注），「执行」沿用同一输入、以预览为确认——
 * 命中即净化，覆盖已有 title 覆盖是明确语义，无二次弹窗。
 *
 * 布局同 FilePreviewDialog：弹窗常驻渲染（open 仅作 prop，关闭态不卸载——
 * useM3eStyle 挂载时一次性注入，若条件渲染 ref 为 null 会空跑且不重试），
 * .base 固定高度 + .content flex 撑满，长表格由内置 scroll-container 滚动；
 * onClosed（关闭动画完成后）重置全部本地状态，等效「关闭即卸载」。
 */
export default function TitleSanitizeDialog({ open, q, onClose }: Props) {
  const [pattern, setPattern] = useState('');
  const [replacement, setReplacement] = useState('');
  const sanitize = useSanitizeTitlesMutation();
  // 执行仅在「当前输入与已预览输入一致」时可用（改规则须重新预览）
  const [previewedKey, setPreviewedKey] = useState<string | null>(null);
  // 最近一次预览/执行结果（本地快照：关闭时随本地状态一并清空，重开无残留）
  const [result, setResult] = useState<SanitizeTitlesResponse | null>(null);

  const dialogRef = useM3eStyle<M3eDialogElement>({
    style: {
      '.base': { height: '80dvh' },
      '.content': {
        flex: 1,
        paddingBottom: 'var(--md-sys-measurement-space300, 24px)',
        marginBottom: '0 !important',
      },
    },
  });

  const key = JSON.stringify([pattern, replacement]);
  const canSubmit = pattern.trim() !== '' && !sanitize.isPending;
  const canExecute = canSubmit && previewedKey === key;

  const run = (dryRun: boolean) =>
    sanitize.mutate(
      { pattern, replacement, q: q?.trim() || undefined, dryRun },
      {
        onSuccess: (data) => {
          setResult(data);
          if (dryRun) {
            setPreviewedKey(key);
          } else {
            // 执行成功：mutation 已失效作品缓存并弹完成提示，这里收尾关闭
            setPreviewedKey(null);
            onClose();
          }
        },
      },
    );

  const samples = result?.samples;

  return (
    <div
      className={clsx(
        // 官方 CSS 变量：弹窗尺寸（沿 DOM 继承到面板），同 FilePreviewDialog
        '[--m3e-dialog-min-width:92vw] [--m3e-dialog-max-width:92vw]',
        'lg:[--m3e-dialog-min-width:56vw] lg:[--m3e-dialog-max-width:56vw]',
        '[--m3e-dialog-max-height:80dvh]',
      )}
    >
      <M3eDialog
        ref={dialogRef}
        open={open}
        onClosed={() => {
          onClose();
          setPattern('');
          setReplacement('');
          setPreviewedKey(null);
          setResult(null);
        }}
        dismissible
        closeLabel='关闭'
      >
        <span slot='header'>标题净化（批量正则替换）</span>
        <div className='flex flex-col gap-4'>
          {/* 范围：只读套用页面搜索框当前条件 */}
          <div className='flex flex-col gap-1'>
            <div className='flex items-baseline gap-2 text-sm'>
              <span className='shrink-0 opacity-70'>范围</span>
              {q?.trim() ? (
                <code className='break-all rounded bg-black/5 px-1 py-0.5 font-mono text-xs dark:bg-white/10'>
                  {q}
                </code>
              ) : (
                <span>全库（搜索框当前无条件）</span>
              )}
            </div>
            <p className='m-0 text-xs opacity-60'>
              范围来自上方搜索框当前条件，如需变更请修改搜索后重新打开。
            </p>
          </div>

          <div className='grid gap-3 md:grid-cols-2'>
            <M3eFormField
              variant='outlined'
              className='w-full [--m3e-form-field-width:100%]'
            >
              <label slot='label' htmlFor='sanitize-pattern'>
                正则（JS RegExp，匹配原始标题）
              </label>
              <input
                id='sanitize-pattern'
                type='text'
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                className='w-full border-none bg-transparent py-2 text-sm outline-none'
              />
            </M3eFormField>
            <M3eFormField
              variant='outlined'
              className='w-full [--m3e-form-field-width:100%]'
            >
              <label slot='label' htmlFor='sanitize-replacement'>
                替换为（留空 = 移除）
              </label>
              <input
                id='sanitize-replacement'
                type='text'
                value={replacement}
                onChange={(e) => setReplacement(e.target.value)}
                className='w-full border-none bg-transparent py-2 text-sm outline-none'
              />
            </M3eFormField>
          </div>

          {sanitize.isPending && (
            <div className='py-2 text-sm opacity-60'>处理中…</div>
          )}
          {samples !== undefined && samples.length === 0 && (
            <div className='py-2 text-sm opacity-60'>无匹配作品</div>
          )}
          {samples !== undefined && samples.length > 0 && (
            <div className='overflow-x-auto'>
              <table className='w-full text-sm'>
                <thead>
                  <tr className='text-left opacity-60'>
                    <th className='py-1 pr-3 font-normal'>ID</th>
                    <th className='py-1 pr-3 font-normal'>原标题</th>
                    <th className='py-1 pr-3 font-normal'>净化后</th>
                    <th className='py-1 font-normal' />
                  </tr>
                </thead>
                <tbody>
                  {samples.map((s) => (
                    <tr key={s.id} className='border-t border-current/10'>
                      <td className='py-1 pr-3 font-mono text-xs'>{s.id}</td>
                      <td className='py-1 pr-3 break-all'>{s.before}</td>
                      <td className='py-1 pr-3 break-all'>{s.after}</td>
                      <td className='py-1 text-xs opacity-70'>
                        {s.overridden ? '将覆盖已有 title 覆盖' : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className='mt-1 text-xs opacity-60'>
                将净化 {result?.matched ?? 0} 件（其中 {result?.overridden ?? 0}{' '}
                件已有 title 覆盖，将被覆盖）；预览仅显示前 {samples.length} 条
              </p>
            </div>
          )}
        </div>
        <div slot='actions' className='flex justify-end gap-2'>
          <M3eButton variant='text' onClick={onClose}>
            取消
          </M3eButton>
          <M3eButton
            variant='outlined'
            disabled={!canSubmit}
            onClick={() => run(true)}
          >
            预览
          </M3eButton>
          <M3eButton disabled={!canExecute} onClick={() => run(false)}>
            执行
          </M3eButton>
        </div>
      </M3eDialog>
    </div>
  );
}

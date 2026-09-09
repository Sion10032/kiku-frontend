import { useState } from 'react';
import { M3eButton } from '@m3e/react/button';
import { M3eFormField } from '@m3e/react/form-field';
import { useSanitizeTitlesMutation } from '../../queries/useMetadataOverrideQuery';

/**
 * 标题净化折叠区块：正则批量替换 original title（管理员一次性工具）。
 * 范围 = LQL 条件命中的作品（留空 = 全库；-overridden:title 排除已覆盖标题）。
 * 「预览」先行（before/after + 已覆盖标注），「执行」沿用同一输入、以预览为确认——
 * 命中即净化，覆盖已有 title 覆盖是明确语义，无二次弹窗。
 */
export default function TitleSanitize() {
  const [pattern, setPattern] = useState('');
  const [replacement, setReplacement] = useState('');
  const [q, setQ] = useState('');
  const sanitize = useSanitizeTitlesMutation();
  // 执行仅在「当前输入与已预览输入一致」时可用（改规则须重新预览）
  const [previewedKey, setPreviewedKey] = useState<string | null>(null);

  const key = JSON.stringify([pattern, replacement, q]);
  const canSubmit = pattern.trim() !== '' && !sanitize.isPending;
  const canExecute = canSubmit && previewedKey === key;

  const run = (dryRun: boolean) =>
    sanitize.mutate(
      { pattern, replacement, q: q.trim() || undefined, dryRun },
      { onSuccess: () => setPreviewedKey(dryRun ? key : null) },
    );

  const data = sanitize.data;
  const samples = data?.samples;

  return (
    <details className='mb-4'>
      <summary className='cursor-pointer select-none py-2 text-sm font-medium opacity-80'>
        标题净化（批量正则替换）
      </summary>
      <div className='grid gap-3 py-2'>
        <div className='grid gap-3 md:grid-cols-2'>
          <M3eFormField variant='outlined'>
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
          <M3eFormField variant='outlined'>
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
        <M3eFormField variant='outlined' className='w-full'>
          <label slot='label' htmlFor='sanitize-q'>
            范围（LQL，留空 = 全库；-overridden:title 排除已覆盖标题）
          </label>
          <input
            id='sanitize-q'
            type='text'
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className='w-full border-none bg-transparent py-2 text-sm outline-none'
          />
        </M3eFormField>
        <div className='flex gap-2'>
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
              将净化 {data?.matched ?? 0} 件（其中 {data?.overridden ?? 0}{' '}
              件已有 title 覆盖，将被覆盖）；预览仅显示前 {samples.length} 条
            </p>
          </div>
        )}
      </div>
    </details>
  );
}

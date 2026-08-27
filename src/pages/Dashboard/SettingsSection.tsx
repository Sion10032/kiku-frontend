import { M3eCard } from '@m3e/react/card';
import { M3eFormField } from '@m3e/react/form-field';
import { M3eOption } from '@m3e/react/option';
import { M3eSelect, type M3eSelectElement } from '@m3e/react/select';
import { M3eSwitch } from '@m3e/react/switch';
import type { AdminConfig } from '../../types';
import type { SettingsSectionDef } from './settingsSchema';

/**
 * 单个设置分组卡片。按 FieldDef.type 渲染：
 * number → 数字输入（原始文本期由父组件管理）；text → 文本；bool → Switch；select → 下拉。
 */
export default function SettingsSection({
  section,
  draft,
  numberText,
  onChange,
  onNumberTextChange,
}: {
  section: SettingsSectionDef;
  draft: AdminConfig;
  /** 数字字段输入中的原始文本（避免 Number()||默认值 吞 0，save 前统一解析）。 */
  numberText: Partial<Record<string, string>>;
  onChange: (
    key: SettingsSectionDef['fields'][number]['key'],
    value: unknown,
  ) => void;
  onNumberTextChange: (key: string, text: string) => void;
}) {
  return (
    <M3eCard>
      <div slot='header'>
        <span className='mb-2 block text-sm font-medium'>{section.title}</span>
      </div>
      <div slot='content'>
        <div className='flex flex-col gap-3'>
          {section.fields.map((field) => {
            const id = `setting-${String(field.key)}`;
            if (field.type === 'bool') {
              return (
                <label
                  key={field.key}
                  htmlFor={id}
                  className='flex items-center justify-between gap-4 py-1 text-sm'
                >
                  <span>{field.label}</span>
                  <M3eSwitch
                    id={id}
                    checked={!!draft[field.key]}
                    onInput={(e) => {
                      const on = (e.target as HTMLInputElement).checked;
                      onChange(field.key, on);
                    }}
                  />
                </label>
              );
            }
            if (field.type === 'select') {
              return (
                <M3eFormField
                  key={field.key}
                  variant='outlined'
                  hideSubscript='always'
                >
                  <label slot='label' htmlFor={id}>
                    {field.label}
                  </label>
                  <M3eSelect
                    id={id}
                    onChange={(e) =>
                      onChange(
                        field.key,
                        String((e.target as M3eSelectElement).value ?? ''),
                      )
                    }
                  >
                    {field.options.map((opt) => (
                      <M3eOption
                        key={opt.value}
                        value={opt.value}
                        selected={opt.value === draft[field.key]}
                      >
                        {opt.label}
                      </M3eOption>
                    ))}
                  </M3eSelect>
                </M3eFormField>
              );
            }
            if (field.type === 'number') {
              return (
                <M3eFormField
                  key={field.key}
                  variant='outlined'
                  hideSubscript='always'
                >
                  <label slot='label' htmlFor={id}>
                    {field.label}
                  </label>
                  <input
                    id={id}
                    type='number'
                    inputMode='numeric'
                    min={field.min}
                    max={field.max}
                    placeholder={
                      field.placeholder !== undefined
                        ? String(field.placeholder)
                        : undefined
                    }
                    value={
                      numberText[field.key] ?? String(draft[field.key] ?? '')
                    }
                    onChange={(e) =>
                      onNumberTextChange(field.key, e.target.value)
                    }
                    className='w-full border-none bg-transparent py-2 text-sm outline-none'
                  />
                </M3eFormField>
              );
            }
            return (
              <M3eFormField
                key={field.key}
                variant='outlined'
                hideSubscript='always'
              >
                <label slot='label' htmlFor={id}>
                  {field.label}
                </label>
                <input
                  id={id}
                  value={String(draft[field.key] ?? '')}
                  placeholder={
                    'placeholder' in field ? field.placeholder : undefined
                  }
                  onChange={(e) => onChange(field.key, e.target.value)}
                  className='w-full border-none bg-transparent py-2 text-sm outline-none'
                />
              </M3eFormField>
            );
          })}
        </div>
      </div>
    </M3eCard>
  );
}

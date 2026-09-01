import { M3eCard } from '@m3e/react/card';
import type { AdminConfig } from '../../types';
import type { SettingsSectionDef } from './settingsSchema';
import {
  InputRow,
  SegmentedRow,
  SwitchRow,
} from '../../components/dashboard/SettingRows';

/**
 * 单个设置分组：标题在卡片外（h2，层级风格同本地设置页 h1 降级），
 * 卡片内容按 FieldDef.type 渲染行：
 * bool → SwitchRow；select → SegmentedRow；number/text → InputRow
 * （number 的原始文本期由父组件管理，save 前统一解析）。
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
    <>
      <h2 className='m-0 text-lg font-normal'>{section.title}</h2>
      <M3eCard>
        <div slot='content' className='flex flex-col gap-6'>
          {section.fields.map((field) => {
            const id = `setting-${String(field.key)}`;
            if (field.type === 'bool') {
              return (
                <SwitchRow
                  key={field.key}
                  id={id}
                  label={field.label}
                  description={field.description}
                  checked={!!draft[field.key]}
                  onChecked={(on) => onChange(field.key, on)}
                />
              );
            }
            if (field.type === 'select') {
              return (
                <SegmentedRow
                  key={field.key}
                  label={field.label}
                  description={field.description}
                  options={field.options}
                  value={String(draft[field.key] ?? '')}
                  onChange={(value) => onChange(field.key, value)}
                />
              );
            }
            if (field.type === 'number') {
              return (
                <InputRow
                  key={field.key}
                  id={id}
                  label={field.label}
                  description={field.description}
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
                  onChange={(text) => onNumberTextChange(field.key, text)}
                />
              );
            }
            return (
              <InputRow
                key={field.key}
                id={id}
                label={field.label}
                description={field.description}
                placeholder={
                  'placeholder' in field ? field.placeholder : undefined
                }
                widthClassName='sm:w-72'
                value={String(draft[field.key] ?? '')}
                onChange={(value) => onChange(field.key, value)}
              />
            );
          })}
        </div>
      </M3eCard>
    </>
  );
}

import { M3eFormField } from '@m3e/react/form-field';
import {
  M3eButtonSegment,
  M3eSegmentedButton,
} from '@m3e/react/segmented-button';
import { M3eSwitch } from '@m3e/react/switch';
import { SETTING_CONTROL_FILL, SETTING_ROW_LAYOUT } from '../../constants';

/**
 * 设置行组件族：与本地设置页（pages/Settings.tsx）行风格一致的布局单元。
 * 行结构：窄屏「标签上 / 控件下」，≥sm「标签左 / 控件右」。
 */

/** 行左侧标签列：标题 + 可选灰色说明（text-sm opacity-70，同本地设置）。 */
function RowLabel({
  label,
  description,
}: {
  label: string;
  description?: string;
}) {
  return (
    <span className='flex flex-col'>
      <span>{label}</span>
      {description && <span className='text-sm opacity-70'>{description}</span>}
    </span>
  );
}

/** 开关行：<label htmlFor> 包裹（点击标题可切换，语义优于本地设置的纯 div）。 */
export function SwitchRow({
  id,
  label,
  description,
  checked,
  onChecked,
}: {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChecked: (on: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className='flex cursor-pointer items-center justify-between gap-4'
    >
      <RowLabel label={label} description={description} />
      <M3eSwitch
        id={id}
        checked={checked}
        onInput={(e) => onChecked((e.target as HTMLInputElement).checked)}
      />
    </label>
  );
}

/** 选项行：右侧 M3eSegmentedButton；组的 value 是 getter-only，受控靠每段 checked。 */
export function SegmentedRow({
  label,
  description,
  options,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className={SETTING_ROW_LAYOUT}>
      <RowLabel label={label} description={description} />
      <M3eSegmentedButton
        className={SETTING_CONTROL_FILL}
        onInput={(e) => onChange((e.target as HTMLInputElement).value)}
      >
        {options.map((opt) => (
          <M3eButtonSegment
            key={opt.value}
            value={opt.value}
            checked={opt.value === value}
          >
            {opt.label}
          </M3eButtonSegment>
        ))}
      </M3eSegmentedButton>
    </div>
  );
}

/** 输入行：右侧固定宽 outlined 输入框（可见标签在左侧，input 用 aria-label）。 */
export function InputRow({
  id,
  label,
  description,
  value,
  onChange,
  type = 'text',
  inputMode,
  min,
  max,
  placeholder,
  widthClassName = 'sm:w-56',
}: {
  id: string;
  label: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  inputMode?: 'numeric';
  min?: number;
  max?: number;
  placeholder?: string;
  widthClassName?: string;
}) {
  return (
    <div className={SETTING_ROW_LAYOUT}>
      <RowLabel label={label} description={description} />
      <M3eFormField
        variant='outlined'
        hideSubscript='always'
        className={`w-full ${widthClassName} [--m3e-form-field-width:100%]`}
      >
        <input
          id={id}
          type={type}
          inputMode={inputMode}
          min={min}
          max={max}
          aria-label={label}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className='w-full border-none bg-transparent py-2 text-sm outline-none'
        />
      </M3eFormField>
    </div>
  );
}

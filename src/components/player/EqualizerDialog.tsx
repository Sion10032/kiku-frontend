import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { M3eButton } from '@m3e/react/button';
import { M3eDialog } from '@m3e/react/dialog';
import { M3eFormField } from '@m3e/react/form-field';
import { M3eOption } from '@m3e/react/option';
import { M3eSelect, type M3eSelectElement } from '@m3e/react/select';
import { M3eSlider, M3eSliderThumb } from '@m3e/react/slider';
import type { M3eSliderThumbElement } from '@m3e/react/slider';
import { M3eSwitch } from '@m3e/react/switch';
import { useSettingsStore } from '../../stores/settingsStore';
import {
  BUILTIN_PRESETS,
  EQ_BANDS,
  EQ_CUSTOM_PRESET_LIMIT,
  EQ_GAIN_MAX,
  EQ_GAIN_MIN,
  EQ_GAIN_STEP,
  EQ_PRESET_NAME_MAX,
  EQ_Q_MAX,
  EQ_Q_MIN,
  EQ_Q_STEP,
  quantizeQ,
} from '../../utils/equalizer';

/** 内置 preset 显示名 i18n key（preset.name 只是中文兜底，自定义项直接显示 name）。 */
type BuiltinNameKey =
  | 'player.eq-preset-flat'
  | 'player.eq-preset-bass-boost'
  | 'player.eq-preset-vocal'
  | 'player.eq-preset-treble-boost'
  | 'player.eq-preset-soft';

const BUILTIN_NAME_KEY: Record<string, BuiltinNameKey | undefined> = {
  flat: 'player.eq-preset-flat',
  'bass-boost': 'player.eq-preset-bass-boost',
  vocal: 'player.eq-preset-vocal',
  'treble-boost': 'player.eq-preset-treble-boost',
  soft: 'player.eq-preset-soft',
};

/** 增益显示：正值带 +，负零归零，固定一位小数（-0.toFixed(1) 本就是 0.0）。 */
function formatGain(db: number): string {
  const value = db === 0 ? 0 : db;
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}`;
}

/** 频段标签：≥1kHz 折成 1k / 16k 形式，其余原样。 */
function formatBand(freq: number): string {
  return freq >= 1000 ? `${freq / 1000}k` : String(freq);
}

/**
 * 均衡器对话框：预置行（内置 / 自定义 / 新增 / 删除）+ 10 段竖排增益滑条
 * （每段上方常驻当前 dB，下方频率标签）+ 中间 8 段 Q 输入 + 底部总开关。
 *
 * - 内置 preset 只读：拖滑条只改运行态（store 的写回逻辑跳过内置项），
 *   选中的是自定义项时 store 自动把改动写回该 preset
 * - 关闭开关时面板内容淡化且控件 disabled（开关自身保持可用）
 * - 新增走内嵌命名对话框（名称 ≤ EQ_PRESET_NAME_MAX，满上限时新增禁用）
 */
export default function EqualizerDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const equalizer = useSettingsStore((s) => s.equalizer);
  const gains = useSettingsStore((s) => s.eqCurrent.gains);
  const qs = useSettingsStore((s) => s.eqCurrent.qs);
  const setEqualizerEnabled = useSettingsStore((s) => s.setEqualizerEnabled);
  const selectEqualizerPreset = useSettingsStore(
    (s) => s.selectEqualizerPreset,
  );
  const updateEqualizerBand = useSettingsStore((s) => s.updateEqualizerBand);
  const deleteEqualizerCustomPreset = useSettingsStore(
    (s) => s.deleteEqualizerCustomPreset,
  );
  const [addOpen, setAddOpen] = useState(false);

  const { enabled, activeId, customPresets } = equalizer;
  const hasCustom = customPresets.length > 0;
  const activeIsCustom = customPresets.some((p) => p.id === activeId);
  const atLimit = customPresets.length >= EQ_CUSTOM_PRESET_LIMIT;

  /** select.value 为 getter-only，经事件读取（同 Settings 备份区） */
  function handlePresetChange(e: Event) {
    const value = (e.target as M3eSelectElement).value;
    if (typeof value === 'string' && value) selectEqualizerPreset(value);
  }

  /** 拖动某段滑条：量化 / 越界 / 写回规则都在 store，UI 只转发 */
  function handleBandInput(index: number, e: Event) {
    const value = (e.target as M3eSliderThumbElement).value;
    if (typeof value === 'number') updateEqualizerBand(index, value);
  }

  function handleEnabledInput(e: Event) {
    setEqualizerEnabled((e.target as HTMLInputElement).checked);
  }

  /** 下拉选项：内置在前、自定义在后，两组间插不可选的分隔项 */
  const presetOptions = [
    ...(hasCustom
      ? [
          <M3eOption key='divider-builtin' value='' disabled>
            {`—— ${t('player.eq-group-builtin')} ——`}
          </M3eOption>,
        ]
      : []),
    ...BUILTIN_PRESETS.map((preset) => {
      const nameKey = BUILTIN_NAME_KEY[preset.id];
      return (
        <M3eOption
          key={preset.id}
          value={preset.id}
          selected={preset.id === activeId}
        >
          {nameKey ? t(nameKey) : preset.name}
        </M3eOption>
      );
    }),
    ...(hasCustom
      ? [
          <M3eOption key='divider-custom' value='' disabled>
            {`—— ${t('player.eq-group-custom')} ——`}
          </M3eOption>,
          ...customPresets.map((preset) => (
            <M3eOption
              key={preset.id}
              value={preset.id}
              selected={preset.id === activeId}
            >
              {preset.name}
            </M3eOption>
          )),
        ]
      : []),
  ];

  return (
    <>
      {/* m3e-dialog 默认 max-width 560px 会溢出窄屏，clamp 到视口内（同 QueueDialog） */}
      <M3eDialog
        open={open}
        onClosed={onClose}
        dismissible
        closeLabel={t('common.close')}
        className='[--m3e-dialog-max-width:min(640px,calc(100vw-2rem))] [--m3e-dialog-min-width:min(280px,calc(100vw-2rem))]'
      >
        <span slot='header'>{t('player.eq-title')}</span>

        {/* 关闭时整块淡化；控件各自 disabled */}
        <div
          className={clsx('flex flex-col gap-4 py-1', !enabled && 'opacity-60')}
        >
          {/* 预置行：选择 + 新增 / 删除 */}
          <div className='flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between'>
            <M3eFormField
              variant='outlined'
              hideSubscript='always'
              className='w-full sm:w-auto [--m3e-form-field-width:12rem]'
            >
              <label slot='label' htmlFor='eq-preset'>
                {t('player.eq-preset-label')}
              </label>
              <M3eSelect
                id='eq-preset'
                disabled={!enabled}
                onChange={handlePresetChange}
              >
                {presetOptions}
              </M3eSelect>
            </M3eFormField>
            <div className='flex shrink-0 gap-2'>
              <M3eButton
                variant='filled'
                aria-label={t('player.eq-add')}
                disabled={!enabled || atLimit}
                onClick={() => setAddOpen(true)}
              >
                {`＋ ${t('player.eq-add')}`}
              </M3eButton>
              <M3eButton
                variant='text'
                className='text-[var(--md-sys-color-error)]'
                aria-label={t('player.eq-delete')}
                disabled={!enabled || !activeIsCustom}
                onClick={() => deleteEqualizerCustomPreset(activeId)}
              >
                {`🗑 ${t('player.eq-delete')}`}
              </M3eButton>
            </div>
          </div>

          {atLimit && (
            <p className='m-0 text-xs opacity-70'>
              {t('player.eq-limit', { n: EQ_CUSTOM_PRESET_LIMIT })}
            </p>
          )}

          {/* 滑条区：窄屏横向滚动，10 段列宽固定不压缩 */}
          <div className='overflow-x-auto'>
            <div className='flex justify-between gap-1'>
              {EQ_BANDS.map((band, index) => (
                <div
                  key={band}
                  className='flex w-11 shrink-0 flex-col items-center gap-1'
                >
                  <span className='text-xs tabular-nums'>
                    {formatGain(gains[index])}
                  </span>
                  {/* 竖排滑条的高度来自 min-block-size（默认 200px 太高） */}
                  <M3eSlider
                    id={`eq-band-${index}`}
                    orientation='vertical'
                    size='small'
                    aria-label={`${formatBand(band)} Hz`}
                    min={EQ_GAIN_MIN}
                    max={EQ_GAIN_MAX}
                    step={EQ_GAIN_STEP}
                    disabled={!enabled}
                    onInput={(e) => handleBandInput(index, e)}
                    className='h-32 [--m3e-slider-min-width:8rem]'
                  >
                    <M3eSliderThumb value={gains[index]} />
                  </M3eSlider>
                  <span className='text-[0.625rem] tabular-nums opacity-70'>
                    {formatBand(band)}
                  </span>
                  {index > 0 && index < EQ_BANDS.length - 1 ? (
                    <QInput
                      band={index}
                      value={qs[index]}
                      disabled={!enabled}
                    />
                  ) : (
                    // 首尾走 shelf（恒默认 Q），留白对齐
                    <div className='h-7' aria-hidden='true' />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 总开关：不随面板淡化，关闭态也可操作 */}
        <div className='mt-4 flex items-center justify-between gap-4'>
          <span id='eq-enabled-label'>{t('player.eq-enabled')}</span>
          <M3eSwitch
            checked={enabled}
            aria-labelledby='eq-enabled-label'
            onInput={handleEnabledInput}
          />
        </div>
      </M3eDialog>

      <AddPresetDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  );
}

/**
 * 单段 Q 输入：编辑期间用本地草稿，失焦时才提交（草稿为 null 时直接显示 store 值）。
 * 非法 / 空输入回落原值；合法值 clamp + 量化后回写（8.5 → 8）。
 */
function QInput({
  band,
  value,
  disabled,
}: {
  band: number;
  value: number;
  disabled: boolean;
}) {
  const updateEqualizerQ = useSettingsStore((s) => s.updateEqualizerQ);
  // null = 未编辑，显示值直接来自 store（切换 preset 后自动跟随）
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? String(value);

  function commit() {
    const raw = Number(shown);
    setDraft(null);
    if (!shown.trim() || !Number.isFinite(raw)) return;
    updateEqualizerQ(band, quantizeQ(raw));
  }

  return (
    <input
      type='number'
      inputMode='decimal'
      aria-label={`Q ${formatBand(EQ_BANDS[band])}`}
      min={EQ_Q_MIN}
      max={EQ_Q_MAX}
      step={EQ_Q_STEP}
      disabled={disabled}
      value={shown}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      className='w-11 rounded border border-(--md-sys-color-outline-variant) bg-transparent py-0.5 text-center text-xs tabular-nums outline-none disabled:opacity-60'
    />
  );
}

/**
 * 新增自定义 preset 的命名对话框（常驻挂载 + open 控制，同 Settings 备份区）：
 * 名称去空白后为空则保存禁用，超长截断交给 store（maxLength 已限输入）。
 */
function AddPresetDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const addEqualizerCustomPreset = useSettingsStore(
    (s) => s.addEqualizerCustomPreset,
  );
  const [name, setName] = useState('');

  /** 关闭即清空草稿，下次打开从空名开始（不用 effect 里的 setState） */
  function close() {
    setName('');
    onClose();
  }

  function onSave() {
    // store 返回新 id（名称空 / 已达上限时返回空串）
    if (addEqualizerCustomPreset(name)) close();
  }

  return (
    <M3eDialog
      open={open}
      onClosed={close}
      dismissible
      closeLabel={t('player.eq-cancel')}
    >
      <span slot='header'>{t('player.eq-add-title')}</span>
      <div className='flex flex-col gap-4 py-2'>
        <M3eFormField variant='outlined' className='w-full'>
          <label slot='label' htmlFor='eq-preset-name'>
            {t('player.eq-name-label')}
          </label>
          <input
            id='eq-preset-name'
            type='text'
            maxLength={EQ_PRESET_NAME_MAX}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className='w-full border-none bg-transparent py-2 text-sm outline-none'
          />
        </M3eFormField>
      </div>
      <div slot='actions' className='flex justify-end gap-2'>
        <M3eButton variant='text' onClick={close}>
          {t('player.eq-cancel')}
        </M3eButton>
        <M3eButton variant='filled' disabled={!name.trim()} onClick={onSave}>
          {t('player.eq-save')}
        </M3eButton>
      </div>
    </M3eDialog>
  );
}

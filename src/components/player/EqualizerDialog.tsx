import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { M3eButton } from '@m3e/react/button';
import { M3eDialog } from '@m3e/react/dialog';
import { M3eFormField } from '@m3e/react/form-field';
import { M3eIcon } from '@m3e/react/icon';
import { M3eIconButton } from '@m3e/react/icon-button';
import '@m3e/icons/outlined/add';
import '@m3e/icons/outlined/delete';
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
} from '../../utils/equalizer';

/** 触摸手势方向判定死区（px）：小于它不判定方向，避免误判抖动 */
const BAND_DRAG_DEAD_ZONE = 8;

/** 横向占优的判定偏置：|dx| 需超过 |dy| 的这个倍数才算滑动（纵向优先） */
const BAND_DRAG_HORIZONTAL_BIAS = 1.2;

/**
 * 一轮落在滑条上的触摸手势。
 * 触摸由我们全权处理（M3E 滑条一按下就跳值、还会吃掉横向手势），鼠标不介入。
 */
type BandDrag = {
  pointerId: number;
  /** 频段下标（来自 data-eq-fader） */
  band: number;
  /** 该段滑条的外框，高度即轨道长，用来把 clientY 映射成增益 */
  fader: HTMLElement;
  startX: number;
  startY: number;
  startScroll: number;
  /** pending = 方向未定；scroll = 横向滚动；value = 调增益 */
  mode: 'pending' | 'scroll' | 'value';
};

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

/** 增益显示：正值带 +，固定一位小数（-0 由 toFixed 归一成 "0.0"）。 */
function formatGain(db: number): string {
  return `${db > 0 ? '+' : ''}${db.toFixed(1)}`;
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
  const bandScrollRef = useRef<HTMLDivElement>(null);
  const bandDragRef = useRef<BandDrag | null>(null);

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

  /**
   * 落在滑条上的触摸手势由我们全权处理（M3E 的触摸带是 touch-action: none，
   * 浏览器不会滚动容器；而且滑条一按下就跳值）。
   *
   * - 先拦下 pointerdown，不交给滑条（否则值会立刻跳到手指位置）
   * - 方向判定：横向 → 接管指针并滚动滑条区；纵向/轻点 → 按 clientY 自己算增益
   * - 鼠标不介入，交还 M3E 原生行为（桌面端靠滚轮横向滚动）
   */
  function handleBandPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === 'mouse') return;
    const fader = (e.target as HTMLElement | null)?.closest<HTMLElement>(
      '[data-eq-fader]',
    );
    const el = bandScrollRef.current;
    if (!fader || !el) return;
    const band = Number(fader.dataset.eqFader);
    if (!Number.isInteger(band)) return;
    bandDragRef.current = {
      pointerId: e.pointerId,
      band,
      fader,
      startX: e.clientX,
      startY: e.clientY,
      startScroll: el.scrollLeft,
      mode: 'pending',
    };
    // 立即捕获指针：手指拖出滑条/容器后仍能继续跟手与收尾（否则会卡住不动的拖拽）
    el.setPointerCapture?.(e.pointerId);
    // 不让滑条看到这次 pointerdown，否则它会立刻跳值
    e.stopPropagation();
  }

  function handleBandPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const drag = bandDragRef.current;
    const el = bandScrollRef.current;
    if (!drag || !el || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;

    if (drag.mode === 'pending') {
      // 死区：位移不足时不动，避免误判抖动
      if (
        Math.abs(dx) < BAND_DRAG_DEAD_ZONE
        && Math.abs(dy) < BAND_DRAG_DEAD_ZONE
      )
        return;
      // 纵向优先（滑条意图更明确），只有明显偏横向才抢来滚动
      drag.mode =
        Math.abs(dx) <= Math.abs(dy) * BAND_DRAG_HORIZONTAL_BIAS
          ? 'value'
          : 'scroll';
    }

    e.stopPropagation();
    if (drag.mode === 'scroll') {
      el.scrollLeft = drag.startScroll - dx;
      return;
    }
    applyBandFromPointer(drag, e.clientY);
  }

  function handleBandPointerEnd(e: React.PointerEvent<HTMLDivElement>) {
    const drag = bandDragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    // 轻点（方向未判定）才给值：保留「点哪跳哪」；被系统打断（pointercancel）则不动值
    if (drag.mode === 'pending' && e.type !== 'pointercancel')
      applyBandFromPointer(drag, e.clientY);
    bandDragRef.current = null;
  }

  /** 把手指的竖向位置映射成该段增益（比例 → 增益 → store 量化/夹取） */
  function applyBandFromPointer(drag: BandDrag, clientY: number) {
    if (!enabled) return; // 关闭态只允许滚动，不允许改值
    const rect = drag.fader.getBoundingClientRect();
    if (rect.height <= 0) return;
    const ratio = 1 - (clientY - rect.top) / rect.height;
    const clamped = Math.min(1, Math.max(0, ratio));
    updateEqualizerBand(
      drag.band,
      EQ_GAIN_MIN + clamped * (EQ_GAIN_MAX - EQ_GAIN_MIN),
    );
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
          <div className='flex flex-row gap-2 items-center'>
            <M3eFormField
              variant='outlined'
              hideSubscript='always'
              className='w-full density-3'
            >
              <M3eSelect
                id='eq-preset'
                aria-label={t('player.eq-preset-label')}
                disabled={!enabled}
                onChange={handlePresetChange}
              >
                {presetOptions}
              </M3eSelect>
            </M3eFormField>
            <div className='flex shrink-0 items-center gap-1'>
              <M3eIconButton
                variant='filled'
                aria-label={t('player.eq-add')}
                disabled={!enabled || atLimit}
                onClick={() => setAddOpen(true)}
              >
                <M3eIcon name='add' />
              </M3eIconButton>
              <M3eIconButton
                variant='tonal'
                aria-label={t('player.eq-delete')}
                disabled={!enabled || !activeIsCustom}
                onClick={() => deleteEqualizerCustomPreset(activeId)}
              >
                {/* 颜色落在图标上：m3e-icon 的 svg 用 fill: currentColor，
                    比宿主 color 更可靠（宿主的图标色由 variant token 控制） */}
                <M3eIcon
                  name='delete'
                  className='text-(--md-sys-color-error)'
                />
              </M3eIconButton>
            </div>
          </div>

          {atLimit && (
            <p className='m-0 text-xs opacity-70'>
              {t('player.eq-limit', { n: EQ_CUSTOM_PRESET_LIMIT })}
            </p>
          )}

          {/* 滑条区：窄屏横向滚动，10 段列宽固定不压缩 */}
          <div
            ref={bandScrollRef}
            data-eq-bands
            className='overflow-x-auto pb-2'
            onPointerDownCapture={handleBandPointerDown}
            onPointerMoveCapture={handleBandPointerMove}
            onPointerUpCapture={handleBandPointerEnd}
            onPointerCancelCapture={handleBandPointerEnd}
          >
            <div className='flex justify-between gap-1'>
              {EQ_BANDS.map((band, index) => (
                <div
                  key={band}
                  className='flex w-11 shrink-0 flex-col items-center gap-1'
                >
                  <span className='text-xs tabular-nums'>
                    {formatGain(gains[index])}
                  </span>
                  {/* data-eq-fader：触摸手势仲裁要知道落在哪一段上（值是频段下标） */}
                  <div data-eq-fader={index} className='flex justify-center'>
                    {/* 高度取库默认 min-block-size（200px）；轨道宽由 extra-small 决定（16px） */}
                    <M3eSlider
                      id={`eq-band-${index}`}
                      orientation='vertical'
                      size='extra-small'
                      aria-label={`${formatBand(band)} Hz`}
                      min={EQ_GAIN_MIN}
                      max={EQ_GAIN_MAX}
                      step={EQ_GAIN_STEP}
                      disabled={!enabled}
                      onInput={(e) => handleBandInput(index, e)}
                    >
                      <M3eSliderThumb value={gains[index]} />
                    </M3eSlider>
                  </div>
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
                    // 首尾走 shelf（恒默认 Q），占位对齐输入框高度
                    <div className='h-6' aria-hidden='true' />
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
    // 量化/夹取由 store 负责，UI 只转交
    updateEqualizerQ(band, raw);
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
      className={clsx(
        // MD3 outlined 字段的紧凑版：透明底 + 四面 1px 描边 + 四角 4px 圆角
        'h-6 w-10 rounded-sm border border-solid border-(--md-sys-color-on-surface-variant)',
        'bg-transparent py-0 text-center text-[0.6875rem] tabular-nums',
        'outline-none transition-colors hover:border-(--md-sys-color-on-surface)',
        // 1px 边框 + 内阴影 1px 叠成 2px 主色描边，避免 focus 时尺寸跳动
        'focus:border-(--md-sys-color-primary) focus:shadow-[inset_0_0_0_1px_var(--md-sys-color-primary)]',
        'disabled:opacity-60',
        // 抹掉 number 的原生增减按钮（Chrome/Safari/Firefox）
        '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
      )}
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

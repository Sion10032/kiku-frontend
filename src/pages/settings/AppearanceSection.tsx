import i18next from 'i18next';
import { useTranslation } from 'react-i18next';
import { M3eSelect, type M3eSelectElement } from '@m3e/react/select';
import { M3eOption } from '@m3e/react/option';
import {
  M3eSegmentedButton,
  M3eButtonSegment,
} from '@m3e/react/segmented-button';
import { M3eSlider, M3eSliderThumb } from '@m3e/react/slider';
import type { M3eSliderThumbElement } from '@m3e/react/slider';
import { M3eSwitch } from '@m3e/react/switch';
import { SETTING_CONTROL_FILL, SETTING_ROW_LAYOUT } from '../../constants';
import { setLanguage, type Locale } from '../../i18n';
import { withThemeTransition } from '../../utils/theme';
import {
  useSettingsStore,
  type ColorMode,
  type ContentWidth,
} from '../../stores/settingsStore';
import { useThemeStore, DEFAULT_SEED } from '../../stores/themeStore';

const COLOR_MODES: {
  value: ColorMode;
  label: `settings.color-mode-${ColorMode}`;
}[] = [
  { value: 'auto', label: 'settings.color-mode-auto' },
  { value: 'light', label: 'settings.color-mode-light' },
  { value: 'dark', label: 'settings.color-mode-dark' },
];

const CONTENT_WIDTHS: {
  value: ContentWidth;
  label: `settings.content-width-${ContentWidth}`;
}[] = [
  { value: 'standard', label: 'settings.content-width-standard' },
  { value: 'wide', label: 'settings.content-width-wide' },
  { value: 'ultra', label: 'settings.content-width-ultra' },
  { value: 'full', label: 'settings.content-width-full' },
];

/**
 * 「外观」分组行：语言 / 颜色模式 / 界面大小 / 内容宽度 / 动态取色。
 * 只渲染行，卡片见 pages/Settings.tsx。
 */
export default function AppearanceSection() {
  const { t } = useTranslation();
  const dynamicColor = useSettingsStore((s) => s.dynamicColor);
  const colorMode = useSettingsStore((s) => s.colorMode);
  const setDynamicColor = useSettingsStore((s) => s.setDynamicColor);
  const setColorMode = useSettingsStore((s) => s.setColorMode);
  const uiScale = useSettingsStore((s) => s.uiScale);
  const setUiScale = useSettingsStore((s) => s.setUiScale);
  const contentWidth = useSettingsStore((s) => s.contentWidth);
  const setContentWidth = useSettingsStore((s) => s.setContentWidth);

  // select.value 为 getter-only，经事件读取（同下方备份配置选择）
  function onLanguageChange(e: Event) {
    const value = (e.target as M3eSelectElement).value;
    if (typeof value === 'string') setLanguage(value as Locale);
  }

  return (
    <>
      {/* 语言 */}
      <div className={SETTING_ROW_LAYOUT}>
        <span className='flex flex-col'>
          <span>{t('settings.language')}</span>
          <span className='text-sm opacity-70'>
            {t('settings.language-desc')}
          </span>
        </span>
        <M3eSelect className={SETTING_CONTROL_FILL} onChange={onLanguageChange}>
          {/* 选项文案为语言自称，不随界面语言翻译 */}
          <M3eOption value='zh-CN' selected={i18next.language === 'zh-CN'}>
            简体中文
          </M3eOption>
          <M3eOption value='en' selected={i18next.language === 'en'}>
            English
          </M3eOption>
        </M3eSelect>
      </div>

      {/* 颜色模式：窄屏时标签与分段按钮上下堆叠，避免横向溢出 */}
      <div className={SETTING_ROW_LAYOUT}>
        <span>{t('settings.color-mode')}</span>
        {/* 注意：组的 value 是 getter-only 派生属性（同 radio-group），
            受控方式是给每个 M3eButtonSegment 传 checked */}
        <M3eSegmentedButton
          className={SETTING_CONTROL_FILL}
          onInput={(e) => {
            // 主题切换全页交叉淡化（View Transitions，不支持时退化为跳变）
            withThemeTransition(() =>
              setColorMode((e.target as HTMLInputElement).value as ColorMode),
            );
          }}
        >
          {COLOR_MODES.map((m) => (
            <M3eButtonSegment
              key={m.value}
              value={m.value}
              checked={colorMode === m.value}
            >
              {t(m.label)}
            </M3eButtonSegment>
          ))}
        </M3eSegmentedButton>
      </div>

      {/* 界面大小：rem 尺寸体系，改 html font-size 全屏等比缩放；
          自动仅在首次使用时按屏幕像素密度推断一次 */}
      <div className='flex flex-col gap-2'>
        <div className='flex items-center justify-between gap-4'>
          <span className='flex flex-col'>
            <span>{t('settings.ui-scale')}</span>
          </span>
          <span className='shrink-0 text-sm tabular-nums opacity-70'>
            {uiScale}%
          </span>
        </div>
        <M3eSlider
          min={80}
          max={130}
          step={5}
          labelled
          onInput={(e) =>
            setUiScale((e.target as M3eSliderThumbElement).value ?? 100)
          }
        >
          <M3eSliderThumb value={uiScale} />
        </M3eSlider>
      </div>

      {/* 内容宽度：内容页容器上限档位（PageContainer 按档位映射 max-w） */}
      <div className={SETTING_ROW_LAYOUT}>
        <span className='flex flex-col'>
          <span>{t('settings.content-width')}</span>
          <span className='text-sm opacity-70'>
            {t('settings.content-width-desc')}
          </span>
        </span>
        <M3eSegmentedButton
          className={SETTING_CONTROL_FILL}
          onInput={(e) =>
            setContentWidth(
              (e.target as HTMLInputElement).value as ContentWidth,
            )
          }
        >
          {CONTENT_WIDTHS.map((w) => (
            <M3eButtonSegment
              key={w.value}
              value={w.value}
              checked={contentWidth === w.value}
            >
              {t(w.label)}
            </M3eButtonSegment>
          ))}
        </M3eSegmentedButton>
      </div>

      {/* 动态取色 */}
      <div className='flex cursor-pointer items-center justify-between gap-4'>
        <span className='flex flex-col'>
          <span>{t('settings.dynamic-color')}</span>
          <span className='text-sm opacity-70'>
            {t('settings.dynamic-color-desc')}
          </span>
        </span>
        <M3eSwitch
          checked={dynamicColor}
          onInput={(e) => {
            const on = (e.target as HTMLInputElement).checked;
            setDynamicColor(on);
            // 关闭瞬间回归默认紫，避免停留在最后一次取色结果
            if (!on) useThemeStore.getState().setSeed(DEFAULT_SEED);
          }}
        />
      </div>
    </>
  );
}

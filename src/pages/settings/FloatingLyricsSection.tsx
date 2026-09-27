import { useTranslation } from 'react-i18next';
import {
  M3eSegmentedButton,
  M3eButtonSegment,
} from '@m3e/react/segmented-button';
import { M3eSlider, M3eSliderThumb } from '@m3e/react/slider';
import type { M3eSliderThumbElement } from '@m3e/react/slider';
import { M3eSwitch } from '@m3e/react/switch';
import { SETTING_CONTROL_FILL, SETTING_ROW_LAYOUT } from '../../constants';
import { useSettingsStore } from '../../stores/settingsStore';

const LYRIC_LINE_COUNTS = [1, 2, 3];

/**
 * 悬浮歌词卡片行：显示开关（即卡片首行）/ 字体大小 / 行数上限 / 背景透明度。
 * 只渲染行，卡片见 pages/Settings.tsx。
 */
export default function FloatingLyricsSection() {
  const { t } = useTranslation();
  const floatingLyrics = useSettingsStore((s) => s.floatingLyrics);
  const setFloatingLyrics = useSettingsStore((s) => s.setFloatingLyrics);

  return (
    <>
      <div className='flex cursor-pointer items-center justify-between gap-4'>
        <span className='flex flex-col'>
          <span>{t('settings.floating-lyrics')}</span>
          <span className='text-sm opacity-70'>
            {t('settings.floating-lyrics-desc')}
          </span>
        </span>
        <M3eSwitch
          checked={floatingLyrics.enabled}
          onInput={(e) =>
            setFloatingLyrics({
              enabled: (e.target as HTMLInputElement).checked,
            })
          }
        />
      </div>

      {/* 字体大小 */}
      <div className='flex flex-col gap-2'>
        <div className='flex items-center justify-between gap-4'>
          <span className={floatingLyrics.enabled ? '' : 'opacity-50'}>
            {t('settings.font-size')}
          </span>
          <span className='text-sm tabular-nums opacity-70'>
            {floatingLyrics.fontSize} px
          </span>
        </div>
        <M3eSlider
          min={12}
          max={24}
          step={1}
          labelled
          disabled={!floatingLyrics.enabled}
          onInput={(e) =>
            setFloatingLyrics({
              fontSize: (e.target as M3eSliderThumbElement).value ?? 14,
            })
          }
        >
          <M3eSliderThumb value={floatingLyrics.fontSize} />
        </M3eSlider>
      </div>

      {/* 行数 */}
      <div className={SETTING_ROW_LAYOUT}>
        <span className='flex flex-col'>
          <span className={floatingLyrics.enabled ? '' : 'opacity-50'}>
            {t('settings.lines-limit')}
          </span>
          <span className='text-sm opacity-70'>
            {t('settings.lines-limit-desc')}
          </span>
        </span>
        <M3eSegmentedButton
          className={SETTING_CONTROL_FILL}
          disabled={!floatingLyrics.enabled}
          onInput={(e) =>
            setFloatingLyrics({
              lines: Number((e.target as HTMLInputElement).value),
            })
          }
        >
          {LYRIC_LINE_COUNTS.map((n) => (
            <M3eButtonSegment
              key={n}
              value={String(n)}
              checked={floatingLyrics.lines === n}
            >
              {t('settings.line-count', { n })}
            </M3eButtonSegment>
          ))}
        </M3eSegmentedButton>
      </div>

      {/* 透明度 */}
      <div className='flex flex-col gap-2'>
        <div className='flex items-center justify-between gap-4'>
          <span className={floatingLyrics.enabled ? '' : 'opacity-50'}>
            {t('settings.background-opacity')}
          </span>
          <span className='text-sm tabular-nums opacity-70'>
            {Math.round(floatingLyrics.opacity * 100)}%
          </span>
        </div>
        <M3eSlider
          min={0.2}
          max={1}
          step={0.05}
          labelled
          disabled={!floatingLyrics.enabled}
          onInput={(e) =>
            setFloatingLyrics({
              opacity: (e.target as M3eSliderThumbElement).value ?? 0.8,
            })
          }
        >
          <M3eSliderThumb value={floatingLyrics.opacity} />
        </M3eSlider>
      </div>
    </>
  );
}

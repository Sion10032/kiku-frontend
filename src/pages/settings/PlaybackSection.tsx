import { useTranslation } from 'react-i18next';
import {
  M3eSegmentedButton,
  M3eButtonSegment,
} from '@m3e/react/segmented-button';
import { M3eSlider, M3eSliderThumb } from '@m3e/react/slider';
import type { M3eSliderThumbElement } from '@m3e/react/slider';
import { M3eSwitch } from '@m3e/react/switch';
import { SETTING_CONTROL_FILL, SETTING_ROW_LAYOUT } from '../../constants';
import {
  useSettingsStore,
  type TimeDisplayMode,
} from '../../stores/settingsStore';
import { usePlayerStore } from '../../stores/playerStore';

const TIME_DISPLAY_MODES: {
  value: TimeDisplayMode;
  label: `settings.time-display-${TimeDisplayMode}`;
}[] = [
  { value: 'total', label: 'settings.time-display-total' },
  { value: 'remaining', label: 'settings.time-display-remaining' },
];

/**
 * 「播放器」分组行：时间显示 / 媒体通知 / 快退快进秒数（playerStore）/
 * 音量均衡（含目标响度、最大增益）。
 * 只渲染行，卡片见 pages/Settings.tsx。
 */
export default function PlaybackSection() {
  const { t } = useTranslation();
  const timeDisplayMode = useSettingsStore((s) => s.timeDisplayMode);
  const setTimeDisplayMode = useSettingsStore((s) => s.setTimeDisplayMode);
  const mediaNotification = useSettingsStore((s) => s.mediaNotification);
  const setMediaNotification = useSettingsStore((s) => s.setMediaNotification);
  const loudnessNormalization = useSettingsStore(
    (s) => s.loudnessNormalization,
  );
  const setLoudnessNormalization = useSettingsStore(
    (s) => s.setLoudnessNormalization,
  );
  const loudnessTargetLufs = useSettingsStore((s) => s.loudnessTargetLufs);
  const setLoudnessTargetLufs = useSettingsStore(
    (s) => s.setLoudnessTargetLufs,
  );
  const loudnessMaxGainDb = useSettingsStore((s) => s.loudnessMaxGainDb);
  const setLoudnessMaxGainDb = useSettingsStore((s) => s.setLoudnessMaxGainDb);
  const rewindSeekTime = usePlayerStore((s) => s.rewindSeekTime);
  const forwardSeekTime = usePlayerStore((s) => s.forwardSeekTime);
  const setRewindSeekTime = usePlayerStore((s) => s.setRewindSeekTime);
  const setForwardSeekTime = usePlayerStore((s) => s.setForwardSeekTime);

  return (
    <>
      {/* 时间显示模式 */}
      <div className={SETTING_ROW_LAYOUT}>
        <span className='flex flex-col'>
          <span>{t('settings.time-display')}</span>
          <span className='text-sm opacity-70'>
            {t('settings.time-display-desc')}
          </span>
        </span>
        <M3eSegmentedButton
          className={SETTING_CONTROL_FILL}
          onInput={(e) =>
            setTimeDisplayMode(
              (e.target as HTMLInputElement).value as TimeDisplayMode,
            )
          }
        >
          {TIME_DISPLAY_MODES.map((m) => (
            <M3eButtonSegment
              key={m.value}
              value={m.value}
              checked={timeDisplayMode === m.value}
            >
              {t(m.label)}
            </M3eButtonSegment>
          ))}
        </M3eSegmentedButton>
      </div>

      {/* 媒体通知 */}
      <div className='flex cursor-pointer items-center justify-between gap-4'>
        <span className='flex flex-col'>
          <span>{t('settings.media-notification')}</span>
          <span className='text-sm opacity-70'>
            {t('settings.media-notification-desc')}
          </span>
        </span>
        <M3eSwitch
          checked={mediaNotification}
          onInput={(e) =>
            setMediaNotification((e.target as HTMLInputElement).checked)
          }
        />
      </div>

      {/* 快退秒数：播放器本地设置（playerStore） */}
      <div className='flex flex-col gap-2'>
        <div className='flex items-center justify-between gap-4'>
          <span className='flex flex-col'>
            <span>{t('settings.rewind-seek-time')}</span>
            <span className='text-sm opacity-70'>
              {t('settings.rewind-seek-time-desc')}
            </span>
          </span>
          <span className='text-sm tabular-nums opacity-70'>
            {rewindSeekTime}s
          </span>
        </div>
        <M3eSlider
          min={1}
          max={60}
          step={1}
          labelled
          onInput={(e) =>
            setRewindSeekTime((e.target as M3eSliderThumbElement).value ?? 5)
          }
        >
          <M3eSliderThumb value={rewindSeekTime} />
        </M3eSlider>
      </div>

      {/* 快进秒数：播放器本地设置（playerStore） */}
      <div className='flex flex-col gap-2'>
        <div className='flex items-center justify-between gap-4'>
          <span className='flex flex-col'>
            <span>{t('settings.forward-seek-time')}</span>
            <span className='text-sm opacity-70'>
              {t('settings.forward-seek-time-desc')}
            </span>
          </span>
          <span className='text-sm tabular-nums opacity-70'>
            {forwardSeekTime}s
          </span>
        </div>
        <M3eSlider
          min={1}
          max={120}
          step={1}
          labelled
          onInput={(e) =>
            setForwardSeekTime((e.target as M3eSliderThumbElement).value ?? 30)
          }
        >
          <M3eSliderThumb value={forwardSeekTime} />
        </M3eSlider>
      </div>

      {/* 音量均衡：客户端开关，播放时应用服务器已算好的均衡增益 */}
      <div className='flex cursor-pointer items-center justify-between gap-4'>
        <span className='flex flex-col'>
          <span>{t('settings.loudness-normalization')}</span>
          <span className='text-sm opacity-70'>
            {t('settings.loudness-normalization-desc')}
          </span>
        </span>
        <M3eSwitch
          checked={loudnessNormalization}
          onInput={(e) =>
            setLoudnessNormalization((e.target as HTMLInputElement).checked)
          }
        />
      </div>

      {/* 目标响度：均衡开启时可调，关闭时禁用；范围与响度曲线 y 轴 [-40, 0] 对应 */}
      <div className='flex flex-col gap-2'>
        <div className='flex items-center justify-between gap-4'>
          <span className='flex flex-col'>
            <span className={loudnessNormalization ? '' : 'opacity-50'}>
              {t('settings.loudness-target-lufs')}
            </span>
            <span className='text-sm opacity-70'>
              {t('settings.loudness-target-lufs-desc')}
            </span>
          </span>
          <span className='text-sm tabular-nums opacity-70'>
            {loudnessTargetLufs} LUFS
          </span>
        </div>
        <M3eSlider
          min={-40}
          max={0}
          step={1}
          labelled
          disabled={!loudnessNormalization}
          onInput={(e) =>
            setLoudnessTargetLufs(
              (e.target as M3eSliderThumbElement).value ?? -28,
            )
          }
        >
          <M3eSliderThumb value={loudnessTargetLufs} />
        </M3eSlider>
      </div>

      {/* 最大增益：均衡开启时可调，关闭时禁用 */}
      <div className='flex flex-col gap-2'>
        <div className='flex items-center justify-between gap-4'>
          <span className='flex flex-col'>
            <span className={loudnessNormalization ? '' : 'opacity-50'}>
              {t('settings.loudness-max-gain-db')}
            </span>
            <span className='text-sm opacity-70'>
              {t('settings.loudness-max-gain-db-desc')}
            </span>
          </span>
          <span className='text-sm tabular-nums opacity-70'>
            ±{loudnessMaxGainDb} dB
          </span>
        </div>
        <M3eSlider
          min={0}
          max={30}
          step={1}
          labelled
          disabled={!loudnessNormalization}
          onInput={(e) =>
            setLoudnessMaxGainDb(
              (e.target as M3eSliderThumbElement).value ?? 12,
            )
          }
        >
          <M3eSliderThumb value={loudnessMaxGainDb} />
        </M3eSlider>
      </div>
    </>
  );
}

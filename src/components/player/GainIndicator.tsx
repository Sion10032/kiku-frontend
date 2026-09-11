import { M3eIcon } from '@m3e/react/icon';
import '@m3e/icons/outlined/graphic_eq';
import { usePlayerStore } from '../../stores/playerStore';
import { useSettingsStore } from '../../stores/settingsStore';

/**
 * 当前均衡增益徽标：graphic_eq 图标 + 数值（如 +4.0 dB）。
 * 仅在用户开启音量均衡且增益 ≠ 0 时显示（0 dB 直通无信息量）。
 * 数值来自 playerStore.gainDb（入队时按当时设置计算，反映实际应用到音频的增益）。
 */
export default function GainIndicator({
  className = '',
}: {
  className?: string;
}) {
  const gainDb = usePlayerStore((s) => s.gainDb);
  const enabled = useSettingsStore((s) => s.loudnessNormalization);
  if (!enabled || gainDb === 0) return null;
  return (
    <span
      className={`flex items-center gap-2 text-xs tabular-nums ${className}`}
    >
      <M3eIcon name='graphic_eq' className='shrink-0' />
      <span>{(gainDb > 0 ? '+' : '') + gainDb.toFixed(1)} dB</span>
    </span>
  );
}

import { M3eIcon } from '@m3e/react/icon';
import '@m3e/icons/outlined/graphic_eq';
import { useCurrentGainDb } from '../../hooks/useCurrentGainDb';

/**
 * 当前均衡增益徽标：graphic_eq 图标 + 数值（如 +4.0 dB）。
 * 仅在增益 ≠ 0 时显示（0 dB 直通无信息量；均衡关闭/未分析同为 0）。
 * 数值来自 useCurrentGainDb（当前音轨响度快照 × 当前设置的实时计算值，
 * 即实际应用到音频的增益）。
 */
export default function GainIndicator({
  className = '',
}: {
  className?: string;
}) {
  const gainDb = useCurrentGainDb();
  if (gainDb === 0) return null;
  return (
    <span
      className={`flex items-center gap-2 text-xs tabular-nums ${className}`}
    >
      <M3eIcon name='graphic_eq' className='shrink-0' />
      <span>{(gainDb > 0 ? '+' : '') + gainDb.toFixed(1)} dB</span>
    </span>
  );
}

import { usePlayerStore, selectCurrentTrack } from '../stores/playerStore';
import { useSettingsStore } from '../stores/settingsStore';
import { trackGainDb } from '../utils/loudness';

/**
 * 当前音轨应生效的均衡增益（dB）。
 *
 * 由当前音轨入队时快照的作品响度 + 当前响度设置（开关/目标响度/最大增益）
 * 实时计算：无当前曲目、开关关闭、无快照、未分析均返回 0（直通）。
 * 设置变化即时反映（订阅 settingsStore），切曲时随 currentTrack 快照自动切换。
 */
export function useCurrentGainDb(): number {
  const track = usePlayerStore(selectCurrentTrack);
  const enabled = useSettingsStore((s) => s.loudnessNormalization);
  const targetLufs = useSettingsStore((s) => s.loudnessTargetLufs);
  const maxGainDb = useSettingsStore((s) => s.loudnessMaxGainDb);
  return trackGainDb(track?.loudness, enabled, targetLufs, maxGainDb);
}

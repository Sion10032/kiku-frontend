/**
 * 响度曲线 Dialog：short-term LUFS 按秒序列 → SVG polyline（分段，null 断线）。
 * y 轴固定 [-40, 0] LUFS（超出 clamp），目标响度虚线（sharedConfig.loudnessTargetLufs）。
 */
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { M3eDialog } from '@m3e/react/dialog';
import { getLoudnessCurve } from '../../api/analysis';
import { getCachedSharedConfig } from '../../api/sharedConfig';

export interface CurvePoint {
  x: number;
  y: number;
}

/** 纯函数（可单测）：曲线值 → 画布坐标分段（null 断线）。x 按 N 点均分，y 线性映射并 clamp。 */
// eslint-disable-next-line react-refresh/only-export-components -- 与组件同文件导出供单测（brief 契约），fast-refresh 降级为整页刷新可接受
export function buildPoints(
  curve: Array<number | null>,
  width: number,
  height: number,
  min: number,
  max: number,
): CurvePoint[][] {
  if (curve.length === 0) return [];
  const x = (i: number): number =>
    curve.length === 1 ? 0 : (i * width) / (curve.length - 1);
  const y = (v: number): number =>
    height - ((Math.min(Math.max(v, min), max) - min) / (max - min)) * height;
  const segments: CurvePoint[][] = [];
  let seg: CurvePoint[] = [];
  curve.forEach((v, i) => {
    if (v === null) {
      if (seg.length > 0) segments.push(seg);
      seg = [];
      return;
    }
    seg.push({ x: x(i), y: y(v) });
  });
  if (seg.length > 0) segments.push(seg);
  return segments;
}

const Y_MIN = -40;
const Y_MAX = 0;

/** 曲线 Dialog 的目标音轨（WorkTree 音频行 ⋮ 菜单「响度曲线」项传入）。 */
export interface CurveTrackInfo {
  mediaIndex: string;
  title: string;
  loudnessLufs: number | null;
}

export function LoudnessCurveDialog(props: {
  workId: string;
  track: CurveTrackInfo | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const open = props.track !== null;
  const { data } = useQuery({
    queryKey: ['loudness-curve', props.workId, props.track?.mediaIndex],
    queryFn: () => getLoudnessCurve(props.workId, props.track!.mediaIndex),
    enabled: open,
  });
  // 关闭即卸载（同 MetadataEditDialog）：track 为 null 时不渲染 M3eDialog，
  // 避免旧 track 的标题/曲线在关闭动画后残留。
  if (props.track === null) return null;
  const track = props.track;
  const target = getCachedSharedConfig()?.loudnessTargetLufs ?? -16;
  const curve = data?.curve ?? [];
  const W = 560;
  const H = 200;
  const segments = buildPoints(curve, W, H, Y_MIN, Y_MAX);
  const yOf = (v: number): number =>
    H - ((Math.min(Math.max(v, Y_MIN), Y_MAX) - Y_MIN) / (Y_MAX - Y_MIN)) * H;

  return (
    <M3eDialog
      open
      onClosed={props.onClose}
      dismissible
      closeLabel={t('common.close')}
    >
      <span slot='header'>
        {track.title} · {t('works.loudness.curve-title')}
      </span>
      <div className='p-4'>
        {curve.length === 0 ? (
          <p className='text-sm opacity-60'>
            {t('works.loudness.curve-empty')}
          </p>
        ) : (
          <svg viewBox={`0 0 ${W} ${H}`} className='w-full' role='img'>
            <line
              x1={0}
              x2={W}
              y1={yOf(target)}
              y2={yOf(target)}
              strokeDasharray='4 4'
              className='stroke-current opacity-30'
            >
              <title>{t('works.loudness.target', { lufs: target })}</title>
            </line>
            {track.loudnessLufs != null && (
              <line
                x1={0}
                x2={W}
                y1={yOf(track.loudnessLufs)}
                y2={yOf(track.loudnessLufs)}
                strokeDasharray='2 6'
                className='stroke-current opacity-20'
              />
            )}
            {segments.map((seg, i) => (
              <polyline
                key={i}
                points={seg.map((p) => `${p.x},${p.y}`).join(' ')}
                fill='none'
                strokeWidth={1.5}
                className='stroke-current'
              />
            ))}
          </svg>
        )}
        <div className='mt-1 flex justify-between text-xs opacity-50'>
          <span>−40 LUFS</span>
          <span>0 LUFS</span>
        </div>
      </div>
    </M3eDialog>
  );
}

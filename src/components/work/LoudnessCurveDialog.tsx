/**
 * 响度曲线 Dialog：short-term LUFS 按秒序列 → SVG polyline（分段，null 断线）。
 * 横轴为时间（曲线下标即秒），纵轴固定 [-60, 0] LUFS（超出 clamp），
 * 目标响度虚线（用户设置 loudnessTargetLufs）。
 */
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { M3eDialog } from '@m3e/react/dialog';
import { getLoudnessCurve } from '../../api/works';
import { useSettingsStore } from '../../stores/settingsStore';
import { formatDuration } from '../../utils/format';

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

// 纵轴下限取 -60：后端把 ≤ -70 LUFS 当「不可测量」存 null（ffmpeg.ts 的
// parseLoudnessCurve），所以有效值最低就落在 -70 附近；-60 能覆盖实测库里
// 绝大多数低响度片段（常见 p5 在 -48 ~ -37），再低的部分仍 clamp 到图底边。
const Y_MIN = -60;
const Y_MAX = 0;

/** 纵轴主刻度（LUFS）；单位由图左侧单独的「LUFS」标注给出，不在每格重复。 */
const Y_TICKS = [0, -20, -40, -60];

/**
 * 纯函数（可单测）：时间轴刻度 —— 起点 / 中点 / 末尾（曲线下标即秒）。
 * 点数 < 2（不足 1 秒）时只保留起点；中点与端点重合时丢中点，
 * 因为端点标签分别用 start / end 对齐才能不出界。
 */
// eslint-disable-next-line react-refresh/only-export-components -- 同 buildPoints：与组件同文件导出供单测
export function timeTicks(
  pointCount: number,
): Array<{ sec: number; anchor: 'start' | 'middle' | 'end' }> {
  if (pointCount <= 0) return [];
  if (pointCount < 2) return [{ sec: 0, anchor: 'start' }];
  const last = pointCount - 1;
  const ticks: Array<{
    sec: number;
    anchor: 'start' | 'middle' | 'end';
  }> = [{ sec: 0, anchor: 'start' }];
  const mid = Math.round(last / 2);
  if (mid > 0 && mid < last) ticks.push({ sec: mid, anchor: 'middle' });
  ticks.push({ sec: last, anchor: 'end' });
  return ticks;
}

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
  // 目标响度虚线（用户级设置；hook 须在提前 return 之前订阅）
  const target = useSettingsStore((s) => s.loudnessTargetLufs);
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
  const curve = data?.curve ?? [];
  const W = 560;
  const H = 200;
  // 顶部留给纵轴单位（LUFS）、左侧留给 Y 轴刻度、底部留给时间轴刻度；
  // 绘图区原点在 (PAD_L, PAD_T)
  const PAD_L = 44;
  const PAD_T = 28;
  const PAD_R = 6;
  const PAD_B = 18;
  const AXIS_FONT = 12;
  const segments = buildPoints(curve, W, H, Y_MIN, Y_MAX);
  const yOf = (v: number): number =>
    H - ((Math.min(Math.max(v, Y_MIN), Y_MAX) - Y_MIN) / (Y_MAX - Y_MIN)) * H;
  const xOf = (i: number): number =>
    curve.length <= 1 ? 0 : (i * W) / (curve.length - 1);

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
      <div className='pr-4'>
        {curve.length === 0 ? (
          <p className='text-sm opacity-60'>
            {t('works.loudness.curve-empty')}
          </p>
        ) : (
          <svg
            viewBox={`0 0 ${PAD_L + W + PAD_R} ${PAD_T + H + PAD_B}`}
            className='w-full'
            role='img'
            aria-label={t('works.loudness.curve-title')}
          >
            {/* 纵轴单位：标在轴线顶端上方，不与刻度数字重复 */}
            <text
              x={PAD_L - 8}
              y={PAD_T - 16}
              textAnchor='end'
              fontSize={11}
              className='fill-current opacity-50'
            >
              LUFS
            </text>
            {/* Y 轴：轴线 + 主刻度 */}
            <line
              x1={PAD_L}
              x2={PAD_L}
              y1={PAD_T}
              y2={PAD_T + H}
              className='stroke-current opacity-50'
            />
            <g className='fill-current opacity-50' fontSize={AXIS_FONT}>
              {Y_TICKS.map((value) => (
                <g key={value}>
                  <text
                    x={PAD_L - 8}
                    y={PAD_T + yOf(value)}
                    textAnchor='end'
                    dominantBaseline='middle'
                  >
                    {value === 0 ? '0' : `−${Math.abs(value)}`}
                  </text>
                  <line
                    x1={PAD_L - 4}
                    x2={PAD_L}
                    y1={PAD_T + yOf(value)}
                    y2={PAD_T + yOf(value)}
                    className='stroke-current'
                  />
                </g>
              ))}
            </g>
            <g transform={`translate(${PAD_L} ${PAD_T})`}>
              {/* X 轴基线（与左侧轴线在原点相交） */}
              <line
                x1={0}
                x2={W}
                y1={H}
                y2={H}
                className='stroke-current opacity-50'
              />
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
            </g>
            {/* X 轴刻度：时间（曲线下标即秒） */}
            <g className='fill-current opacity-50' fontSize={AXIS_FONT}>
              {timeTicks(curve.length).map((tick) => (
                <text
                  key={tick.sec}
                  x={PAD_L + xOf(tick.sec)}
                  y={PAD_T + H + 13}
                  textAnchor={tick.anchor}
                >
                  {formatDuration(tick.sec)}
                </text>
              ))}
            </g>
          </svg>
        )}
      </div>
    </M3eDialog>
  );
}

import { M3eCard } from '@m3e/react/card';
import { M3eSwitch } from '@m3e/react/switch';
import {
  M3eSegmentedButton,
  M3eButtonSegment,
} from '@m3e/react/segmented-button';
import { M3eSlider, M3eSliderThumb } from '@m3e/react/slider';
import type { M3eSliderThumbElement } from '@m3e/react/slider';
import {
  useSettingsStore,
  type ColorMode,
  type CoverBlurMode,
  type TimeDisplayMode,
  type WorksPaginationMode,
  type WorksPaginatorPosition,
} from '../stores/settingsStore';
import { useThemeStore, DEFAULT_SEED } from '../stores/themeStore';

const COLOR_MODES: { value: ColorMode; label: string }[] = [
  { value: 'auto', label: '跟随系统' },
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
];

const LYRIC_LINE_COUNTS = [1, 2, 3];

const COVER_BLUR_MODES: { value: CoverBlurMode; label: string }[] = [
  { value: 'always', label: '始终模糊' },
  { value: 'hover', label: '悬浮显示' },
  { value: 'never', label: '始终显示' },
];

const TIME_DISPLAY_MODES: { value: TimeDisplayMode; label: string }[] = [
  { value: 'total', label: '总时长' },
  { value: 'remaining', label: '剩余时间' },
];

const WORKS_PAGINATION_MODES: { value: WorksPaginationMode; label: string }[] =
  [
    { value: 'paginate', label: '分页' },
    { value: 'infinite', label: '无限滚动' },
  ];

const WORKS_PAGINATOR_POSITIONS: {
  value: WorksPaginatorPosition;
  label: string;
}[] = [
  { value: 'top', label: '顶部' },
  { value: 'bottom', label: '底部' },
  { value: 'both', label: '顶部和底部' },
];

/**
 * 设置页：纯本地偏好（settingsStore，localStorage 持久化），
 * 不依赖 userStore / 登录态；改动即时生效，无需保存按钮。
 *
 * - 动态取色：开启后进入作品详情时从封面提取主题种子色；
 *   关闭瞬间恢复默认紫（#6750A4），详情页不再换色
 * - 颜色模式：auto / light / dark，经 ThemeRoot 传给 M3eTheme
 * - 媒体通知：开关 MediaSession（锁屏/系统媒体面板），useMediaSession 读取
 * - 时间显示：总时长（22:33）/ 剩余时间（-1:39），作用 PlayerBar 与全屏播放器
 * - 作品库翻页方式：分页（可跳页）/ 无限滚动
 * - 分页控件位置：作品库分页控件显示在顶部 / 底部 / 顶部和底部
 * - 最近收听：作品库首页是否显示「最近收听」条
 * - 悬浮歌词：LyricsBar 的字体大小 / 换行行数上限 / 背景透明度
 */
export default function Settings() {
  const dynamicColor = useSettingsStore((s) => s.dynamicColor);
  const colorMode = useSettingsStore((s) => s.colorMode);
  const setDynamicColor = useSettingsStore((s) => s.setDynamicColor);
  const setColorMode = useSettingsStore((s) => s.setColorMode);
  const mediaNotification = useSettingsStore((s) => s.mediaNotification);
  const setMediaNotification = useSettingsStore((s) => s.setMediaNotification);
  const floatingLyrics = useSettingsStore((s) => s.floatingLyrics);
  const setFloatingLyrics = useSettingsStore((s) => s.setFloatingLyrics);
  const coverBlurMode = useSettingsStore((s) => s.coverBlurMode);
  const setCoverBlurMode = useSettingsStore((s) => s.setCoverBlurMode);
  const timeDisplayMode = useSettingsStore((s) => s.timeDisplayMode);
  const setTimeDisplayMode = useSettingsStore((s) => s.setTimeDisplayMode);
  const worksPaginationMode = useSettingsStore((s) => s.worksPaginationMode);
  const setWorksPaginationMode = useSettingsStore(
    (s) => s.setWorksPaginationMode,
  );
  const worksPaginatorPosition = useSettingsStore(
    (s) => s.worksPaginatorPosition,
  );
  const setWorksPaginatorPosition = useSettingsStore(
    (s) => s.setWorksPaginatorPosition,
  );
  const worksHistoryStrip = useSettingsStore((s) => s.worksHistoryStrip);
  const setShowHistoryStrip = useSettingsStore((s) => s.setShowHistoryStrip);

  return (
    <div className='mx-auto flex max-w-2xl flex-col gap-4'>
      <h1 className='m-0 text-2xl font-normal'>设置</h1>
      <M3eCard>
        <div slot='content' className='flex flex-col gap-6'>
          {/* 颜色模式：窄屏时标签与分段按钮上下堆叠，避免横向溢出 */}
          <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
            <span>颜色模式</span>
            {/* 注意：组的 value 是 getter-only 派生属性（同 radio-group），
                受控方式是给每个 M3eButtonSegment 传 checked */}
            <M3eSegmentedButton
              className='w-full sm:w-auto'
              onInput={(e) =>
                setColorMode((e.target as HTMLInputElement).value as ColorMode)
              }
            >
              {COLOR_MODES.map((m) => (
                <M3eButtonSegment
                  key={m.value}
                  value={m.value}
                  checked={colorMode === m.value}
                >
                  {m.label}
                </M3eButtonSegment>
              ))}
            </M3eSegmentedButton>
          </div>

          {/* 动态取色 */}
          <div className='flex cursor-pointer items-center justify-between gap-4'>
            <span className='flex flex-col'>
              <span>动态取色</span>
              <span className='text-sm opacity-70'>
                进入作品详情时从封面提取主题色
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

          {/* NSFW 封面 */}
          <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
            <span className='flex flex-col'>
              <span>NSFW 封面</span>
              <span className='text-sm opacity-70'>
                始终模糊 / 默认模糊悬浮显示 / 始终清晰显示
              </span>
            </span>
            <M3eSegmentedButton
              className='w-full sm:w-auto'
              onInput={(e) =>
                setCoverBlurMode(
                  (e.target as HTMLInputElement).value as CoverBlurMode,
                )
              }
            >
              {COVER_BLUR_MODES.map((m) => (
                <M3eButtonSegment
                  key={m.value}
                  value={m.value}
                  checked={coverBlurMode === m.value}
                >
                  {m.label}
                </M3eButtonSegment>
              ))}
            </M3eSegmentedButton>
          </div>

          {/* 时间显示模式 */}
          <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
            <span className='flex flex-col'>
              <span>时间显示</span>
              <span className='text-sm opacity-70'>
                播放器中显示总时长（22:33）或剩余时间（-1:39）
              </span>
            </span>
            <M3eSegmentedButton
              className='w-full sm:w-auto'
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
                  {m.label}
                </M3eButtonSegment>
              ))}
            </M3eSegmentedButton>
          </div>

          {/* 作品库翻页方式 */}
          <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
            <span className='flex flex-col'>
              <span>作品库翻页方式</span>
              <span className='text-sm opacity-70'>
                分页（可跳页，页码与筛选同步到地址栏和标题）或无限滚动
              </span>
            </span>
            <M3eSegmentedButton
              className='w-full sm:w-auto'
              onInput={(e) =>
                setWorksPaginationMode(
                  (e.target as HTMLInputElement).value as WorksPaginationMode,
                )
              }
            >
              {WORKS_PAGINATION_MODES.map((m) => (
                <M3eButtonSegment
                  key={m.value}
                  value={m.value}
                  checked={worksPaginationMode === m.value}
                >
                  {m.label}
                </M3eButtonSegment>
              ))}
            </M3eSegmentedButton>
          </div>

          {/* 分页控件显示位置 */}
          <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
            <span className='flex flex-col'>
              <span>分页控件显示位置</span>
              <span className='text-sm opacity-70'>
                作品库分页控件显示在列表顶部、底部或两者
              </span>
            </span>
            <M3eSegmentedButton
              className='w-full sm:w-auto'
              onInput={(e) =>
                setWorksPaginatorPosition(
                  (e.target as HTMLInputElement)
                    .value as WorksPaginatorPosition,
                )
              }
            >
              {WORKS_PAGINATOR_POSITIONS.map((p) => (
                <M3eButtonSegment
                  key={p.value}
                  value={p.value}
                  checked={worksPaginatorPosition === p.value}
                >
                  {p.label}
                </M3eButtonSegment>
              ))}
            </M3eSegmentedButton>
          </div>

          {/* 最近收听条 */}
          <div className='flex cursor-pointer items-center justify-between gap-4'>
            <span className='flex flex-col'>
              <span>最近收听</span>
              <span className='text-sm opacity-70'>
                在作品库首页顶部显示最近收听条
              </span>
            </span>
            <M3eSwitch
              checked={worksHistoryStrip}
              onInput={(e) =>
                setShowHistoryStrip((e.target as HTMLInputElement).checked)
              }
            />
          </div>

          {/* 媒体通知 */}
          <div className='flex cursor-pointer items-center justify-between gap-4'>
            <span className='flex flex-col'>
              <span>媒体通知</span>
              <span className='text-sm opacity-70'>
                在系统媒体面板 / 锁屏显示播放控制
              </span>
            </span>
            <M3eSwitch
              checked={mediaNotification}
              onInput={(e) =>
                setMediaNotification((e.target as HTMLInputElement).checked)
              }
            />
          </div>
        </div>
      </M3eCard>

      {/* 悬浮歌词 */}
      <M3eCard>
        <div slot='content' className='flex flex-col gap-6'>
          <div className='flex cursor-pointer items-center justify-between gap-4'>
            <span className='flex flex-col'>
              <span>显示悬浮歌词</span>
              <span className='text-sm opacity-70'>
                播放时在播放条上方悬浮显示当前歌词
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
                字体大小
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
          <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
            <span className='flex flex-col'>
              <span className={floatingLyrics.enabled ? '' : 'opacity-50'}>
                行数上限
              </span>
              <span className='text-sm opacity-70'>
                歌词过长时换行显示，超出部分省略
              </span>
            </span>
            <M3eSegmentedButton
              className='w-full sm:w-auto'
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
                  {n} 行
                </M3eButtonSegment>
              ))}
            </M3eSegmentedButton>
          </div>

          {/* 透明度 */}
          <div className='flex flex-col gap-2'>
            <div className='flex items-center justify-between gap-4'>
              <span className={floatingLyrics.enabled ? '' : 'opacity-50'}>
                背景透明度
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
        </div>
      </M3eCard>
    </div>
  );
}

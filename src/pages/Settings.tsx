import { M3eCard } from '@m3e/react/card';
import { M3eSwitch } from '@m3e/react/switch';
import {
  M3eSegmentedButton,
  M3eButtonSegment,
} from '@m3e/react/segmented-button';
import { useSettingsStore, type ColorMode } from '../stores/settingsStore';
import { useThemeStore, DEFAULT_SEED } from '../stores/themeStore';

const COLOR_MODES: { value: ColorMode; label: string }[] = [
  { value: 'auto', label: '跟随系统' },
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
];

/**
 * 设置页：纯本地偏好（settingsStore，localStorage 持久化），
 * 不依赖 userStore / 登录态；改动即时生效，无需保存按钮。
 *
 * - 动态取色：开启后进入作品详情时从封面提取主题种子色；
 *   关闭瞬间恢复默认紫（#6750A4），详情页不再换色
 * - 颜色模式：auto / light / dark，经 ThemeRoot 传给 M3eTheme
 */
export default function Settings() {
  const dynamicColor = useSettingsStore((s) => s.dynamicColor);
  const colorMode = useSettingsStore((s) => s.colorMode);
  const setDynamicColor = useSettingsStore((s) => s.setDynamicColor);
  const setColorMode = useSettingsStore((s) => s.setColorMode);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="m-0 mb-4 text-2xl font-normal">设置</h1>
      <M3eCard>
        <div slot="content" className="flex flex-col gap-6">
          {/* 颜色模式 */}
          <div className="flex items-center justify-between gap-4">
            <span>颜色模式</span>
            {/* 注意：组的 value 是 getter-only 派生属性（同 radio-group），
                受控方式是给每个 M3eButtonSegment 传 checked */}
            <M3eSegmentedButton
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
          <div className="flex cursor-pointer items-center justify-between gap-4">
            <span className="flex flex-col">
              <span>动态取色</span>
              <span className="text-sm opacity-70">进入作品详情时从封面提取主题色</span>
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
        </div>
      </M3eCard>
    </div>
  );
}

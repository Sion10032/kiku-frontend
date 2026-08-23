import { M3eTheme } from '@m3e/react/theme';
import App from './App';
import { useThemeStore } from './stores/themeStore';
import { useSettingsStore } from './stores/settingsStore';

export default function ThemeRoot() {
  // 运行时种子色（themeStore）与用户偏好（settingsStore）职责分离：
  // seed 由封面取色写入，colorMode 由设置页切换（auto 跟随系统）。
  const seed = useThemeStore(s => s.seed);
  const colorMode = useSettingsStore(s => s.colorMode);
  return (
    <M3eTheme color={seed} scheme={colorMode} motion='expressive' strongFocus>
      <App />
    </M3eTheme>
  );
}

import { createPortal } from 'react-dom';
import { M3eTheme } from '@m3e/react/theme';
import App from './App';
import { useThemeStore } from './stores/themeStore';
import { useSettingsStore } from './stores/settingsStore';

export default function ThemeRoot() {
  // 运行时种子色（themeStore）与用户偏好（settingsStore）职责分离：
  // seed 由封面取色写入，colorMode 由设置页切换（auto 跟随系统）。
  const seed = useThemeStore((s) => s.seed);
  const colorMode = useSettingsStore((s) => s.colorMode);
  // m3e-theme 只有作为 <body> 的直接子元素，才会把动态色彩变量注入
  // document 级样式表（html { --md-sys-color-* } ...），并为 body 应用
  // 主题背景/前景/滚动条颜色、接管 html 的 color-scheme（ThemeElement.ts
  // 的 parentElement instanceof HTMLBodyElement 分支）。React 的挂载点
  // #root 是 div，走不到该分支，因此用 portal 提升到 body 直接子级；
  // m3e-theme 自身为 display:contents，不影响布局。
  return createPortal(
    <M3eTheme color={seed} scheme={colorMode} motion='expressive' strongFocus>
      <App />
    </M3eTheme>,
    document.body,
  );
}

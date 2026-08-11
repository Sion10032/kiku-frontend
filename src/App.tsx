import { M3eTheme } from '@m3e/react/theme';
import { M3eCard } from '@m3e/react/card';
import { M3eButton } from '@m3e/react/button';
import { M3eHeading } from '@m3e/react/heading';
import { useThemeStore } from './stores/themeStore';

/**
 * 临时入口组件（步骤 2 将替换为 RouterProvider）。
 * 用于验证 Vite + React 19 + @m3e/react 主题链路是否打通。
 */
export default function App() {
  const seed = useThemeStore((s) => s.seed);
  return (
    <M3eTheme color={seed} scheme="auto" motion="expressive" strongFocus>
      <main style={{ padding: '2rem', maxWidth: '640px', margin: '0 auto' }}>
        <M3eCard>
          <span slot="header">
            <M3eHeading>Kiku</M3eHeading>
          </span>
          <div slot="content">
            React 19 + Material 3 Expressive 脚手架已就绪。
          </div>
          <div slot="actions">
            <M3eButton variant="filled">开始</M3eButton>
          </div>
        </M3eCard>
      </main>
    </M3eTheme>
  );
}

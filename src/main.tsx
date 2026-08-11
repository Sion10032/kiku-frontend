import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { M3eTheme } from '@m3e/react/theme';
import App from './App';
import { useThemeStore } from './stores/themeStore';
import './index.css';

function ThemeRoot() {
  const seed = useThemeStore((s) => s.seed); // 订阅种子色（步骤 14 动态取色）
  return (
    <M3eTheme color={seed} scheme="auto" motion="expressive" strongFocus>
      <App />
    </M3eTheme>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeRoot />
  </StrictMode>,
);

import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig, globalIgnores } from 'eslint/config';
import tsParser from '@typescript-eslint/parser';

// 格式与通用 lint 由 Biome 负责（见 biome.json），此处仅保留 Biome 尚未覆盖的 React 规则。
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      sourceType: 'module',
    },
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
  },
]);

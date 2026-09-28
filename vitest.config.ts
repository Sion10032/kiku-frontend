import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

// 存在本文件时 vitest 完全忽略 vite.config.ts（不合并），因此这里自带
// plugins / alias / setupFiles，保证与原有 vite.config.ts test 段行为一致。
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify('dev'),
    __APP_COMMIT__: JSON.stringify('unknown'),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['src/test/setup.ts'],
  },
});

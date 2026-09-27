/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

/**
 * 前端版本号：只认构建期注入的 `APP_VERSION_FRONTEND`（Dockerfile build arg / CI，
 * 通常传发布 tag）。不读 package.json：版本由发布方（tag）决定，不跟仓库文件挂钩。
 */
const APP_VERSION = process.env.APP_VERSION_FRONTEND?.trim() || 'dev';

/**
 * 构建 commit：只认构建期注入的 `GIT_COMMIT_FRONTEND`（Dockerfile build arg / CI）。
 * 不跑 git 解析：前端产物是静态文件，版本信息只可能在构建期定死，
 * 本地 dev 若没传就是 `unknown`。
 */
const APP_COMMIT = process.env.GIT_COMMIT_FRONTEND?.trim() || 'unknown';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // 版本信息在构建期定死（前端产物是静态文件，运行期无从得知）
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
    __APP_COMMIT__: JSON.stringify(APP_COMMIT),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // 后端 + SSE 端点 (/api/scanner/events) 复用同一代理
      '/api': 'http://localhost:8888',
    },
  },
  test: {
    environment: 'node', // pure-function tests; add jsdom here later for component tests
    setupFiles: ['src/test/setup.ts'],
  },
});

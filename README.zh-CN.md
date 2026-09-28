# kiku-frontend

[English](README.md) · **简体中文**

[kiku](https://github.com/Sion10032/kiku) 的前端：自托管 DLsite 音声作品媒体服务器的 Web 界面。

本项目是 [kikoeru-quasar](https://github.com/kikoeru-project/kikoeru-quasar) 的重写版（Vue 2 + Quasar → React 19 + @m3e/react）。

## 技术栈

React 19 + [@m3e/react](https://m3e.material-web.dev/)（Material 3 Web Components）、Vite、TanStack Router / Query、Tailwind CSS 4、Zustand、ky、i18next，播放器基于 howler（含 WavPack 解码）。

## 开发

需要 [Bun](https://bun.sh/)；后端需在 `:8888` 运行（`/api` 由 Vite 代理过去，含 SSE 端点）。

```bash
bun install
bun run dev        # 开发服务器 :5173
bun run build      # tsc -b && vite build
bun run preview    # 预览构建产物
```

质量检查：

```bash
bun run test       # vitest run
bun run typecheck  # tsc --noEmit
bun run lint       # biome check .（格式 + 通用 lint）
bun run eslint     # React hooks / refresh 规则
```

## 目录结构

```
src/
├── routes/       # 路由树（createRoute 代码式，search 参数 zod 校验）
├── pages/        # 路由组件
├── layouts/      # MainLayout / DashboardLayout
├── components/   # 按业务域分目录的 UI 组件
├── queries/      # TanStack Query hooks
├── api/          # 请求层，只有 client.ts 直接接触 ky
├── stores/       # Zustand 客户端状态
├── hooks/ utils/ # 复用逻辑 / 纯函数
└── i18n/         # i18next，文案见 locales/{zh-CN,en}.json
```

依赖方向只准向下：`routes → pages → components → queries → api`。

## i18n

界面文案一律走 `t('key')`，key 为扁平 dotted 字面量，`zh-CN.json` 与 `en.json` 必须保持同步（`parity.test.ts` 校验）。

## 版本号

版本与 commit 由构建期注入（`APP_VERSION_FRONTEND` / `GIT_COMMIT_FRONTEND`），不读 `package.json`、不跑 git 解析；未注入时显示 `dev-unknown`。Docker 构建见父仓库 `Dockerfile`。

## License

GPL-3.0-or-later，与原项目一致。保留原项目版权声明：Copyright (C) Watanuki-Kimihiro 及贡献者。

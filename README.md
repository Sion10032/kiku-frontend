# kiku-frontend

**English** · [简体中文](README.zh-CN.md)

The frontend for [kiku](https://github.com/Sion10032/kiku), a self-hosted media server for DLsite voice works.

A rewrite of [kikoeru-quasar](https://github.com/kikoeru-project/kikoeru-quasar) (Vue 2 + Quasar → React 19 + @m3e/react).

## Tech stack

React 19 + [@m3e/react](https://m3e.material-web.dev/) (Material 3 Web Components), Vite, TanStack Router / Query, Tailwind CSS 4, Zustand, ky, i18next; playback uses howler (with WavPack decoding).

## Development

Requires [Bun](https://bun.sh/). The backend must be running on `:8888` (Vite proxies `/api` there, including the SSE endpoint).

```bash
bun install
bun run dev        # dev server on :5173
bun run build      # tsc -b && vite build
bun run preview    # preview the production build
```

Checks:

```bash
bun run test       # vitest run
bun run typecheck  # tsc --noEmit
bun run lint       # biome check . (formatting + general lint)
bun run eslint     # React hooks / refresh rules
```

## Project layout

```
src/
├── routes/       # route tree (code-based createRoute, zod-validated search params)
├── pages/        # route components
├── layouts/      # MainLayout / DashboardLayout
├── components/   # UI components grouped by domain
├── queries/      # TanStack Query hooks
├── api/          # request layer; only client.ts touches ky
├── stores/       # Zustand client state
├── hooks/ utils/ # shared logic / pure functions
└── i18n/         # i18next, strings in locales/{zh-CN,en}.json
```

Dependencies only point downwards: `routes → pages → components → queries → api`.

## i18n

All UI strings go through `t('key')`; keys are flat dotted literals, and `zh-CN.json` and `en.json` must stay in sync (enforced by `parity.test.ts`).

## Version

Version and commit are injected at build time (`APP_VERSION_FRONTEND` / `GIT_COMMIT_FRONTEND`); `package.json` is not read and git is not queried. Without injection they show `dev-unknown`. See the `Dockerfile` in the parent repository for the Docker build.

## License

GPL-3.0-or-later, same as the original project. Original copyright notice retained: Copyright (C) Watanuki-Kimihiro and contributors.

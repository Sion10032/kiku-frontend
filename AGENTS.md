# kiku-frontend 开发约定

React 19 + @m3e/react（Web Components）+ Vite + TanStack Router/Query + Tailwind 4 + Zustand + ky + i18next。

## 命令

```bash
bun run dev        # vite（:5173，/api 代理到后端 :8888）
bun run build      # tsc -b && vite build
bun run test       # vitest run
bun run typecheck  # tsc --noEmit
bun run lint       # biome check .（格式 + 通用 lint）
bun run eslint     # 仅 React hooks / refresh 规则（Biome 未覆盖的部分）
```

## 分层（依赖只准向下）

| 目录 | 角色 |
|---|---|
| `src/routes/` | 路由树：`createRoute` 代码式（非文件式），beforeLoad 恢复会话/重定向、search 参数 zod 校验；`routes/index.tsx` 汇总 routeTree |
| `src/pages/` | 路由组件；`src/layouts/` 为 MainLayout / DashboardLayout |
| `src/components/<域>/` | 通用 UI，按业务域分目录（player、work、preview…） |
| `src/queries/` | TanStack Query hooks；queryKey 构造函数与 hook 同文件导出，供测试复用 |
| `src/api/` | 请求层（`apiFetch` + 各域模块）；**只有 `src/api/client.ts` 直接接触 ky** |
| `src/stores/` | Zustand 客户端状态（持久化用 `persist`）；服务端状态交给 Query，不放 store |
| `src/hooks/` `src/utils/` | 无 JSX 的复用逻辑 / 纯函数 |

## i18n

- 文案一律 `t('key')`，key 登记 `src/i18n/locales/{zh-CN,en}.json`，两份必须同步（`parity.test.ts` 校验 key 集合与空值）
- key 是扁平 dotted 字面量（`keySeparator: false`），不做嵌套
- `Accept-Language` 由 `src/api/client.ts` 自动注入，后端错误消息随界面语言本地化

## 测试

- Vitest，全局 `environment: 'node'`；**需要 DOM 的测试在文件首行加 `// @vitest-environment jsdom`**，不要改全局配置
- 测试与被测文件同目录：纯逻辑 `<name>.test.ts`、组件 `<Name>.test.tsx`
- 组件测试用 @testing-library/react；`src/test/setup.ts` 注入内存 localStorage

## 风格

- Biome 负责格式与通用 lint（单引号、2 空格、分号、行宽 80）；ESLint 只保留 React hooks / refresh 规则，别在两处重复配规则
- import 一律相对路径（vite 配了 `@` 别名但 tsconfig 无 `paths`，现状不用别名）
- M3E 组件按子路径导入（`@m3e/react/list`、`@m3e/react/search`）；图标需显式 `import '@m3e/icons/outlined/xxx'`

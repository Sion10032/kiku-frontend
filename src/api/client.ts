import ky, { HTTPError, type Options } from 'ky';
import { getToken, clearToken } from './token';

/** API 基址（由 vite proxy 转发到后端 http://localhost:8888） */
const API_BASE = '/api';

/**
 * 预配置的 ky 实例：
 * - prefix 统一前缀（请求 path 不要以 `/` 开头）
 * - beforeRequest 注入 JWT（Authorization header）
 * - beforeError 拦截 401：清除 token 并跳转登录（避免登录页自身循环）
 * - 有限重试（仅网络/超时及幂等状态码）
 */
export const api = ky.create({
  prefix: API_BASE,
  hooks: {
    beforeRequest: [
      ({ request }) => {
        const token = getToken();
        if (token) request.headers.set('Authorization', `Bearer ${token}`);
      },
    ],
    beforeError: [
      ({ error }) => {
        if (error instanceof HTTPError && error.response.status === 401) {
          clearToken();
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
        }
        return error;
      },
    ],
  },
  retry: {
    limit: 2,
    statusCodes: [408, 429, 500, 502, 503, 504],
    methods: ['get', 'put', 'delete', 'post'],
  },
});

/** 带 HTTP status 的 API 错误。 */
export class ApiError extends Error {
  status: number;
  /** 后端返回的完整错误体（可能是对象/数组/字符串），便于按 code 或字段级错误分支 */
  body?: unknown;
  constructor(
    message: string,
    status: number,
    body?: unknown,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

/** 从 HTTPError.data 提取人可读的错误消息 */
function extractErrorMessage(data: unknown, status: number): string {
  if (typeof data === 'object' && data !== null) {
    const { error, message } = data as { error?: unknown; message?: unknown };
    if (typeof error === 'string') return error;
    if (typeof message === 'string') return message;
  }
  return `请求失败 (${status})`;
}

/**
 * 类型安全的 JSON 请求封装。
 *
 * - GET：query 走 searchParams
 * - 写操作：`json` 自动序列化 body
 * - 非 2xx → 抛出带 status 的 ApiError（由 beforeError 先处理 401 跳转）
 * - 204 / 空 body → 返回 undefined（调用方应将 T 声明为含 undefined）
 */
type ApiFetchOptions = Pick<
  Options,
  'method' | 'json' | 'searchParams' | 'signal' | 'keepalive'
>;

export async function apiFetch<T>(
  path: string,
  opts?: ApiFetchOptions,
): Promise<T> {
  try {
    const res = await api(path, opts);

    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof HTTPError) {
      // ky v2 已消费 response body 并把解析结果放在 HTTPError.data 上
      //（body 为空或解析失败时为 undefined）；二次 response.json() 会抛
      // "Body already used"，故只读 data。
      throw new ApiError(
        extractErrorMessage(err.data, err.response.status),
        err.response.status,
        err.data,
        { cause: err },
      );
    }
    // 网络错误等其他异常，原样抛出
    throw err;
  }
}

/**
 * 为媒体资源（封面、音频流、下载）拼装带 token 的 URL。
 *
 * `<img src>` / Howler 无法注入 Authorization header，故用 `?token=` query。
 * 后端 media 路由当前公开访问（无 preHandler）；若日后启用 query token
 * 鉴权（如原 kikoeru-express），此函数已就绪。
 */
export function mediaUrl(path: string): string {
  const token = getToken();
  const sep = path.includes('?') ? '&' : '?';
  return token ? `${path}${sep}token=${token}` : path;
}

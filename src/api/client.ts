import ky, { HTTPError } from 'ky';
import { getToken, clearToken } from './token';

/** API 基址（由 vite proxy 转发到后端 http://localhost:8888） */
const API_BASE = '/api';

/**
 * 预配置的 ky 实例：
 * - prefixUrl 统一前缀（请求 path 不要以 `/` 开头）
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
    statusCodes: [ 408, 429, 500, 502, 503, 504 ],
    methods: [ 'get', 'put', 'delete', 'post' ],
  },
});

/**
 * 类型安全的 JSON 请求封装。
 *
 * - GET：query 走 searchParams
 * - 写操作：`json` 自动序列化 body
 * - 非 2xx → 抛出带 status 的 ApiError（由 beforeError 先处理 401 跳转）
 * - 204 / 空 body → 返回 undefined
 */
export async function apiFetch<T>(
  path: string,
  opts?: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    json?: unknown;
    searchParams?:
      | Record<string, string | number | boolean | undefined>
      | URLSearchParams;
    signal?: AbortSignal;
    /** 页面卸载时仍发出请求（fetch RequestInit.keepalive） */
    keepalive?: boolean;
  },
): Promise<T> {
  try {
    const res = await api(path, {
      method: opts?.method ?? 'GET',
      json: opts?.json,
      searchParams: opts?.searchParams,
      signal: opts?.signal,
      keepalive: opts?.keepalive,
    });

    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }
  catch (err) {
    if (err instanceof HTTPError) {
      const response = err.response;
      const body = await response
        .json()
        .catch(() => ({ error: response.statusText }));
      throw new ApiError(
        (body as { error?: string; })?.error || response.statusText,
        response.status,
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

/** 带 HTTP status 的 API 错误。 */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

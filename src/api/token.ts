/** JWT token 的本地存储（header 鉴权 + 媒体资源 query token）。 */

const TOKEN_KEY = 'token';

/** 同步读取 token（用于 `<img src>` / Howler 等非 async 上下文）。 */
export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* localStorage 不可用时静默失败 */
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* noop */
  }
}

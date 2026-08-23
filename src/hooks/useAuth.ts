import { useCallback } from 'react';
import { useUserStore } from '../stores/userStore';
import { setToken, clearToken, getToken } from '../api/token';
import { login as apiLogin, getMe } from '../api/auth';
import type { LoginInput } from '../types';

/**
 * 会话恢复：首次访问时若存在 token，调用 GET /auth/me 校验并填充 userStore。
 *
 * 用模块级 promise 缓存，保证整个应用生命周期只请求一次（即使多个守卫并发触发）。
 * 失败（token 过期/无效）→ 清除 token，auth 保持 false。
 */
let sessionPromise: Promise<void> | null = null;

export function restoreSession(): Promise<void> {
  if (sessionPromise) return sessionPromise;

  sessionPromise = (async () => {
    const token = getToken();
    if (!token) return; // 无 token，无需恢复

    try {
      const me = await getMe();
      useUserStore.getState().setUser(me.name, me.group);
      useUserStore.getState().setAuth(true);
    }
    catch {
      // token 无效，清理
      clearToken();
    }
  })();

  return sessionPromise;
}

/** 重置会话缓存（登出后下次访问重新恢复）。 */
function resetSession(): void {
  sessionPromise = null;
}

/**
 * 认证 hook：提供登录、登出与当前用户状态。
 */
export function useAuth() {
  const auth = useUserStore(s => s.auth);
  const name = useUserStore(s => s.name);
  const group = useUserStore(s => s.group);
  const setUser = useUserStore(s => s.setUser);
  const setAuth = useUserStore(s => s.setAuth);
  const logoutStore = useUserStore(s => s.logout);

  const login = useCallback(
    async (input: LoginInput): Promise<void> => {
      const res = await apiLogin(input);
      setToken(res.token);
      setUser(res.name, res.group);
      setAuth(true);
      // 已恢复过会话，标记完成避免重复请求
      sessionPromise = Promise.resolve();
    },
    [ setUser, setAuth ],
  );

  const logout = useCallback(() => {
    clearToken();
    logoutStore();
    resetSession();
  }, [ logoutStore ]);

  /** 是否管理员（后端 group 值为 'administrator'）。 */
  const isAdmin = group === 'administrator';

  return { auth, name, group, isAdmin, login, logout };
}

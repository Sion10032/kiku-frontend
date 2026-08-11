import { apiFetch } from './client';
import type { LoginInput, LoginResponse, MeResponse } from '../types';

/** 登录：POST /api/auth/me */
export function login(input: LoginInput): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('auth/me', {
    method: 'POST',
    json: input,
  });
}

/** 获取当前登录用户：GET /api/auth/me */
export function getMe(): Promise<MeResponse> {
  return apiFetch<MeResponse>('auth/me');
}

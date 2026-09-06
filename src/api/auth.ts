import { apiFetch } from './client';
import type { LoginInput, LoginResponse, MeResponse } from '../types';

/** 登录：POST /api/auth/login */
export function login(input: LoginInput): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('auth/login', {
    method: 'POST',
    json: input,
  });
}

/** 获取当前登录用户：GET /api/auth/me */
export function getMe(): Promise<MeResponse> {
  return apiFetch<MeResponse>('auth/me');
}

/** 注册：POST /api/auth/register（成功返回登录态） */
export function register(input: LoginInput): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('auth/register', {
    method: 'POST',
    json: input,
  });
}

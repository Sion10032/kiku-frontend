import { apiFetch } from './client';
import type {
  LoginInput,
  LoginResponse,
  MeResponse,
  InstanceMode,
} from '../types';

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

/** Setup 状态：GET /api/auth/setup */
export function getSetupStatus(): Promise<{ needed: boolean; }> {
  return apiFetch<{ needed: boolean; }>('auth/setup');
}

/** Setup 输入：管理员账号 + 实例配置 */
export interface SetupInput {
  name: string;
  password: string;
  instanceMode: InstanceMode;
  allowRegistration: boolean;
}

/** 初始化：POST /api/auth/setup（成功返回登录态） */
export function setup(input: SetupInput): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('auth/setup', {
    method: 'POST',
    json: input,
  });
}

/** 注册：POST /api/auth/register（成功返回登录态） */
export function register(input: LoginInput): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('auth/register', {
    method: 'POST',
    json: input,
  });
}

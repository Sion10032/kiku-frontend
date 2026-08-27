import { apiFetch } from './client';
import type {
  CreateUserInput,
  DeleteUsersInput,
  UpdatePasswordInput,
  User,
} from '../types';

/** 用户列表：GET /api/credentials/users */
export function getUsers(): Promise<User[]> {
  return apiFetch<User[]>('credentials/users');
}

/** 创建用户：POST /api/credentials/user */
export function createUser(input: CreateUserInput): Promise<User> {
  return apiFetch<User>('credentials/user', {
    method: 'POST',
    json: input,
  });
}

/** 更新密码：PUT /api/credentials/user */
export function updatePassword(
  input: UpdatePasswordInput,
): Promise<{ message: string }> {
  return apiFetch<{ message: string }>('credentials/user', {
    method: 'PUT',
    json: input,
  });
}

/** 删除用户：DELETE /api/credentials/user */
export function deleteUsers(
  input: DeleteUsersInput,
): Promise<{ message: string }> {
  return apiFetch<{ message: string }>('credentials/user', {
    method: 'DELETE',
    json: input,
  });
}

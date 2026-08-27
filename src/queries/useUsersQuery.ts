import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getUsers,
  createUser,
  updatePassword,
  deleteUsers,
} from '../api/credentials';
import type {
  CreateUserInput,
  DeleteUsersInput,
  UpdatePasswordInput,
} from '../types';

export const USERS_KEY = ['users'] as const;

/** 用户列表。 */
export function useUsers() {
  return useQuery({
    queryKey: USERS_KEY,
    queryFn: getUsers,
  });
}

/** 创建用户：成功后刷新用户列表。 */
export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateUserInput) => createUser(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: USERS_KEY }),
  });
}

/** 修改密码：成功后刷新用户列表（无列表变化，仅保持语义一致）。 */
export function useUpdatePassword() {
  return useMutation({
    mutationFn: (input: UpdatePasswordInput) => updatePassword(input),
  });
}

/** 删除用户：成功后刷新用户列表。 */
export function useDeleteUsers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: DeleteUsersInput) => deleteUsers(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: USERS_KEY }),
  });
}

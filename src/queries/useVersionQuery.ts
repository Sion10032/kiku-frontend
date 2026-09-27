import { useQuery } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import { getVersion } from '../api/version';
import type { VersionResponse } from '../types';

export const VERSION_KEY = ['version'] as const;

/**
 * 版本信息（GET /api/version）。
 * 该端点在私有模式的后端白名单里，所以无需登录态：未登录打开设置页同样显示。
 */
export function useVersionQuery(): UseQueryResult<VersionResponse> {
  return useQuery({
    queryKey: VERSION_KEY,
    queryFn: getVersion,
  });
}

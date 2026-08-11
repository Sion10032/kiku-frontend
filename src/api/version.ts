import { apiFetch } from './client';
import type { VersionResponse } from '../types';

/** 版本检查：GET /api/version */
export function getVersion(): Promise<VersionResponse> {
  return apiFetch<VersionResponse>('version');
}

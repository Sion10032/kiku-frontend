import { apiFetch } from './client';

/** 迁移状态：GET /api/setup/migration/status（Setup 向导专用，白名单） */
export interface MigrationStatus {
  available: boolean;
  migrated: boolean;
  flavor?: 'number178-fork' | 'vanilla';
  stats?: {
    works: number;
    users: number;
    reviews: number;
    playHistory: number;
    covers: number;
  };
}

export function getMigrationStatus(): Promise<MigrationStatus> {
  return apiFetch<MigrationStatus>('setup/migration/status');
}

/** 执行迁移：POST /api/setup/migration/run */
export function runMigration(): Promise<{ stats: Record<string, number> }> {
  return apiFetch<{ stats: Record<string, number> }>('setup/migration/run', {
    method: 'POST',
  });
}

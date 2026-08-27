import { apiFetch } from './client';

/** 扫描模式：scan=扫盘新增；update=刷新库内作品元数据。 */
export type ScanMode = 'scan' | 'update';

/** 触发扫描：POST /api/scanner/scan */
export function startScan(
  mode: ScanMode = 'scan',
): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>('scanner/scan', {
    method: 'POST',
    json: { mode },
  });
}

/** 终止扫描：POST /api/scanner/kill */
export function killScan(): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>('scanner/kill', { method: 'POST' });
}

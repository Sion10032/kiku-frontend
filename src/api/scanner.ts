import { apiFetch } from './client';

/** 触发扫描：POST /api/scanner/scan */
export function startScan(): Promise<{ success: boolean; }> {
  return apiFetch<{ success: boolean; }>('scanner/scan', { method: 'POST' });
}

/** 终止扫描：POST /api/scanner/kill */
export function killScan(): Promise<{ success: boolean; }> {
  return apiFetch<{ success: boolean; }>('scanner/kill', { method: 'POST' });
}

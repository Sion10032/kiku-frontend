import { M3eSnackbar } from '@m3e/react/snackbar';

/** 统一 API 错误提示：优先展示后端/异常 message，无 message 时用 fallback 文案。 */
export function showApiError(err: unknown, fallback: string): void {
  M3eSnackbar.open(
    err instanceof Error && err.message ? err.message : fallback,
  );
}

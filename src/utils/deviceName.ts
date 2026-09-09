import i18next from 'i18next';

/** localStorage 存储键（自定义设备名） */
const DEVICE_NAME_KEY = 'kiku-device-name';

/** 从 userAgent 推断 OS 名；未知返回空串。 */
function inferOs(userAgent: string): string {
  // Android UA 含 Linux 子串，必须先于 Linux 判定
  if (userAgent.includes('Windows NT')) return 'Windows';
  if (userAgent.includes('Android')) return 'Android';
  if (/iPhone|iPad/.test(userAgent)) return 'iOS';
  if (userAgent.includes('Mac OS X')) return 'macOS';
  if (userAgent.includes('Linux')) return 'Linux';
  return '';
}

/** 从 userAgent 推断浏览器名；未知返回空串。 */
function inferBrowser(userAgent: string): string {
  // Edg/ OPR/ 的 UA 也含 Chrome/，必须先于 Chrome 判定
  if (userAgent.includes('Edg/')) return 'Edge';
  if (userAgent.includes('OPR/')) return 'Opera';
  if (userAgent.includes('Chrome/')) return 'Chrome';
  if (userAgent.includes('Firefox/')) return 'Firefox';
  // 走到这里必然非 Edg/OPR/Chrome/Firefox，可安全视为 Safari
  if (userAgent.includes('Safari/')) return 'Safari';
  return '';
}

/**
 * 纯函数：从 userAgent 推断默认设备名（如「Windows · Chrome」）。
 *
 * - OS 与浏览器各取一段，以「 · 」连接
 * - 某段未知则省略该段（只返回已知段）
 * - 全未知返回空串，由 getDeviceName 兜底
 */
export function inferDeviceName(userAgent: string): string {
  return [inferOs(userAgent), inferBrowser(userAgent)]
    .filter(Boolean)
    .join(' · ');
}

/** 当前设备名：localStorage 自定义名优先；否则 UA 推断，仍为空则兜底（展示时按界面语言翻译）。 */
export function getDeviceName(): string {
  const custom = localStorage.getItem(DEVICE_NAME_KEY)?.trim();
  if (custom) return custom;
  return (
    inferDeviceName(navigator.userAgent)
    || i18next.t('common.default-device-name')
  );
}

/** 保存自定义设备名（trim 后为空串 = 清除，回落 UA 推断）。 */
export function setDeviceName(name: string): void {
  const trimmed = name.trim();
  if (!trimmed) {
    localStorage.removeItem(DEVICE_NAME_KEY);
    return;
  }
  localStorage.setItem(DEVICE_NAME_KEY, trimmed);
}

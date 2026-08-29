import type { CSSProperties } from 'react';

/**
 * 声优 chip 组配色：主色容器 + 主色上文字/图标。
 * 供 WorkCard / WorkDetails 的声优 M3eChipSet 共用。
 */
export const vaChipSetStyles = {
  '--m3e-elevated-chip-container-color': 'var(--md-sys-color-primary)',
  '--m3e-chip-label-text-color': 'var(--md-sys-color-on-primary)',
  '--m3e-chip-icon-color': 'var(--md-sys-color-on-primary)',
} as CSSProperties;

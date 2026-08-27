import type { AdminConfig } from '../../types';

/** AdminConfig 中 number 字段的 key。 */
type NumberKeys = {
  [K in keyof AdminConfig]-?: AdminConfig[K] extends number ? K : never;
}[keyof AdminConfig];

/** AdminConfig 中 string 字段的 key（instanceMode/tagLanguage 等字面量联合属于 string 子类型，包含在内）。 */
type StringKeys = {
  [K in keyof AdminConfig]-?: AdminConfig[K] extends string ? K : never;
}[keyof AdminConfig];

/** AdminConfig 中 boolean 字段的 key。 */
type BoolKeys = {
  [K in keyof AdminConfig]-?: AdminConfig[K] extends boolean ? K : never;
}[keyof AdminConfig];

/** secret/只读字段不出现在表单：md5secret 走独立只写输入框，其余由服务端管理。 */
const EXCLUDED_TEXT = [
  'md5secret',
  'jwtsecret',
  'httpsPrivateKey',
  'httpsCert',
] as const satisfies readonly StringKeys[];
type EditableTextKeys = Exclude<StringKeys, (typeof EXCLUDED_TEXT)[number]>;
type EditableBoolKeys = Exclude<BoolKeys, 'production'>;

export type FieldDef =
  | {
      key: NumberKeys;
      type: 'number';
      label: string;
      min?: number;
      max?: number;
      placeholder?: number;
    }
  | {
      key: EditableTextKeys;
      type: 'text';
      label: string;
      placeholder?: string;
    }
  | { key: EditableBoolKeys; type: 'bool'; label: string }
  | {
      key: 'instanceMode' | 'tagLanguage';
      type: 'select';
      label: string;
      options: Array<{ value: string; label: string }>;
    };

export interface SettingsSectionDef {
  title: string;
  fields: FieldDef[];
}

export const SETTINGS_SECTIONS: SettingsSectionDef[] = [
  {
    title: '通用设置',
    fields: [
      {
        key: 'pageSize',
        type: 'number',
        label: '每页数量',
        min: 1,
        max: 100,
        placeholder: 20,
      },
      {
        key: 'tagLanguage',
        type: 'select',
        label: '标签语言',
        options: [
          { value: 'ja-jp', label: '日语' },
          { value: 'zh-tw', label: '繁体中文' },
          { value: 'zh-cn', label: '简体中文' },
        ],
      },
      {
        key: 'instanceMode',
        type: 'select',
        label: '实例模式',
        options: [
          { value: 'private', label: '私有（需要登录）' },
          { value: 'public', label: '公开（匿名只读）' },
        ],
      },
      { key: 'allowRegistration', type: 'bool', label: '允许注册' },
      { key: 'enableGzip', type: 'bool', label: '启用 Gzip' },
      {
        key: 'rewindSeekTime',
        type: 'number',
        label: '快退秒数',
        min: 0,
        max: 120,
        placeholder: 5,
      },
      {
        key: 'forwardSeekTime',
        type: 'number',
        label: '快进秒数',
        min: 0,
        max: 300,
        placeholder: 30,
      },
      { key: 'checkUpdate', type: 'bool', label: '检查更新' },
      { key: 'checkBetaUpdate', type: 'bool', label: '检查测试版更新' },
    ],
  },
  {
    title: '扫描器设置',
    fields: [
      {
        key: 'scannerMaxRecursionDepth',
        type: 'number',
        label: '最大递归深度',
        min: 0,
        max: 16,
        placeholder: 3,
      },
      {
        key: 'retry',
        type: 'number',
        label: '重试次数',
        min: 0,
        max: 10,
        placeholder: 3,
      },
      {
        key: 'retryDelay',
        type: 'number',
        label: '重试间隔(ms)',
        min: 0,
        max: 600000,
        placeholder: 5000,
      },
      {
        key: 'dlsiteTimeout',
        type: 'number',
        label: 'DLsite 超时(ms)',
        min: 1000,
        max: 300000,
        placeholder: 30000,
      },
      {
        key: 'hvdbTimeout',
        type: 'number',
        label: 'HVDB 超时(ms)',
        min: 1000,
        max: 300000,
        placeholder: 30000,
      },
    ],
  },
  {
    title: '服务器设置',
    fields: [
      {
        key: 'listenPort',
        type: 'number',
        label: '监听端口',
        min: 1,
        max: 65535,
        placeholder: 8888,
      },
      {
        key: 'dbBusyTimeout',
        type: 'number',
        label: '数据库忙超时(ms)',
        min: 0,
        max: 600000,
        placeholder: 5000,
      },
      {
        key: 'expiresIn',
        type: 'number',
        label: 'JWT 有效期(s)',
        min: 60,
        max: 2592000,
        placeholder: 86400,
      },
      {
        key: 'maxParallelism',
        type: 'number',
        label: '最大并行数',
        min: 1,
        max: 32,
        placeholder: 2,
      },
      { key: 'skipCleanup', type: 'bool', label: '跳过清理' },
      { key: 'databaseFolderDir', type: 'text', label: '数据库文件夹' },
    ],
  },
  {
    title: '网络 / 代理',
    fields: [
      {
        key: 'httpProxyHost',
        type: 'text',
        label: 'HTTP 代理主机',
        placeholder: '如 127.0.0.1，留空禁用',
      },
      {
        key: 'httpProxyPort',
        type: 'number',
        label: 'HTTP 代理端口',
        min: 0,
        max: 65535,
        placeholder: 0,
      },
      { key: 'blockRemoteConnection', type: 'bool', label: '禁止远程连接' },
      { key: 'behindProxy', type: 'bool', label: '反向代理' },
      { key: 'httpsEnabled', type: 'bool', label: 'HTTPS 启用' },
      {
        key: 'httpsPort',
        type: 'number',
        label: 'HTTPS 端口',
        min: 1,
        max: 65535,
        placeholder: 443,
      },
    ],
  },
  {
    title: 'Offload 媒体',
    fields: [
      { key: 'offloadMedia', type: 'bool', label: '启用 Offload' },
      {
        key: 'offloadStreamPath',
        type: 'text',
        label: '流媒体路径',
        placeholder: '留空使用默认',
      },
      {
        key: 'offloadDownloadPath',
        type: 'text',
        label: '下载路径',
        placeholder: '留空使用默认',
      },
    ],
  },
];

/** 表单可编辑的全部 key（dirty 检测用）。 */
export const EDITABLE_KEYS = SETTINGS_SECTIONS.flatMap((s) =>
  s.fields.map((f) => f.key),
);

/** 数字字段的 min/max（save 前校验用）。 */
export const NUMBER_FIELDS = new Map(
  SETTINGS_SECTIONS.flatMap((s) => s.fields)
    .filter(
      (f): f is Extract<FieldDef, { type: 'number' }> => f.type === 'number',
    )
    .map((f) => [f.key, { min: f.min, max: f.max }]),
);

/** 数字字段校验：返回首个非法字段的错误文案，全部合法返回 null。 */
export function validateNumbers(draft: AdminConfig): string | null {
  for (const section of SETTINGS_SECTIONS) {
    for (const field of section.fields) {
      if (field.type !== 'number') continue;
      const v = draft[field.key];
      const rule = NUMBER_FIELDS.get(field.key);
      if (!Number.isFinite(v)) return `「${field.label}」不是有效数字`;
      if (rule?.min !== undefined && v < rule.min)
        return `「${field.label}」不能小于 ${rule.min}`;
      if (rule?.max !== undefined && v > rule.max)
        return `「${field.label}」不能大于 ${rule.max}`;
    }
  }
  return null;
}

import type { TFunction } from 'i18next';
import type zhCN from '../../i18n/locales/zh-CN.json';
import type { AdminConfig } from '../../types';

/**
 * 表单文案的字典 key 集合（dashboard.settings.*）。
 * label/description/placeholder/options[].label 等文案字段一律存 key，
 * 渲染处（SettingsSection）经 t() 转换；集合直接取自 zh-CN 字典，
 * key 漏配（含字典删除后残留）在编译期报错。
 */
type SettingsDictKey = Extract<
  keyof typeof zhCN,
  `dashboard.settings.${string}`
>;

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
      label: SettingsDictKey;
      description?: SettingsDictKey;
      min?: number;
      max?: number;
      placeholder?: number;
    }
  | {
      key: EditableTextKeys;
      type: 'text';
      label: SettingsDictKey;
      description?: SettingsDictKey;
      placeholder?: SettingsDictKey;
    }
  | {
      key: EditableBoolKeys;
      type: 'bool';
      label: SettingsDictKey;
      description?: SettingsDictKey;
    }
  | {
      key: 'instanceMode' | 'tagLanguage';
      type: 'select';
      label: SettingsDictKey;
      description?: SettingsDictKey;
      options: Array<{ value: string; label: SettingsDictKey }>;
    };

export interface SettingsSectionDef {
  /** 分组标题的字典 key（渲染处经 t() 转换）。 */
  title: SettingsDictKey;
  fields: FieldDef[];
}

export const SETTINGS_SECTIONS: SettingsSectionDef[] = [
  {
    title: 'dashboard.settings.section-general',
    fields: [
      {
        key: 'pageSize',
        type: 'number',
        label: 'dashboard.settings.page-size',
        description: 'dashboard.settings.page-size-desc',
        min: 1,
        max: 100,
        placeholder: 20,
      },
      {
        key: 'tagLanguage',
        type: 'select',
        label: 'dashboard.settings.tag-language',
        options: [
          { value: 'ja-jp', label: 'dashboard.settings.tag-lang-ja' },
          { value: 'zh-tw', label: 'dashboard.settings.tag-lang-zh-tw' },
          { value: 'zh-cn', label: 'dashboard.settings.tag-lang-zh-cn' },
        ],
      },
      {
        key: 'instanceMode',
        type: 'select',
        label: 'dashboard.settings.instance-mode',
        description: 'dashboard.settings.instance-mode-desc',
        options: [
          {
            value: 'private',
            label: 'dashboard.settings.instance-mode-private',
          },
          {
            value: 'public',
            label: 'dashboard.settings.instance-mode-public',
          },
        ],
      },
      {
        key: 'allowRegistration',
        type: 'bool',
        label: 'dashboard.settings.allow-registration',
        description: 'dashboard.settings.allow-registration-desc',
      },
      {
        key: 'enableGzip',
        type: 'bool',
        label: 'dashboard.settings.enable-gzip',
      },
      {
        key: 'rewindSeekTime',
        type: 'number',
        label: 'dashboard.settings.rewind-seek-time',
        description: 'dashboard.settings.rewind-seek-time-desc',
        min: 0,
        max: 120,
        placeholder: 5,
      },
      {
        key: 'forwardSeekTime',
        type: 'number',
        label: 'dashboard.settings.forward-seek-time',
        description: 'dashboard.settings.forward-seek-time-desc',
        min: 0,
        max: 300,
        placeholder: 30,
      },
      {
        key: 'checkUpdate',
        type: 'bool',
        label: 'dashboard.settings.check-update',
      },
      {
        key: 'checkBetaUpdate',
        type: 'bool',
        label: 'dashboard.settings.check-beta-update',
      },
      {
        key: 'autoLoudnessAnalysis',
        type: 'bool',
        label: 'dashboard.settings.auto-loudness-analysis',
        description: 'dashboard.settings.auto-loudness-analysis-desc',
      },
    ],
  },
  {
    title: 'dashboard.settings.section-scanner',
    fields: [
      {
        key: 'scannerMaxRecursionDepth',
        type: 'number',
        label: 'dashboard.settings.max-recursion-depth',
        description: 'dashboard.settings.max-recursion-depth-desc',
        min: 0,
        max: 16,
        placeholder: 3,
      },
      {
        key: 'retry',
        type: 'number',
        label: 'dashboard.settings.retry',
        description: 'dashboard.settings.retry-desc',
        min: 0,
        max: 10,
        placeholder: 3,
      },
      {
        key: 'retryDelay',
        type: 'number',
        label: 'dashboard.settings.retry-delay',
        description: 'dashboard.settings.retry-delay-desc',
        min: 0,
        max: 600000,
        placeholder: 5000,
      },
      {
        key: 'dlsiteTimeout',
        type: 'number',
        label: 'dashboard.settings.dlsite-timeout',
        description: 'dashboard.settings.dlsite-timeout-desc',
        min: 1000,
        max: 300000,
        placeholder: 30000,
      },
      {
        key: 'hvdbTimeout',
        type: 'number',
        label: 'dashboard.settings.hvdb-timeout',
        description: 'dashboard.settings.hvdb-timeout-desc',
        min: 1000,
        max: 300000,
        placeholder: 30000,
      },
    ],
  },
  {
    title: 'dashboard.settings.section-server',
    fields: [
      {
        key: 'listenPort',
        type: 'number',
        label: 'dashboard.settings.listen-port',
        min: 1,
        max: 65535,
        placeholder: 8888,
      },
      {
        key: 'dbBusyTimeout',
        type: 'number',
        label: 'dashboard.settings.db-busy-timeout',
        description: 'dashboard.settings.db-busy-timeout-desc',
        min: 0,
        max: 600000,
        placeholder: 5000,
      },
      {
        key: 'expiresIn',
        type: 'number',
        label: 'dashboard.settings.expires-in',
        description: 'dashboard.settings.expires-in-desc',
        min: 60,
        max: 2592000,
        placeholder: 86400,
      },
      {
        key: 'maxParallelism',
        type: 'number',
        label: 'dashboard.settings.max-parallelism',
        description: 'dashboard.settings.max-parallelism-desc',
        min: 1,
        max: 32,
        placeholder: 2,
      },
      {
        key: 'skipCleanup',
        type: 'bool',
        label: 'dashboard.settings.skip-cleanup',
      },
      {
        key: 'databaseFolderDir',
        type: 'text',
        label: 'dashboard.settings.database-folder',
      },
    ],
  },
  {
    title: 'dashboard.settings.section-network',
    fields: [
      {
        key: 'httpProxyHost',
        type: 'text',
        label: 'dashboard.settings.proxy-host',
        placeholder: 'dashboard.settings.proxy-host-ph',
      },
      {
        key: 'httpProxyPort',
        type: 'number',
        label: 'dashboard.settings.proxy-port',
        min: 0,
        max: 65535,
        placeholder: 0,
      },
      {
        key: 'blockRemoteConnection',
        type: 'bool',
        label: 'dashboard.settings.block-remote',
      },
      {
        key: 'behindProxy',
        type: 'bool',
        label: 'dashboard.settings.behind-proxy',
      },
      {
        key: 'httpsEnabled',
        type: 'bool',
        label: 'dashboard.settings.https-enabled',
      },
      {
        key: 'httpsPort',
        type: 'number',
        label: 'dashboard.settings.https-port',
        min: 1,
        max: 65535,
        placeholder: 443,
      },
    ],
  },
  {
    title: 'dashboard.settings.section-offload',
    fields: [
      {
        key: 'offloadMedia',
        type: 'bool',
        label: 'dashboard.settings.offload-media',
      },
      {
        key: 'offloadStreamPath',
        type: 'text',
        label: 'dashboard.settings.offload-stream-path',
        placeholder: 'dashboard.settings.offload-path-ph',
      },
      {
        key: 'offloadDownloadPath',
        type: 'text',
        label: 'dashboard.settings.offload-download-path',
        placeholder: 'dashboard.settings.offload-path-ph',
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

/** 数字字段校验：返回首个非法字段的错误文案（经 t 本地化），全部合法返回 null。 */
export function validateNumbers(
  draft: AdminConfig,
  t: TFunction,
): string | null {
  for (const section of SETTINGS_SECTIONS) {
    for (const field of section.fields) {
      if (field.type !== 'number') continue;
      const v = draft[field.key];
      const rule = NUMBER_FIELDS.get(field.key);
      if (!Number.isFinite(v))
        return t('dashboard.settings.error-invalid-number', {
          label: t(field.label),
        });
      if (rule?.min !== undefined && v < rule.min)
        return t('dashboard.settings.error-min', {
          label: t(field.label),
          min: rule.min,
        });
      if (rule?.max !== undefined && v > rule.max)
        return t('dashboard.settings.error-max', {
          label: t(field.label),
          max: rule.max,
        });
    }
  }
  return null;
}

import { useEffect, useState } from 'react';
import { M3eButton } from '@m3e/react/button';
import { M3eCard } from '@m3e/react/card';
import { M3eFormField } from '@m3e/react/form-field';
import { M3eSelect, type M3eSelectElement } from '@m3e/react/select';
import { M3eOption } from '@m3e/react/option';
import { M3eSnackbar } from '@m3e/react/snackbar';
import { getAdminConfig, updateAdminConfig } from '../../api/config';
import type { AdminConfig } from '../../types';

/**
 * 高级设置页面。
 *
 * - GET/PUT /config/admin 表单。
 * - md5secret 只写不回显（密码/secret 类型字段常见模式）。
 * - 其他配置字段展示与编辑。
 */
export default function Advanced() {
  const [config, setConfig] = useState<AdminConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 编辑中的值（从 config 拷贝出来编辑）
  const [form, setForm] = useState<Record<string, unknown>>({});
  // secret 只写字段
  const [secret, setSecret] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const c = await getAdminConfig();
        if (!cancelled) {
          setConfig(c);
          setForm({ ...c });
        }
      } catch (err) {
        M3eSnackbar.open(
          err instanceof Error ? err.message : '加载配置失败',
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function updateField(key: string, value: unknown) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      // 构建 patch：排除只读字段和 secret（如果为空则不发送）
      const patch: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(form)) {
        // 跳过 secret（空值不发送）
        if (key === 'md5secret') continue;
        patch[key] = value;
      }
      // secret 只在用户填写时发送
      if (secret.trim()) {
        patch.md5secret = secret.trim();
      }
      const updated = await updateAdminConfig(patch as Partial<AdminConfig>);
      setConfig(updated);
      setForm({ ...updated });
      setSecret('');
      M3eSnackbar.open('保存成功');
    } catch (err) {
      M3eSnackbar.open(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="opacity-70">加载中…</p>;
  }

  if (!config) {
    return <p className="text-[var(--md-sys-color-error)]">无法加载配置</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 通用设置 */}
      <M3eCard>
        <div slot="header">
          <span className="mb-2 block text-sm font-medium">通用设置</span>
        </div>
        <div slot="content">
          <div className="flex flex-col gap-3">
            <FieldRow
              label="每页数量"
              value={String(form.pageSize ?? '')}
              onChange={(v) => updateField('pageSize', Number(v) || 20)}
            />
            <TagLanguageField
              label="标签语言"
              value={String(form.tagLanguage ?? 'ja-jp')}
              onChange={(v) => updateField('tagLanguage', v)}
            />
            <BoolField
              label="启用 Gzip"
              value={!!form.enableGzip}
              onChange={(v) => updateField('enableGzip', v)}
            />
            <FieldRow
              label="快退秒数"
              value={String(form.rewindSeekTime ?? 5)}
              onChange={(v) => updateField('rewindSeekTime', Number(v) || 5)}
            />
            <FieldRow
              label="快进秒数"
              value={String(form.forwardSeekTime ?? 30)}
              onChange={(v) => updateField('forwardSeekTime', Number(v) || 30)}
            />
            <BoolField
              label="检查更新"
              value={!!form.checkUpdate}
              onChange={(v) => updateField('checkUpdate', v)}
            />
            <BoolField
              label="检查测试版更新"
              value={!!form.checkBetaUpdate}
              onChange={(v) => updateField('checkBetaUpdate', v)}
            />
          </div>
        </div>
      </M3eCard>

      {/* 扫描器设置 */}
      <M3eCard>
        <div slot="header">
          <span className="mb-2 block text-sm font-medium">扫描器设置</span>
        </div>
        <div slot="content">
          <div className="flex flex-col gap-3">
            <FieldRow
              label="最大递归深度"
              value={String(form.scannerMaxRecursionDepth ?? 3)}
              onChange={(v) =>
                updateField('scannerMaxRecursionDepth', Number(v) || 3)
              }
            />
            <FieldRow
              label="重试次数"
              value={String(form.retry ?? 3)}
              onChange={(v) => updateField('retry', Number(v) || 3)}
            />
            <FieldRow
              label="重试间隔(ms)"
              value={String(form.retryDelay ?? 5000)}
              onChange={(v) => updateField('retryDelay', Number(v) || 5000)}
            />
            <FieldRow
              label="DLsite 超时(ms)"
              value={String(form.dlsiteTimeout ?? 30000)}
              onChange={(v) => updateField('dlsiteTimeout', Number(v) || 30000)}
            />
            <FieldRow
              label="HVDB 超时(ms)"
              value={String(form.hvdbTimeout ?? 30000)}
              onChange={(v) => updateField('hvdbTimeout', Number(v) || 30000)}
            />
          </div>
        </div>
      </M3eCard>

      {/* 服务器设置 */}
      <M3eCard>
        <div slot="header">
          <span className="mb-2 block text-sm font-medium">服务器设置</span>
        </div>
        <div slot="content">
          <div className="flex flex-col gap-3">
            <FieldRow
              label="监听端口"
              value={String(form.listenPort ?? 8888)}
              onChange={(v) => updateField('listenPort', Number(v) || 8888)}
            />
            <FieldRow
              label="数据库忙超时(ms)"
              value={String(form.dbBusyTimeout ?? 5000)}
              onChange={(v) => updateField('dbBusyTimeout', Number(v) || 5000)}
            />
            <FieldRow
              label="JWT 有效期(s)"
              value={String(form.expiresIn ?? 86400)}
              onChange={(v) => updateField('expiresIn', Number(v) || 86400)}
            />
            <FieldRow
              label="最大并行数"
              value={String(form.maxParallelism ?? 2)}
              onChange={(v) => updateField('maxParallelism', Number(v) || 2)}
            />
            <BoolField
              label="跳过清理"
              value={!!form.skipCleanup}
              onChange={(v) => updateField('skipCleanup', v)}
            />
          </div>
        </div>
      </M3eCard>

      {/* 网络 / 代理 */}
      <M3eCard>
        <div slot="header">
          <span className="mb-2 block text-sm font-medium">网络 / 代理</span>
        </div>
        <div slot="content">
          <div className="flex flex-col gap-3">
            <FieldRow
              label="HTTP 代理主机"
              value={String(form.httpProxyHost ?? '')}
              onChange={(v) => updateField('httpProxyHost', v)}
            />
            <FieldRow
              label="HTTP 代理端口"
              value={String(form.httpProxyPort ?? 0)}
              onChange={(v) => updateField('httpProxyPort', Number(v) || 0)}
            />
            <BoolField
              label="禁止远程连接"
              value={!!form.blockRemoteConnection}
              onChange={(v) => updateField('blockRemoteConnection', v)}
            />
            <BoolField
              label="反向代理"
              value={!!form.behindProxy}
              onChange={(v) => updateField('behindProxy', v)}
            />
            <BoolField
              label="HTTPS 启用"
              value={!!form.httpsEnabled}
              onChange={(v) => updateField('httpsEnabled', v)}
            />
            <FieldRow
              label="HTTPS 端口"
              value={String(form.httpsPort ?? 443)}
              onChange={(v) => updateField('httpsPort', Number(v) || 443)}
            />
          </div>
        </div>
      </M3eCard>

      {/* Offload 媒体 */}
      <M3eCard>
        <div slot="header">
          <span className="mb-2 block text-sm font-medium">Offload 媒体</span>
        </div>
        <div slot="content">
          <div className="flex flex-col gap-3">
            <BoolField
              label="启用 Offload"
              value={!!form.offloadMedia}
              onChange={(v) => updateField('offloadMedia', v)}
            />
            <FieldRow
              label="流媒体路径"
              value={String(form.offloadStreamPath ?? '')}
              onChange={(v) => updateField('offloadStreamPath', v)}
            />
            <FieldRow
              label="下载路径"
              value={String(form.offloadDownloadPath ?? '')}
              onChange={(v) => updateField('offloadDownloadPath', v)}
            />
          </div>
        </div>
      </M3eCard>

      {/* 安全（secret 只写不回显） */}
      <M3eCard>
        <div slot="header">
          <span className="mb-2 block text-sm font-medium">安全设置</span>
        </div>
        <div slot="content">
          <div className="flex flex-col gap-3">
            {/* md5secret：只写，不回显已存储的值 */}
            <M3eFormField variant="outlined" hideSubscript="always">
              <label slot="label" htmlFor="md5secret">
                MD5 Secret（留空则不修改）
              </label>
              <input
                id="md5secret"
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="输入新 secret…"
                className="w-full border-none bg-transparent py-2 text-sm outline-none"
              />
            </M3eFormField>
            <FieldRow
              label="Cover 文件夹"
              value={String(form.coverFolderDir ?? '')}
              onChange={(v) => updateField('coverFolderDir', v)}
            />
            <FieldRow
              label="数据库文件夹"
              value={String(form.databaseFolderDir ?? '')}
              onChange={(v) => updateField('databaseFolderDir', v)}
            />
          </div>
        </div>
      </M3eCard>

      {/* 保存按钮 */}
      <div className="flex justify-end">
        <M3eButton variant="filled" disabled={saving} onClick={handleSave}>
          {saving ? '保存中…' : '保存所有设置'}
        </M3eButton>
      </div>
    </div>
  );
}

/** 通用表单行：M3eFormField 包裹 input。 */
function FieldRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const id = `field-${label}`;
  return (
    <M3eFormField variant="outlined" hideSubscript="always">
      <label slot="label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border-none bg-transparent py-2 text-sm outline-none"
      />
    </M3eFormField>
  );
}

/** 布尔字段：M3eSelect 选择是/否。 */
function BoolField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const id = `field-${label}`;
  return (
    <M3eFormField variant="outlined" hideSubscript="always">
      <label slot="label" htmlFor={id}>
        {label}
      </label>
      <M3eSelect
        id={id}
        onChange={(e) => onChange((e.target as M3eSelectElement).value === 'true')}
      >
        <M3eOption value="true" selected={value}>是</M3eOption>
        <M3eOption value="false" selected={!value}>否</M3eOption>
      </M3eSelect>
    </M3eFormField>
  );
}

/** 标签语言选择。 */
function TagLanguageField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const id = `field-${label}`;
  const options: { value: string; label: string }[] = [
    { value: 'ja-jp', label: '日语' },
    { value: 'zh-tw', label: '繁体中文' },
    { value: 'zh-cn', label: '简体中文' },
  ];
  return (
    <M3eFormField variant="outlined" hideSubscript="always">
      <label slot="label" htmlFor={id}>
        {label}
      </label>
      <M3eSelect
        id={id}
        onChange={(e) => onChange(String((e.target as M3eSelectElement).value ?? ''))}
      >
        {options.map((opt) => (
          <M3eOption key={opt.value} value={opt.value} selected={opt.value === value}>
            {opt.label}
          </M3eOption>
        ))}
      </M3eSelect>
    </M3eFormField>
  );
}

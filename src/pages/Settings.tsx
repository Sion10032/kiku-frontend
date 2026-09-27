import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { M3eCard } from '@m3e/react/card';
import { M3eButton } from '@m3e/react/button';
import { M3eDialog } from '@m3e/react/dialog';
import { M3eFormField } from '@m3e/react/form-field';
import { M3eSelect, type M3eSelectElement } from '@m3e/react/select';
import { M3eOption } from '@m3e/react/option';
import { M3eSnackbar } from '@m3e/react/snackbar';
import ConfirmDialog from '../components/ConfirmDialog';
import PageContainer from '../components/common/PageContainer';
import VersionCard from '../components/VersionCard';
import { SETTING_CONTROL_FILL, SETTING_ROW_LAYOUT } from '../constants';
import {
  useBackupSettingsMutation,
  useDeleteSettingBackupMutation,
  useRestoreSettingsMutation,
  useSettingBackups,
} from '../queries/useSettingsBackup';
import { showApiError } from '../utils/apiError';
import { getDeviceName } from '../utils/deviceName';
import { useUserStore } from '../stores/userStore';
import AppearanceSection from './settings/AppearanceSection';
import FloatingLyricsSection from './settings/FloatingLyricsSection';
import LibrarySection from './settings/LibrarySection';
import PlaybackSection from './settings/PlaybackSection';

/**
 * 设置页：本地偏好（settingsStore / playerStore，localStorage 持久化）
 * 改动即时生效，无需保存按钮；按领域分为四组，每组一张卡片。
 *
 * - 外观：语言 / 颜色模式 / 界面大小 / 内容宽度 / 动态取色
 *   （动态取色开启后进入作品详情时从封面提取主题种子色，
 *   关闭瞬间恢复默认紫 #6750A4；颜色模式 auto/light/dark 经 ThemeRoot
 *   传给 M3eTheme；界面大小全局缩放 80%–130%，首次使用自动选择一次；
 *   内容宽度为内容页容器上限档位，见 PageContainer）
 * - 作品库：R-18 封面 / 翻页方式 / 分页控件位置 / 每页数量 / 最近收听
 * - 播放器：时间显示 / 媒体通知 / 快退快进秒数（playerStore）/
 *   音量均衡（目标响度、最大增益）
 * - 悬浮歌词：LyricsBar 的字体大小 / 换行行数上限 / 背景透明度
 *   （无分组标题，开关行即标题行，维持原有独立卡片）
 * - 设置备份：登录后可将当前设置备份到云端（每用户上限 10 条），
 *   支持按配置还原 / 删除；未登录时按钮禁用、不发请求
 * - 版本信息：前端构建期注入 + 服务端 /api/version，见 components/VersionCard
 */
export default function Settings() {
  const { t } = useTranslation();

  return (
    <PageContainer base='form' className='flex flex-col gap-4'>
      <h1 className='m-0 text-2xl font-normal'>{t('settings.title')}</h1>
      {/* 云端设置备份：登录可用，实现见文件底部 SettingsBackupCard */}
      <SettingsBackupCard />

      {/* 外观 */}
      <M3eCard>
        <div slot='content' className='flex flex-col gap-6'>
          <AppearanceSection />
        </div>
      </M3eCard>

      {/* 作品库 */}
      <M3eCard>
        <div slot='content' className='flex flex-col gap-6'>
          <LibrarySection />
        </div>
      </M3eCard>

      {/* 播放器 */}
      <M3eCard>
        <div slot='content' className='flex flex-col gap-6'>
          <PlaybackSection />
        </div>
      </M3eCard>

      {/* 悬浮歌词 */}
      <M3eCard>
        <div slot='content' className='flex flex-col gap-6'>
          <FloatingLyricsSection />
        </div>
      </M3eCard>

      {/* 版本信息：无交互，纯展示（前端构建期注入 + 服务端接口） */}
      <VersionCard />
    </PageContainer>
  );
}

/** 后端每用户设置备份数量上限（409 超限提示由后端给出；前端仅用于计数展示） */
const BACKUP_LIMIT = 10;

/**
 * 格式化 ISO 时间为本地日期 YYYY-MM-DD（备份 option 副文本 / 还原行文案）。
 * utils/format 无日期工具，此处局部实现；非法时间原样返回。
 */
function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * 设置备份卡片：登录后可用（未登录提示「登录后可用」，按钮全部禁用）。
 *
 * - 行 1：选择云端配置（option 副文本为 updatedAt 日期）+ 新增 / 删除
 * - 行 2：选中配置后可「备份到此配置」（覆盖）/「还原」（ConfirmDialog 二次确认）
 * - 新增：M3eDialog 内输入配置名（默认取 getDeviceName()），
 *   确认后以当前设置备份到该名字（同名覆盖）
 * - 反馈：M3eSnackbar（已备份 / 已还原 / 已删除；错误经 showApiError
 *   展示后端 message，409 超上限时即「最多保留 10 条备份」）
 * - 全手动操作：无自动备份 / 自动还原逻辑
 */
function SettingsBackupCard() {
  const { t } = useTranslation();
  const auth = useUserStore((s) => s.auth);
  const backupsQuery = useSettingBackups();
  const backupMutation = useBackupSettingsMutation();
  const restoreMutation = useRestoreSettingsMutation();
  const deleteMutation = useDeleteSettingBackupMutation();

  // 列表 query enabled: auth，未登录天然不发请求
  const backups = backupsQuery.data?.backups ?? [];
  const [selectedName, setSelectedName] = useState('');
  // selectedName 可能因列表刷新失效，find 不到时不渲染行 2
  const selected = backups.find((b) => b.name === selectedName) ?? null;

  // 新增对话框（每次打开都以当前设备名为默认配置名）
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');

  // 还原二次确认
  const [confirmRestore, setConfirmRestore] = useState(false);

  /** select.value 为 getter-only，经事件读取（同 Works.tsx 排序选择） */
  function onSelectChange(e: Event) {
    const value = (e.target as M3eSelectElement).value;
    setSelectedName(typeof value === 'string' ? value : '');
  }

  function openAdd() {
    setNewName(getDeviceName());
    setAddOpen(true);
  }

  /** 以当前设置备份到指定名字（新增对话框 / 「备份到此配置」共用） */
  async function backupTo(name: string): Promise<boolean> {
    try {
      await backupMutation.mutateAsync(name);
      M3eSnackbar.open(t('settings.backup-success'));
      return true;
    } catch (err) {
      // 409（超上限）等业务错误展示后端 message
      showApiError(err, t('settings.backup-failed'));
      return false;
    }
  }

  async function onAddConfirm() {
    const name = newName.trim();
    if (!name || backupMutation.isPending) return;
    if (await backupTo(name)) {
      setAddOpen(false);
      // 备份完成后选中该配置，便于接着还原 / 删除
      setSelectedName(name);
    }
  }

  async function onDelete() {
    if (!selectedName || deleteMutation.isPending) return;
    try {
      await deleteMutation.mutateAsync(selectedName);
      M3eSnackbar.open(t('settings.delete-success'));
      setSelectedName(''); // 删除的即当前选中项
    } catch (err) {
      showApiError(err, t('settings.delete-failed'));
    }
  }

  async function onRestoreConfirm() {
    if (!selectedName || restoreMutation.isPending) return;
    try {
      await restoreMutation.mutateAsync(selectedName);
      M3eSnackbar.open(t('settings.restore-success'));
    } catch (err) {
      showApiError(err, t('settings.restore-failed'));
    } finally {
      setConfirmRestore(false);
    }
  }

  return (
    <>
      <M3eCard>
        <div slot='content' className='flex flex-col gap-6'>
          {/* 标题行：设置备份 + n / 10 计数 */}
          <div className='flex items-center justify-between gap-4'>
            <span>{t('settings.backup-title')}</span>
            <span className='text-sm tabular-nums opacity-70'>
              {backups.length} / {BACKUP_LIMIT}
            </span>
          </div>

          {!auth && (
            <p className='m-0 text-sm opacity-70'>
              {t('settings.requires-login')}
            </p>
          )}

          {/* 行 1：选择配置 + 新增 / 删除 */}
          <div className={SETTING_ROW_LAYOUT}>
            <M3eFormField
              variant='outlined'
              hideSubscript='always'
              className={`${SETTING_CONTROL_FILL} min-w-48 [--m3e-form-field-width:12rem]`}
            >
              <label slot='label' htmlFor='settings-backup-select'>
                {t('settings.select-config')}
              </label>
              <M3eSelect
                id='settings-backup-select'
                disabled={!auth}
                onChange={onSelectChange}
              >
                {/* 关闭态仅显示配置名，日期只在 option 副文本中展示 */}
                {selectedName && <span slot='value'>{selectedName}</span>}
                {backups.map((b) => (
                  <M3eOption
                    key={b.name}
                    value={b.name}
                    selected={b.name === selectedName}
                  >
                    {b.name}
                    <span className='opacity-60'>
                      {t('settings.option-date', {
                        date: formatDate(b.updatedAt),
                      })}
                    </span>
                  </M3eOption>
                ))}
              </M3eSelect>
            </M3eFormField>
            <div className='flex shrink-0 gap-2'>
              <M3eButton variant='filled' disabled={!auth} onClick={openAdd}>
                {t('settings.add')}
              </M3eButton>
              <M3eButton
                variant='text'
                className='text-[var(--md-sys-color-error)]'
                disabled={!auth || !selectedName || deleteMutation.isPending}
                onClick={onDelete}
              >
                {t('settings.delete')}
              </M3eButton>
            </div>
          </div>

          {/* 行 2：选中配置后显示，备份到此配置（覆盖）/ 还原 */}
          {selected && (
            <div className={SETTING_ROW_LAYOUT}>
              <span className='text-sm opacity-70'>
                {t('settings.backed-up-at', {
                  name: selected.name,
                  date: formatDate(selected.updatedAt),
                })}
              </span>
              <div className='flex shrink-0 gap-2'>
                <M3eButton
                  variant='outlined'
                  disabled={backupMutation.isPending}
                  onClick={() => backupTo(selected.name)}
                >
                  {t('settings.backup-to-config')}
                </M3eButton>
                <M3eButton
                  variant='tonal'
                  disabled={restoreMutation.isPending}
                  onClick={() => setConfirmRestore(true)}
                >
                  {t('settings.restore')}
                </M3eButton>
              </div>
            </div>
          )}
        </div>
      </M3eCard>

      {/* 新增备份对话框（常驻挂载 + open 控制，同 FavDialog） */}
      <M3eDialog
        open={addOpen}
        onClosed={() => setAddOpen(false)}
        dismissible
        closeLabel={t('settings.close')}
      >
        <span slot='header'>{t('settings.add-backup')}</span>
        <div className='flex flex-col gap-4 py-2'>
          <M3eFormField variant='outlined' className='w-full'>
            <label slot='label' htmlFor='settings-backup-name'>
              {t('settings.config-name')}
            </label>
            <input
              id='settings-backup-name'
              type='text'
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className='w-full border-none bg-transparent py-2 text-sm outline-none'
            />
          </M3eFormField>
        </div>
        <div slot='actions' className='flex justify-end gap-2'>
          <M3eButton variant='text' onClick={() => setAddOpen(false)}>
            {t('settings.cancel')}
          </M3eButton>
          <M3eButton
            variant='filled'
            disabled={!newName.trim() || backupMutation.isPending}
            onClick={onAddConfirm}
          >
            {backupMutation.isPending
              ? t('settings.backing-up')
              : t('settings.backup')}
          </M3eButton>
        </div>
      </M3eDialog>

      {/* 还原二次确认：覆盖当前本地设置（项目通用 ConfirmDialog） */}
      <ConfirmDialog
        open={confirmRestore}
        title={t('settings.restore-title')}
        message={
          selectedName
            ? t('settings.restore-confirm', { name: selectedName })
            : ''
        }
        confirmLabel={t('settings.restore')}
        onConfirm={onRestoreConfirm}
        onCancel={() => setConfirmRestore(false)}
      />
    </>
  );
}

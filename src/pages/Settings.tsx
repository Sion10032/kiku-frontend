import { useState } from 'react';
import i18next from 'i18next';
import { useTranslation } from 'react-i18next';
import { M3eCard } from '@m3e/react/card';
import { M3eSwitch } from '@m3e/react/switch';
import { M3eButton } from '@m3e/react/button';
import { M3eDialog } from '@m3e/react/dialog';
import { M3eFormField } from '@m3e/react/form-field';
import { M3eSelect, type M3eSelectElement } from '@m3e/react/select';
import { M3eOption } from '@m3e/react/option';
import { M3eSnackbar } from '@m3e/react/snackbar';
import {
  M3eSegmentedButton,
  M3eButtonSegment,
} from '@m3e/react/segmented-button';
import { M3eSlider, M3eSliderThumb } from '@m3e/react/slider';
import type { M3eSliderThumbElement } from '@m3e/react/slider';
import ConfirmDialog from '../components/ConfirmDialog';
import { SETTING_CONTROL_FILL, SETTING_ROW_LAYOUT } from '../constants';
import { setLanguage, type Locale } from '../i18n';
import {
  useBackupSettingsMutation,
  useDeleteSettingBackupMutation,
  useRestoreSettingsMutation,
  useSettingBackups,
} from '../queries/useSettingsBackup';
import { showApiError } from '../utils/apiError';
import { getDeviceName } from '../utils/deviceName';
import { useUserStore } from '../stores/userStore';
import {
  useSettingsStore,
  type ColorMode,
  type CoverBlurMode,
  type TimeDisplayMode,
  type WorksPaginationMode,
  type WorksPaginatorPosition,
} from '../stores/settingsStore';
import { useThemeStore, DEFAULT_SEED } from '../stores/themeStore';

const COLOR_MODES: {
  value: ColorMode;
  label: `settings.color-mode-${ColorMode}`;
}[] = [
  { value: 'auto', label: 'settings.color-mode-auto' },
  { value: 'light', label: 'settings.color-mode-light' },
  { value: 'dark', label: 'settings.color-mode-dark' },
];

const LYRIC_LINE_COUNTS = [1, 2, 3];

const COVER_BLUR_MODES: {
  value: CoverBlurMode;
  label: `settings.cover-blur-${CoverBlurMode}`;
}[] = [
  { value: 'always', label: 'settings.cover-blur-always' },
  { value: 'hover', label: 'settings.cover-blur-hover' },
  { value: 'never', label: 'settings.cover-blur-never' },
];

const TIME_DISPLAY_MODES: {
  value: TimeDisplayMode;
  label: `settings.time-display-${TimeDisplayMode}`;
}[] = [
  { value: 'total', label: 'settings.time-display-total' },
  { value: 'remaining', label: 'settings.time-display-remaining' },
];

const WORKS_PAGINATION_MODES: {
  value: WorksPaginationMode;
  label: `settings.works-pagination-${WorksPaginationMode}`;
}[] = [
  { value: 'paginate', label: 'settings.works-pagination-paginate' },
  { value: 'infinite', label: 'settings.works-pagination-infinite' },
];

const WORKS_PAGINATOR_POSITIONS: {
  value: WorksPaginatorPosition;
  label: `settings.paginator-position-${WorksPaginatorPosition}`;
}[] = [
  { value: 'top', label: 'settings.paginator-position-top' },
  { value: 'bottom', label: 'settings.paginator-position-bottom' },
  { value: 'both', label: 'settings.paginator-position-both' },
];

/**
 * 设置页：本地偏好（settingsStore，localStorage 持久化）改动即时生效，
 * 无需保存按钮；顶部另含设置备份卡片（依赖登录态）。
 *
 * - 设置备份：登录后可将当前设置备份到云端（每用户上限 10 条），
 *   支持按配置还原 / 删除；未登录时按钮禁用、不发请求
 * - 动态取色：开启后进入作品详情时从封面提取主题种子色；
 *   关闭瞬间恢复默认紫（#6750A4），详情页不再换色
 * - 颜色模式：auto / light / dark，经 ThemeRoot 传给 M3eTheme
 * - 界面大小：全局缩放（80%–130%），首次使用按屏幕像素密度自动选择一次
 * - 媒体通知：开关 MediaSession（锁屏/系统媒体面板），useMediaSession 读取
 * - 时间显示：总时长（22:33）/ 剩余时间（-1:39），作用 PlayerBar 与全屏播放器
 * - 作品库翻页方式：分页（可跳页）/ 无限滚动
 * - 分页控件位置：作品库分页控件显示在顶部 / 底部 / 顶部和底部
 * - 最近收听：作品库首页是否显示「最近收听」条
 * - 悬浮歌词：LyricsBar 的字体大小 / 换行行数上限 / 背景透明度
 */
export default function Settings() {
  const { t } = useTranslation();
  const dynamicColor = useSettingsStore((s) => s.dynamicColor);
  const colorMode = useSettingsStore((s) => s.colorMode);
  const setDynamicColor = useSettingsStore((s) => s.setDynamicColor);
  const setColorMode = useSettingsStore((s) => s.setColorMode);
  const mediaNotification = useSettingsStore((s) => s.mediaNotification);
  const setMediaNotification = useSettingsStore((s) => s.setMediaNotification);
  const loudnessNormalization = useSettingsStore(
    (s) => s.loudnessNormalization,
  );
  const setLoudnessNormalization = useSettingsStore(
    (s) => s.setLoudnessNormalization,
  );
  const loudnessTargetLufs = useSettingsStore((s) => s.loudnessTargetLufs);
  const setLoudnessTargetLufs = useSettingsStore(
    (s) => s.setLoudnessTargetLufs,
  );
  const loudnessMaxGainDb = useSettingsStore((s) => s.loudnessMaxGainDb);
  const setLoudnessMaxGainDb = useSettingsStore((s) => s.setLoudnessMaxGainDb);
  const floatingLyrics = useSettingsStore((s) => s.floatingLyrics);
  const setFloatingLyrics = useSettingsStore((s) => s.setFloatingLyrics);
  const coverBlurMode = useSettingsStore((s) => s.coverBlurMode);
  const setCoverBlurMode = useSettingsStore((s) => s.setCoverBlurMode);
  const timeDisplayMode = useSettingsStore((s) => s.timeDisplayMode);
  const setTimeDisplayMode = useSettingsStore((s) => s.setTimeDisplayMode);
  const worksPaginationMode = useSettingsStore((s) => s.worksPaginationMode);
  const setWorksPaginationMode = useSettingsStore(
    (s) => s.setWorksPaginationMode,
  );
  const worksPaginatorPosition = useSettingsStore(
    (s) => s.worksPaginatorPosition,
  );
  const setWorksPaginatorPosition = useSettingsStore(
    (s) => s.setWorksPaginatorPosition,
  );
  const worksHistoryStrip = useSettingsStore((s) => s.worksHistoryStrip);
  const setShowHistoryStrip = useSettingsStore((s) => s.setShowHistoryStrip);
  const uiScale = useSettingsStore((s) => s.uiScale);
  const setUiScale = useSettingsStore((s) => s.setUiScale);

  // select.value 为 getter-only，经事件读取（同下方备份配置选择）
  function onLanguageChange(e: Event) {
    const value = (e.target as M3eSelectElement).value;
    if (typeof value === 'string') setLanguage(value as Locale);
  }

  return (
    <div className='mx-auto flex max-w-2xl flex-col gap-4'>
      <h1 className='m-0 text-2xl font-normal'>{t('settings.title')}</h1>
      {/* 云端设置备份：登录可用，实现见文件底部 SettingsBackupCard */}
      <SettingsBackupCard />
      <M3eCard>
        <div slot='content' className='flex flex-col gap-6'>
          {/* 语言 */}
          <div className={SETTING_ROW_LAYOUT}>
            <span className='flex flex-col'>
              <span>{t('settings.language')}</span>
              <span className='text-sm opacity-70'>
                {t('settings.language-desc')}
              </span>
            </span>
            <M3eSelect
              className={SETTING_CONTROL_FILL}
              onChange={onLanguageChange}
            >
              {/* 选项文案为语言自称，不随界面语言翻译 */}
              <M3eOption value='zh-CN' selected={i18next.language === 'zh-CN'}>
                简体中文
              </M3eOption>
              <M3eOption value='en' selected={i18next.language === 'en'}>
                English
              </M3eOption>
            </M3eSelect>
          </div>

          {/* 颜色模式：窄屏时标签与分段按钮上下堆叠，避免横向溢出 */}
          <div className={SETTING_ROW_LAYOUT}>
            <span>{t('settings.color-mode')}</span>
            {/* 注意：组的 value 是 getter-only 派生属性（同 radio-group），
                受控方式是给每个 M3eButtonSegment 传 checked */}
            <M3eSegmentedButton
              className={SETTING_CONTROL_FILL}
              onInput={(e) =>
                setColorMode((e.target as HTMLInputElement).value as ColorMode)
              }
            >
              {COLOR_MODES.map((m) => (
                <M3eButtonSegment
                  key={m.value}
                  value={m.value}
                  checked={colorMode === m.value}
                >
                  {t(m.label)}
                </M3eButtonSegment>
              ))}
            </M3eSegmentedButton>
          </div>

          {/* 界面大小：rem 尺寸体系，改 html font-size 全屏等比缩放；
              自动仅在首次使用时按屏幕像素密度推断一次 */}
          <div className='flex flex-col gap-2'>
            <div className='flex items-center justify-between gap-4'>
              <span className='flex flex-col'>
                <span>{t('settings.ui-scale')}</span>
              </span>
              <span className='shrink-0 text-sm tabular-nums opacity-70'>
                {uiScale}%
              </span>
            </div>
            <M3eSlider
              min={80}
              max={130}
              step={5}
              labelled
              onInput={(e) =>
                setUiScale((e.target as M3eSliderThumbElement).value ?? 100)
              }
            >
              <M3eSliderThumb value={uiScale} />
            </M3eSlider>
          </div>

          {/* 动态取色 */}
          <div className='flex cursor-pointer items-center justify-between gap-4'>
            <span className='flex flex-col'>
              <span>{t('settings.dynamic-color')}</span>
              <span className='text-sm opacity-70'>
                {t('settings.dynamic-color-desc')}
              </span>
            </span>
            <M3eSwitch
              checked={dynamicColor}
              onInput={(e) => {
                const on = (e.target as HTMLInputElement).checked;
                setDynamicColor(on);
                // 关闭瞬间回归默认紫，避免停留在最后一次取色结果
                if (!on) useThemeStore.getState().setSeed(DEFAULT_SEED);
              }}
            />
          </div>

          {/* R-18 封面 */}
          <div className={SETTING_ROW_LAYOUT}>
            <span className='flex flex-col'>
              <span>{t('settings.r18-cover')}</span>
              <span className='text-sm opacity-70'>
                {t('settings.r18-cover-desc')}
              </span>
            </span>
            <M3eSegmentedButton
              className={SETTING_CONTROL_FILL}
              onInput={(e) =>
                setCoverBlurMode(
                  (e.target as HTMLInputElement).value as CoverBlurMode,
                )
              }
            >
              {COVER_BLUR_MODES.map((m) => (
                <M3eButtonSegment
                  key={m.value}
                  value={m.value}
                  checked={coverBlurMode === m.value}
                >
                  {t(m.label)}
                </M3eButtonSegment>
              ))}
            </M3eSegmentedButton>
          </div>

          {/* 时间显示模式 */}
          <div className={SETTING_ROW_LAYOUT}>
            <span className='flex flex-col'>
              <span>{t('settings.time-display')}</span>
              <span className='text-sm opacity-70'>
                {t('settings.time-display-desc')}
              </span>
            </span>
            <M3eSegmentedButton
              className={SETTING_CONTROL_FILL}
              onInput={(e) =>
                setTimeDisplayMode(
                  (e.target as HTMLInputElement).value as TimeDisplayMode,
                )
              }
            >
              {TIME_DISPLAY_MODES.map((m) => (
                <M3eButtonSegment
                  key={m.value}
                  value={m.value}
                  checked={timeDisplayMode === m.value}
                >
                  {t(m.label)}
                </M3eButtonSegment>
              ))}
            </M3eSegmentedButton>
          </div>

          {/* 作品库翻页方式 */}
          <div className={SETTING_ROW_LAYOUT}>
            <span className='flex flex-col'>
              <span>{t('settings.works-pagination')}</span>
              <span className='text-sm opacity-70'>
                {t('settings.works-pagination-desc')}
              </span>
            </span>
            <M3eSegmentedButton
              className={SETTING_CONTROL_FILL}
              onInput={(e) =>
                setWorksPaginationMode(
                  (e.target as HTMLInputElement).value as WorksPaginationMode,
                )
              }
            >
              {WORKS_PAGINATION_MODES.map((m) => (
                <M3eButtonSegment
                  key={m.value}
                  value={m.value}
                  checked={worksPaginationMode === m.value}
                >
                  {t(m.label)}
                </M3eButtonSegment>
              ))}
            </M3eSegmentedButton>
          </div>

          {/* 分页控件显示位置 */}
          <div className={SETTING_ROW_LAYOUT}>
            <span className='flex flex-col'>
              <span>{t('settings.paginator-position')}</span>
              <span className='text-sm opacity-70'>
                {t('settings.paginator-position-desc')}
              </span>
            </span>
            <M3eSegmentedButton
              className={SETTING_CONTROL_FILL}
              onInput={(e) =>
                setWorksPaginatorPosition(
                  (e.target as HTMLInputElement)
                    .value as WorksPaginatorPosition,
                )
              }
            >
              {WORKS_PAGINATOR_POSITIONS.map((p) => (
                <M3eButtonSegment
                  key={p.value}
                  value={p.value}
                  checked={worksPaginatorPosition === p.value}
                >
                  {t(p.label)}
                </M3eButtonSegment>
              ))}
            </M3eSegmentedButton>
          </div>

          {/* 最近收听条 */}
          <div className='flex cursor-pointer items-center justify-between gap-4'>
            <span className='flex flex-col'>
              <span>{t('settings.recent-listens')}</span>
              <span className='text-sm opacity-70'>
                {t('settings.recent-listens-desc')}
              </span>
            </span>
            <M3eSwitch
              checked={worksHistoryStrip}
              onInput={(e) =>
                setShowHistoryStrip((e.target as HTMLInputElement).checked)
              }
            />
          </div>

          {/* 媒体通知 */}
          <div className='flex cursor-pointer items-center justify-between gap-4'>
            <span className='flex flex-col'>
              <span>{t('settings.media-notification')}</span>
              <span className='text-sm opacity-70'>
                {t('settings.media-notification-desc')}
              </span>
            </span>
            <M3eSwitch
              checked={mediaNotification}
              onInput={(e) =>
                setMediaNotification((e.target as HTMLInputElement).checked)
              }
            />
          </div>

          {/* 音量均衡：客户端开关，播放时应用服务器已算好的均衡增益 */}
          <div className='flex cursor-pointer items-center justify-between gap-4'>
            <span className='flex flex-col'>
              <span>{t('settings.loudness-normalization')}</span>
              <span className='text-sm opacity-70'>
                {t('settings.loudness-normalization-desc')}
              </span>
            </span>
            <M3eSwitch
              checked={loudnessNormalization}
              onInput={(e) =>
                setLoudnessNormalization((e.target as HTMLInputElement).checked)
              }
            />
          </div>

          {/* 目标响度：均衡开启时可调，关闭时禁用；范围与响度曲线 y 轴 [-40, 0] 对应 */}
          <div className='flex flex-col gap-2'>
            <div className='flex items-center justify-between gap-4'>
              <span className='flex flex-col'>
                <span className={loudnessNormalization ? '' : 'opacity-50'}>
                  {t('settings.loudness-target-lufs')}
                </span>
                <span className='text-sm opacity-70'>
                  {t('settings.loudness-target-lufs-desc')}
                </span>
              </span>
              <span className='text-sm tabular-nums opacity-70'>
                {loudnessTargetLufs} LUFS
              </span>
            </div>
            <M3eSlider
              min={-40}
              max={0}
              step={1}
              labelled
              disabled={!loudnessNormalization}
              onInput={(e) =>
                setLoudnessTargetLufs(
                  (e.target as M3eSliderThumbElement).value ?? -28,
                )
              }
            >
              <M3eSliderThumb value={loudnessTargetLufs} />
            </M3eSlider>
          </div>

          {/* 最大增益：均衡开启时可调，关闭时禁用 */}
          <div className='flex flex-col gap-2'>
            <div className='flex items-center justify-between gap-4'>
              <span className='flex flex-col'>
                <span className={loudnessNormalization ? '' : 'opacity-50'}>
                  {t('settings.loudness-max-gain-db')}
                </span>
                <span className='text-sm opacity-70'>
                  {t('settings.loudness-max-gain-db-desc')}
                </span>
              </span>
              <span className='text-sm tabular-nums opacity-70'>
                ±{loudnessMaxGainDb} dB
              </span>
            </div>
            <M3eSlider
              min={0}
              max={30}
              step={1}
              labelled
              disabled={!loudnessNormalization}
              onInput={(e) =>
                setLoudnessMaxGainDb(
                  (e.target as M3eSliderThumbElement).value ?? 12,
                )
              }
            >
              <M3eSliderThumb value={loudnessMaxGainDb} />
            </M3eSlider>
          </div>
        </div>
      </M3eCard>

      {/* 悬浮歌词 */}
      <M3eCard>
        <div slot='content' className='flex flex-col gap-6'>
          <div className='flex cursor-pointer items-center justify-between gap-4'>
            <span className='flex flex-col'>
              <span>{t('settings.floating-lyrics')}</span>
              <span className='text-sm opacity-70'>
                {t('settings.floating-lyrics-desc')}
              </span>
            </span>
            <M3eSwitch
              checked={floatingLyrics.enabled}
              onInput={(e) =>
                setFloatingLyrics({
                  enabled: (e.target as HTMLInputElement).checked,
                })
              }
            />
          </div>

          {/* 字体大小 */}
          <div className='flex flex-col gap-2'>
            <div className='flex items-center justify-between gap-4'>
              <span className={floatingLyrics.enabled ? '' : 'opacity-50'}>
                {t('settings.font-size')}
              </span>
              <span className='text-sm tabular-nums opacity-70'>
                {floatingLyrics.fontSize} px
              </span>
            </div>
            <M3eSlider
              min={12}
              max={24}
              step={1}
              labelled
              disabled={!floatingLyrics.enabled}
              onInput={(e) =>
                setFloatingLyrics({
                  fontSize: (e.target as M3eSliderThumbElement).value ?? 14,
                })
              }
            >
              <M3eSliderThumb value={floatingLyrics.fontSize} />
            </M3eSlider>
          </div>

          {/* 行数 */}
          <div className={SETTING_ROW_LAYOUT}>
            <span className='flex flex-col'>
              <span className={floatingLyrics.enabled ? '' : 'opacity-50'}>
                {t('settings.lines-limit')}
              </span>
              <span className='text-sm opacity-70'>
                {t('settings.lines-limit-desc')}
              </span>
            </span>
            <M3eSegmentedButton
              className={SETTING_CONTROL_FILL}
              disabled={!floatingLyrics.enabled}
              onInput={(e) =>
                setFloatingLyrics({
                  lines: Number((e.target as HTMLInputElement).value),
                })
              }
            >
              {LYRIC_LINE_COUNTS.map((n) => (
                <M3eButtonSegment
                  key={n}
                  value={String(n)}
                  checked={floatingLyrics.lines === n}
                >
                  {t('settings.line-count', { n })}
                </M3eButtonSegment>
              ))}
            </M3eSegmentedButton>
          </div>

          {/* 透明度 */}
          <div className='flex flex-col gap-2'>
            <div className='flex items-center justify-between gap-4'>
              <span className={floatingLyrics.enabled ? '' : 'opacity-50'}>
                {t('settings.background-opacity')}
              </span>
              <span className='text-sm tabular-nums opacity-70'>
                {Math.round(floatingLyrics.opacity * 100)}%
              </span>
            </div>
            <M3eSlider
              min={0.2}
              max={1}
              step={0.05}
              labelled
              disabled={!floatingLyrics.enabled}
              onInput={(e) =>
                setFloatingLyrics({
                  opacity: (e.target as M3eSliderThumbElement).value ?? 0.8,
                })
              }
            >
              <M3eSliderThumb value={floatingLyrics.opacity} />
            </M3eSlider>
          </div>
        </div>
      </M3eCard>
    </div>
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

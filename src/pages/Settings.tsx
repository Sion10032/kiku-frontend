import { useState } from 'react';
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

const COLOR_MODES: { value: ColorMode; label: string }[] = [
  { value: 'auto', label: '跟随系统' },
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
];

const LYRIC_LINE_COUNTS = [1, 2, 3];

const COVER_BLUR_MODES: { value: CoverBlurMode; label: string }[] = [
  { value: 'always', label: '始终模糊' },
  { value: 'hover', label: '悬浮显示' },
  { value: 'never', label: '始终显示' },
];

const TIME_DISPLAY_MODES: { value: TimeDisplayMode; label: string }[] = [
  { value: 'total', label: '总时长' },
  { value: 'remaining', label: '剩余时间' },
];

const WORKS_PAGINATION_MODES: { value: WorksPaginationMode; label: string }[] =
  [
    { value: 'paginate', label: '分页' },
    { value: 'infinite', label: '无限滚动' },
  ];

const WORKS_PAGINATOR_POSITIONS: {
  value: WorksPaginatorPosition;
  label: string;
}[] = [
  { value: 'top', label: '顶部' },
  { value: 'bottom', label: '底部' },
  { value: 'both', label: '顶部和底部' },
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
  const dynamicColor = useSettingsStore((s) => s.dynamicColor);
  const colorMode = useSettingsStore((s) => s.colorMode);
  const setDynamicColor = useSettingsStore((s) => s.setDynamicColor);
  const setColorMode = useSettingsStore((s) => s.setColorMode);
  const mediaNotification = useSettingsStore((s) => s.mediaNotification);
  const setMediaNotification = useSettingsStore((s) => s.setMediaNotification);
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

  return (
    <div className='mx-auto flex max-w-2xl flex-col gap-4'>
      <h1 className='m-0 text-2xl font-normal'>设置</h1>
      {/* 云端设置备份：登录可用，实现见文件底部 SettingsBackupCard */}
      <SettingsBackupCard />
      <M3eCard>
        <div slot='content' className='flex flex-col gap-6'>
          {/* 颜色模式：窄屏时标签与分段按钮上下堆叠，避免横向溢出 */}
          <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
            <span>颜色模式</span>
            {/* 注意：组的 value 是 getter-only 派生属性（同 radio-group），
                受控方式是给每个 M3eButtonSegment 传 checked */}
            <M3eSegmentedButton
              className='w-full sm:w-auto'
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
                  {m.label}
                </M3eButtonSegment>
              ))}
            </M3eSegmentedButton>
          </div>

          {/* 界面大小：rem 尺寸体系，改 html font-size 全屏等比缩放；
              自动仅在首次使用时按屏幕像素密度推断一次 */}
          <div className='flex flex-col gap-2'>
            <div className='flex items-center justify-between gap-4'>
              <span className='flex flex-col'>
                <span>界面大小</span>
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
              <span>动态取色</span>
              <span className='text-sm opacity-70'>
                进入作品详情时从封面提取主题色
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
          <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
            <span className='flex flex-col'>
              <span>R-18 封面</span>
              <span className='text-sm opacity-70'>
                R-18 封面模糊：始终模糊 / 默认模糊悬浮显示 / 始终清晰显示
              </span>
            </span>
            <M3eSegmentedButton
              className='w-full sm:w-auto'
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
                  {m.label}
                </M3eButtonSegment>
              ))}
            </M3eSegmentedButton>
          </div>

          {/* 时间显示模式 */}
          <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
            <span className='flex flex-col'>
              <span>时间显示</span>
              <span className='text-sm opacity-70'>
                播放器中显示总时长（22:33）或剩余时间（-1:39）
              </span>
            </span>
            <M3eSegmentedButton
              className='w-full sm:w-auto'
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
                  {m.label}
                </M3eButtonSegment>
              ))}
            </M3eSegmentedButton>
          </div>

          {/* 作品库翻页方式 */}
          <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
            <span className='flex flex-col'>
              <span>作品库翻页方式</span>
              <span className='text-sm opacity-70'>
                分页（可跳页，页码与筛选同步到地址栏和标题）或无限滚动
              </span>
            </span>
            <M3eSegmentedButton
              className='w-full sm:w-auto'
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
                  {m.label}
                </M3eButtonSegment>
              ))}
            </M3eSegmentedButton>
          </div>

          {/* 分页控件显示位置 */}
          <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
            <span className='flex flex-col'>
              <span>分页控件显示位置</span>
              <span className='text-sm opacity-70'>
                作品库分页控件显示在列表顶部、底部或两者
              </span>
            </span>
            <M3eSegmentedButton
              className='w-full sm:w-auto'
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
                  {p.label}
                </M3eButtonSegment>
              ))}
            </M3eSegmentedButton>
          </div>

          {/* 最近收听条 */}
          <div className='flex cursor-pointer items-center justify-between gap-4'>
            <span className='flex flex-col'>
              <span>最近收听</span>
              <span className='text-sm opacity-70'>
                在作品库首页顶部显示最近收听条
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
              <span>媒体通知</span>
              <span className='text-sm opacity-70'>
                在系统媒体面板 / 锁屏显示播放控制
              </span>
            </span>
            <M3eSwitch
              checked={mediaNotification}
              onInput={(e) =>
                setMediaNotification((e.target as HTMLInputElement).checked)
              }
            />
          </div>
        </div>
      </M3eCard>

      {/* 悬浮歌词 */}
      <M3eCard>
        <div slot='content' className='flex flex-col gap-6'>
          <div className='flex cursor-pointer items-center justify-between gap-4'>
            <span className='flex flex-col'>
              <span>显示悬浮歌词</span>
              <span className='text-sm opacity-70'>
                播放时在播放条上方悬浮显示当前歌词
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
                字体大小
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
          <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
            <span className='flex flex-col'>
              <span className={floatingLyrics.enabled ? '' : 'opacity-50'}>
                行数上限
              </span>
              <span className='text-sm opacity-70'>
                歌词过长时换行显示，超出部分省略
              </span>
            </span>
            <M3eSegmentedButton
              className='w-full sm:w-auto'
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
                  {n} 行
                </M3eButtonSegment>
              ))}
            </M3eSegmentedButton>
          </div>

          {/* 透明度 */}
          <div className='flex flex-col gap-2'>
            <div className='flex items-center justify-between gap-4'>
              <span className={floatingLyrics.enabled ? '' : 'opacity-50'}>
                背景透明度
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
      M3eSnackbar.open('已备份');
      return true;
    } catch (err) {
      // 409（超上限）等业务错误展示后端 message
      showApiError(err, '备份失败');
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
      M3eSnackbar.open('已删除');
      setSelectedName(''); // 删除的即当前选中项
    } catch (err) {
      showApiError(err, '删除失败');
    }
  }

  async function onRestoreConfirm() {
    if (!selectedName || restoreMutation.isPending) return;
    try {
      await restoreMutation.mutateAsync(selectedName);
      M3eSnackbar.open('已还原');
    } catch (err) {
      showApiError(err, '还原失败');
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
            <span>设置备份</span>
            <span className='text-sm tabular-nums opacity-70'>
              {backups.length} / {BACKUP_LIMIT}
            </span>
          </div>

          {!auth && <p className='m-0 text-sm opacity-70'>登录后可用</p>}

          {/* 行 1：选择配置 + 新增 / 删除 */}
          <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
            <M3eFormField
              variant='outlined'
              hideSubscript='always'
              className='w-full sm:w-auto min-w-48 [--m3e-form-field-width:12rem]'
            >
              <label slot='label' htmlFor='settings-backup-select'>
                选择配置
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
                      （{formatDate(b.updatedAt)}）
                    </span>
                  </M3eOption>
                ))}
              </M3eSelect>
            </M3eFormField>
            <div className='flex shrink-0 gap-2'>
              <M3eButton variant='filled' disabled={!auth} onClick={openAdd}>
                新增
              </M3eButton>
              <M3eButton
                variant='text'
                className='text-[var(--md-sys-color-error)]'
                disabled={!auth || !selectedName || deleteMutation.isPending}
                onClick={onDelete}
              >
                删除
              </M3eButton>
            </div>
          </div>

          {/* 行 2：选中配置后显示，备份到此配置（覆盖）/ 还原 */}
          {selected && (
            <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
              <span className='text-sm opacity-70'>
                「{selected.name}」备份于 {formatDate(selected.updatedAt)}
              </span>
              <div className='flex shrink-0 gap-2'>
                <M3eButton
                  variant='outlined'
                  disabled={backupMutation.isPending}
                  onClick={() => backupTo(selected.name)}
                >
                  备份到此配置
                </M3eButton>
                <M3eButton
                  variant='tonal'
                  disabled={restoreMutation.isPending}
                  onClick={() => setConfirmRestore(true)}
                >
                  还原
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
        closeLabel='关闭'
      >
        <span slot='header'>新增备份</span>
        <div className='flex flex-col gap-4 py-2'>
          <M3eFormField variant='outlined' className='w-full'>
            <label slot='label' htmlFor='settings-backup-name'>
              配置名
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
            取消
          </M3eButton>
          <M3eButton
            variant='filled'
            disabled={!newName.trim() || backupMutation.isPending}
            onClick={onAddConfirm}
          >
            {backupMutation.isPending ? '备份中…' : '备份'}
          </M3eButton>
        </div>
      </M3eDialog>

      {/* 还原二次确认：覆盖当前本地设置（项目通用 ConfirmDialog） */}
      <ConfirmDialog
        open={confirmRestore}
        title='还原设置'
        message={
          selectedName
            ? `将用云端配置「${selectedName}」覆盖当前本地设置，确定还原吗？`
            : ''
        }
        confirmLabel='还原'
        onConfirm={onRestoreConfirm}
        onCancel={() => setConfirmRestore(false)}
      />
    </>
  );
}

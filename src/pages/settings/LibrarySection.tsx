import { useTranslation } from 'react-i18next';
import {
  M3eSegmentedButton,
  M3eButtonSegment,
} from '@m3e/react/segmented-button';
import { M3eSwitch } from '@m3e/react/switch';
import { SETTING_CONTROL_FILL, SETTING_ROW_LAYOUT } from '../../constants';
import {
  useSettingsStore,
  WORKS_PAGE_SIZES,
  type CoverBlurMode,
  type WorksPaginationMode,
  type WorksPaginatorPosition,
} from '../../stores/settingsStore';

const COVER_BLUR_MODES: {
  value: CoverBlurMode;
  label: `settings.cover-blur-${CoverBlurMode}`;
}[] = [
  { value: 'always', label: 'settings.cover-blur-always' },
  { value: 'hover', label: 'settings.cover-blur-hover' },
  { value: 'never', label: 'settings.cover-blur-never' },
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
 * 「作品库」分组行：R-18 封面 / 翻页方式 / 分页控件位置 / 每页数量 / 最近收听条。
 * 只渲染行，卡片见 pages/Settings.tsx。
 */
export default function LibrarySection() {
  const { t } = useTranslation();
  const coverBlurMode = useSettingsStore((s) => s.coverBlurMode);
  const setCoverBlurMode = useSettingsStore((s) => s.setCoverBlurMode);
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
  const worksPageSize = useSettingsStore((s) => s.worksPageSize);
  const setWorksPageSize = useSettingsStore((s) => s.setWorksPageSize);
  const worksHistoryStrip = useSettingsStore((s) => s.worksHistoryStrip);
  const setShowHistoryStrip = useSettingsStore((s) => s.setShowHistoryStrip);

  return (
    <>
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
              (e.target as HTMLInputElement).value as WorksPaginatorPosition,
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

      {/* 每页数量：作用作品库与收听历史 */}
      <div className={SETTING_ROW_LAYOUT}>
        <span className='flex flex-col'>
          <span>{t('settings.works-page-size')}</span>
          <span className='text-sm opacity-70'>
            {t('settings.works-page-size-desc')}
          </span>
        </span>
        <M3eSegmentedButton
          className={SETTING_CONTROL_FILL}
          onInput={(e) =>
            setWorksPageSize(Number((e.target as HTMLInputElement).value) || 20)
          }
        >
          {WORKS_PAGE_SIZES.map((size) => (
            <M3eButtonSegment
              key={size}
              value={String(size)}
              checked={worksPageSize === size}
            >
              {String(size)}
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
    </>
  );
}

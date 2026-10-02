import { useTranslation } from 'react-i18next';
import { M3eFormField } from '@m3e/react/form-field';
import { M3eSelect, type M3eSelectElement } from '@m3e/react/select';
import { M3eOption } from '@m3e/react/option';
import { M3eIconButton } from '@m3e/react/icon-button';
import { M3eIcon } from '@m3e/react/icon';
import '@m3e/icons/outlined/apps';
import '@m3e/icons/outlined/view_list';
import type { QuickFilterAge, QuickFilterProgress } from '../../utils/query';
import { SORT_OPTIONS, type SortOption } from '../../utils/sort';

/** 作品库视图模式。 */
export type WorksViewMode = 'grid' | 'list';

interface WorksToolbarProps {
  /** 作品总数（标题旁括号计数；加载中为 undefined 不显示） */
  totalCount?: number;
  /** 快速筛选生效值：分级（undefined = 不限） */
  quickAge?: QuickFilterAge;
  /** 快速筛选生效值：收听状态（undefined = 不限） */
  quickProgress?: QuickFilterProgress;
  /** 快速筛选变更（值为空串 = 切回不限） */
  onAgeChange: (value: string) => void;
  onProgressChange: (value: string) => void;
  /** 当前排序选项与变更（值为 `${order}:${sort}`） */
  sortOption: SortOption;
  onSortChange: (value: string) => void;
  /** 视图模式与切换 */
  viewMode: WorksViewMode;
  onToggleView: () => void;
}

/**
 * 作品库顶部工具栏：标题计数 + 快速筛选（分级/状态）+ 排序 + 视图切换。
 * 纯展示组件：状态与导航逻辑留在页面（Works），回调只上报选中值。
 */
export default function WorksToolbar({
  totalCount,
  quickAge,
  quickProgress,
  onAgeChange,
  onProgressChange,
  sortOption,
  onSortChange,
  viewMode,
  onToggleView,
}: WorksToolbarProps) {
  const { t } = useTranslation();
  // 单选 select 实际恒为 string；类型上兼容 multi（数组/null）时回落空串
  const selectValue = (e: Event) => {
    const value = (e.target as M3eSelectElement).value;
    return typeof value === 'string' ? value : '';
  };

  return (
    <div className='mb-4 flex flex-wrap items-center gap-3'>
      <h1 className='m-0 text-xl'>
        {t('works.title')}
        {totalCount != null && (
          <span className='ml-2 text-base opacity-60'>({totalCount})</span>
        )}
      </h1>

      <div className='ms-auto flex flex-wrap items-center gap-2 zoom-80'>
        {/* 快速筛选：分级 */}
        <M3eFormField
          variant='outlined'
          hideSubscript='always'
          className='min-w-28 [--m3e-form-field-width:7rem] density-3'
        >
          <label slot='label' htmlFor='works-filter-age'>
            {t('works.filter-age')}
          </label>
          <M3eSelect
            id='works-filter-age'
            onChange={(e) => onAgeChange(selectValue(e))}
          >
            <M3eOption value='' selected={quickAge == null}>
              {t('works.filter-age-all')}
            </M3eOption>
            <M3eOption value='all' selected={quickAge === 'all'}>
              {t('works.filter-age-all-ages')}
            </M3eOption>
            <M3eOption value='r15' selected={quickAge === 'r15'}>
              R15
            </M3eOption>
            <M3eOption value='r18' selected={quickAge === 'r18'}>
              R18
            </M3eOption>
          </M3eSelect>
        </M3eFormField>

        {/* 快速筛选：收听状态 */}
        <M3eFormField
          variant='outlined'
          hideSubscript='always'
          className='min-w-28 [--m3e-form-field-width:7rem] density-3'
        >
          <label slot='label' htmlFor='works-filter-progress'>
            {t('works.filter-progress')}
          </label>
          <M3eSelect
            id='works-filter-progress'
            onChange={(e) => onProgressChange(selectValue(e))}
          >
            <M3eOption value='' selected={quickProgress == null}>
              {t('works.filter-progress-all')}
            </M3eOption>
            <M3eOption value='read' selected={quickProgress === 'read'}>
              {t('works.filter-progress-read')}
            </M3eOption>
            <M3eOption
              value='inprogress'
              selected={quickProgress === 'inprogress'}
            >
              {t('works.filter-progress-inprogress')}
            </M3eOption>
            <M3eOption value='unread' selected={quickProgress === 'unread'}>
              {t('works.filter-progress-unread')}
            </M3eOption>
          </M3eSelect>
        </M3eFormField>

        <M3eFormField
          variant='outlined'
          hideSubscript='always'
          className='min-w-34 [--m3e-form-field-width:8rem] density-3'
        >
          <M3eSelect onChange={(e) => onSortChange(selectValue(e))}>
            {SORT_OPTIONS.map((o) => {
              const v = `${o.order}:${o.sort}`;
              return (
                <M3eOption
                  key={v}
                  value={v}
                  selected={v === `${sortOption.order}:${sortOption.sort}`}
                >
                  {t(o.label)}
                </M3eOption>
              );
            })}
          </M3eSelect>
        </M3eFormField>

        <M3eIconButton
          onClick={onToggleView}
          aria-label={t('works.view-toggle')}
        >
          <M3eIcon name={viewMode === 'grid' ? 'view_list' : 'apps'} />
        </M3eIconButton>
      </div>
    </div>
  );
}

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { M3eButton } from '@m3e/react/button';
import { M3eCheckbox } from '@m3e/react/checkbox';
import { M3eFormField } from '@m3e/react/form-field';
import { useTranslation } from 'react-i18next';
import { getWorksList } from '../../api/works';
import DashboardPage from '../../components/dashboard/DashboardPage';
import ScannerPanel from '../../components/dashboard/ScannerPanel';
import Paginator from '../../components/common/Paginator';
import MetadataEditDialog from '../../components/work/MetadataEditDialog';
import TitleSanitizeDialog from '../../components/work/TitleSanitizeDialog';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';

/**
 * 音声管理页（合并页下半部分）：作品表格（checkbox 多选）+ 搜索 + 分页，
 * 行点击打开编辑弹窗（复用 MetadataEditDialog）。
 * 搜索复用公开 works 列表 API（LQL：标题/社团/标签/声优/裸词）；
 * 搜索框旁挂标题净化快捷入口：弹窗内范围只读套用当前搜索条件。
 * 多选仅记录当前页选中项，翻页 / 搜索词变化时清空；本期已选栏仅计数占位。
 */
export default function AudioManage() {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const debouncedQ = useDebouncedValue(q, 300);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [sanitizeOpen, setSanitizeOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 搜索词变化（防抖后）时回到第 1 页，并清空多选（多选仅当前页语义）。
  // 渲染期比较调整（react-hooks/set-state-in-effect：effect 内同步
  // setState 会级联渲染，不适用于这种「外部值变化重置 state」场景）
  const [prevDebouncedQ, setPrevDebouncedQ] = useState(debouncedQ);
  if (debouncedQ !== prevDebouncedQ) {
    setPrevDebouncedQ(debouncedQ);
    setPage(1);
    setSelectedIds(new Set());
  }

  const worksQuery = useQuery({
    queryKey: ['works', { adminSearch: debouncedQ, page }],
    queryFn: () =>
      getWorksList({
        q: debouncedQ || undefined,
        page,
        order: 'release',
        sort: 'desc',
      }),
    placeholderData: keepPreviousData,
  });

  const works = worksQuery.data?.works ?? [];
  const pagination = worksQuery.data?.pagination;

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // 表头 checkbox：全选 / 清空当前页；indeterminate 表示部分选中
  const allPageSelected =
    works.length > 0 && works.every((w) => selectedIds.has(w.id));
  const somePageSelected = works.some((w) => selectedIds.has(w.id));
  const toggleAllPage = () => {
    setSelectedIds(
      allPageSelected ? new Set() : new Set(works.map((w) => w.id)),
    );
  };

  return (
    <DashboardPage>
      {/* 合并页上半部分：扫描器面板（SSE 实时状态 + 详情弹窗） */}
      <ScannerPanel />

      {/* 搜索框 + 标题净化快捷入口（范围 = 本搜索框当前条件，见弹窗组件注释）。
          hideSubscript 去掉字段底部保留区，按钮与输入框垂直居中对齐 */}
      <div className='flex items-center gap-2'>
        <M3eFormField
          variant='outlined'
          hideSubscript='always'
          className='min-w-0 flex-1 [--m3e-form-field-width:100%] density-3'
        >
          <label slot='label' htmlFor='audio-admin-search'>
            {t('dashboard.metadata.search-label')}
          </label>
          <input
            id='audio-admin-search'
            type='text'
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className='w-full border-none bg-transparent py-2 text-sm outline-none'
          />
        </M3eFormField>
        <M3eButton
          variant='outlined'
          className='shrink-0'
          title={t('dashboard.metadata.sanitize-title')}
          onClick={() => setSanitizeOpen(true)}
        >
          {t('dashboard.metadata.sanitize')}
        </M3eButton>
      </div>

      {worksQuery.isLoading ? (
        <div className='py-8 text-center opacity-60'>{t('common.loading')}</div>
      ) : works.length === 0 ? (
        <div className='py-8 text-center opacity-60'>
          {t('dashboard.metadata.no-results')}
        </div>
      ) : (
        <div className='overflow-x-auto'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='border-b border-[var(--md-sys-color-outline-variant)] text-left text-xs uppercase opacity-60'>
                <th className='w-10 px-2 py-2'>
                  <M3eCheckbox
                    checked={allPageSelected}
                    indeterminate={somePageSelected && !allPageSelected}
                    onChange={toggleAllPage}
                  />
                </th>
                <th className='px-2 py-2'>RJ</th>
                <th className='px-2 py-2'>标题</th>
                <th className='px-2 py-2'>社团</th>
                <th className='px-2 py-2'>发售日期</th>
                <th className='px-2 py-2'>覆盖字段</th>
              </tr>
            </thead>
            <tbody>
              {works.map((w) => (
                <tr
                  key={w.id}
                  tabIndex={0}
                  onClick={() => setSelected(w.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      setSelected(w.id);
                    }
                  }}
                  className='cursor-pointer border-b border-[var(--md-sys-color-outline-variant)] last:border-b-0 hover:bg-[var(--md-sys-color-surface-container)]'
                >
                  <td
                    className='px-2 py-2'
                    onClick={(e) => e.stopPropagation()}
                  >
                    <M3eCheckbox
                      checked={selectedIds.has(w.id)}
                      onChange={() => toggle(w.id)}
                    />
                  </td>
                  <td className='whitespace-nowrap px-2 py-2 font-mono text-xs'>
                    {w.id}
                  </td>
                  {/* line-clamp 不能放在 td 上：其 display:-webkit-box 会覆盖
                      table-cell 导致列错位，须移到单元格内元素 */}
                  <td className='px-2 py-2'>
                    <span className='line-clamp-1'>{w.title}</span>
                  </td>
                  <td className='px-2 py-2'>
                    <span className='line-clamp-1'>{w.circle.name}</span>
                  </td>
                  <td className='whitespace-nowrap px-2 py-2'>
                    {w.release ?? '—'}
                  </td>
                  <td className='px-2 py-2'>
                    {w.overriddenFields?.length
                      ? w.overriddenFields.join(', ')
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 已选栏：本期仅计数占位，不接批量接口 */}
      {selectedIds.size > 0 && (
        <div className='mt-2 text-sm opacity-80'>
          {t('dashboard.audio.selected-count', { n: selectedIds.size })}
        </div>
      )}

      {/* 分页（有结果时显示；翻页请求进行中禁用，同 Works.tsx 用法）。
          多选仅当前页语义，翻页时清空 */}
      {!worksQuery.isLoading && pagination && pagination.totalCount > 0 && (
        <div className='flex items-center justify-center gap-2'>
          <Paginator
            length={pagination.totalCount}
            pageSize={pagination.pageSize}
            pageIndex={page - 1}
            disabled={worksQuery.isFetching}
            onPage={(index) => {
              setPage(index + 1);
              setSelectedIds(new Set());
            }}
          />
        </div>
      )}

      <TitleSanitizeDialog
        open={sanitizeOpen}
        q={debouncedQ}
        onClose={() => setSanitizeOpen(false)}
      />

      <MetadataEditDialog
        workId={selected ?? ''}
        open={selected !== null}
        onClose={() => setSelected(null)}
      />
    </DashboardPage>
  );
}

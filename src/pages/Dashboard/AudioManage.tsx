import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { M3eButton } from '@m3e/react/button';
import { M3eCheckbox } from '@m3e/react/checkbox';
import { M3eFormField } from '@m3e/react/form-field';
import { M3eIcon } from '@m3e/react/icon';
import { M3eIconButton } from '@m3e/react/icon-button';
import { M3eDivider } from '@m3e/react/divider';
import { type M3eMenuElement, M3eMenu, M3eMenuItem } from '@m3e/react/menu';
import '@m3e/icons/outlined/cleaning_services';
import '@m3e/icons/outlined/check';
import '@m3e/icons/outlined/close';
import '@m3e/icons/outlined/delete';
import '@m3e/icons/outlined/edit_note';
import '@m3e/icons/outlined/explicit';
import '@m3e/icons/outlined/family_restroom';
import '@m3e/icons/outlined/filter_list';
import '@m3e/icons/outlined/help_center';
import '@m3e/icons/outlined/play_arrow';
import '@m3e/icons/outlined/sync';
import '@m3e/icons/outlined/title';
import '@m3e/icons/outlined/stop';
import '@m3e/icons/outlined/warning';
import { useTranslation } from 'react-i18next';
import { getWorksList } from '../../api/works';
import ConfirmDialog from '../../components/ConfirmDialog';
import DashboardPage from '../../components/dashboard/DashboardPage';
import ScannerPanel from '../../components/dashboard/ScannerPanel';
import AnalysisPanel from '../../components/dashboard/AnalysisPanel';
import { useScannerEvents } from '../../components/dashboard/useScannerEvents';
import { useAnalysisEvents } from '../../components/dashboard/useAnalysisEvents';
import Paginator from '../../components/common/Paginator';
import MetadataEditDialog from '../../components/work/MetadataEditDialog';
import TitleSanitizeDialog from '../../components/work/TitleSanitizeDialog';
import { useBatchSoftDeleteWorksMutation } from '../../queries/useWorkAdminMutation';

/**
 * 音声管理页（合并页）：顶部一行操作按钮（扫描器组 | 响度分析组 | 标题净化，
 * 垂直分隔符分组），下接两个指示器面板（SSE 实时状态 + 详情弹窗，
 * 展示方式一致），下半部分为作品表格（checkbox 多选）+ 搜索 +
 * 分页，行点击打开编辑弹窗（复用 MetadataEditDialog）。
 * 搜索框左侧为快捷筛选下拉：点击把预设 LQL 片段（overridden:any 等）
 * 写入/移除搜索框（toggle），搜索框文本是唯一状态源，无独立选中状态。
 * 搜索为回车提交式：输入框草稿 q 与生效词 committedQ 分离，手动输入
 * 回车才提交（guard IME 组合中的选词回车）；快捷筛选 / 清空按钮点击即
 * 提交。搜索复用公开 works 列表 API（LQL：标题/社团/标签/声优/裸词）；
 * 标题净化弹窗范围只读套用当前搜索条件。
 * 多选仅记录当前页选中项，翻页 / 搜索词变化时清空；已选计数显示在底部行
 * 左侧，分页居右同排。
 * 刷新音声库信息 / 开始响度分析点击后先弹确认弹窗（ConfirmDialog）：
 * 无选中 → 全局执行；有选中 → 仅对选中的作品执行（workIds 子集）。
 * 批量软删除（顶部操作行第三组）无全局语义：无选中时禁用；有选中 →
 * 确认后 POST /works/batch-delete，成功清空选中并刷新列表。
 */

/**
 * 快捷筛选预设：expr 为写入搜索框的 LQL 片段，icon 为未激活时菜单项图标
 * （激活时统一显示 check）。group 相同的片段互斥：写入时先移除同组其它
 * 片段（分级 age 三选一，AND 累积会恒为空）；null = 不参与互斥。
 * 字段语义见后端 query/compiler.ts 白名单。as const 保住 labelKey 字面量
 * （i18next 类型化 key）。
 */
const QUICK_FILTERS = [
  {
    expr: 'overridden:any',
    icon: 'edit_note',
    labelKey: 'dashboard.audio.quick-filter-overridden',
    group: null,
  },
  {
    expr: 'circle:unknown',
    icon: 'help_center',
    labelKey: 'dashboard.audio.quick-filter-unknown-circle',
    group: null,
  },
  {
    expr: 'overridden:title',
    icon: 'title',
    labelKey: 'dashboard.audio.quick-filter-overridden-title',
    group: null,
  },
  {
    expr: 'age:r18',
    icon: 'explicit',
    labelKey: 'dashboard.audio.quick-filter-r18',
    group: 'age',
  },
  {
    expr: 'age:r15',
    icon: 'warning',
    labelKey: 'dashboard.audio.quick-filter-r15',
    group: 'age',
  },
  {
    expr: 'age:all',
    icon: 'family_restroom',
    labelKey: 'dashboard.audio.quick-filter-all',
    group: 'age',
  },
] as const;
export default function AudioManage() {
  const { t } = useTranslation();
  // 扫描器 / 响度分析的 SSE 状态与动作（按钮行在本页渲染，面板只负责展示）
  const scanner = useScannerEvents();
  const analysis = useAnalysisEvents();
  const batchDelete = useBatchSoftDeleteWorksMutation();
  // q = 输入框草稿；committedQ = 生效搜索词（回车 / 快捷筛选 / 清空按钮提交）
  const [q, setQ] = useState('');
  const [committedQ, setCommittedQ] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [sanitizeOpen, setSanitizeOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // 待确认的批量操作（确认弹窗）：null 关闭；update/analysis 按选中与否
  // 决定全局 / 子集；delete 无全局语义，仅子集（按钮无选中时已禁用）
  const [pendingAction, setPendingAction] = useState<
    'update' | 'analysis' | 'delete' | null
  >(null);
  // 快捷筛选菜单：{ anchor } 对象每次点击都新建，确保重复点击也会重新 show
  // （同 WorkDetails 管理菜单）
  const [quickFilterMenu, setQuickFilterMenu] = useState<{
    anchor: HTMLElement;
  } | null>(null);
  const quickFilterMenuRef = useRef<M3eMenuElement>(null);
  // 清空按钮：清空搜索后把焦点还给输入框
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 菜单打开：以筛选按钮为锚点（m3e-menu 自动翻转防溢出）
  useEffect(() => {
    if (quickFilterMenu) {
      void quickFilterMenuRef.current?.show(quickFilterMenu.anchor);
    }
  }, [quickFilterMenu]);

  /** 提交搜索：同时更新草稿与生效词（快捷筛选 / 清空按钮即时生效，手打内容走回车）。 */
  const applyQ = (value: string) => {
    setQ(value);
    setCommittedQ(value);
  };

  /** 搜索框按空白分词，含该 LQL 片段则移除，否则追加；互斥组片段（分级）写入前先移除同组其它片段。 */
  const toggleQuickFilter = (expr: string) => {
    setQuickFilterMenu(null);
    const group = QUICK_FILTERS.find((f) => f.expr === expr)?.group;
    const siblings: string[] = group
      ? QUICK_FILTERS.filter((f) => f.group === group && f.expr !== expr).map(
          (f) => f.expr,
        )
      : [];
    const parts = q.split(/\s+/).filter(Boolean);
    applyQ(
      parts.includes(expr)
        ? parts.filter((p) => p !== expr).join(' ')
        : [...parts.filter((p) => !siblings.includes(p)), expr].join(' '),
    );
  };
  /** 菜单项激活态：直接从搜索框文本派生，无独立状态。 */
  const quickFilterActive = (expr: string) => q.split(/\s+/).includes(expr);

  // 生效搜索词变化时回到第 1 页，并清空多选（多选仅当前页语义）。
  // 渲染期比较调整（react-hooks/set-state-in-effect：effect 内同步
  // setState 会级联渲染，不适用于这种「外部值变化重置 state」场景）
  const [prevCommittedQ, setPrevCommittedQ] = useState(committedQ);
  if (committedQ !== prevCommittedQ) {
    setPrevCommittedQ(committedQ);
    setPage(1);
    setSelectedIds(new Set());
  }

  const worksQuery = useQuery({
    queryKey: ['works', { adminSearch: committedQ, page }],
    queryFn: () =>
      getWorksList({
        q: committedQ || undefined,
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
    // 固定头尾布局：scroll 关掉（外层只给高度，列由 DashboardPage 撑满），
    // 只有表体所在容器滚动，扫描器 / 搜索行 / 已选栏 / 分页常驻可见
    <DashboardPage scroll={false} className='flex flex-col gap-4'>
      {/* 合并页上半部分：共享按钮行（扫描器组 | 响度分析组）+ 两个指示器面板 */}
      <div className='flex flex-wrap items-center gap-3'>
        {/* 扫描器组 */}
        <M3eButton
          variant='filled'
          disabled={scanner.state === 'running'}
          onClick={() => scanner.start('scan')}
        >
          <M3eIcon slot='leadingIcon' name='play_arrow' />
          {t('dashboard.scan.start-scan')}
        </M3eButton>
        <M3eButton
          variant='tonal'
          disabled={scanner.state === 'running'}
          onClick={() => setPendingAction('update')}
        >
          <M3eIcon slot='leadingIcon' name='sync' />
          {t('dashboard.scan.start-update')}
        </M3eButton>
        <M3eButton
          variant='outlined'
          className='text-[var(--md-sys-color-error)]'
          disabled={scanner.state !== 'running'}
          onClick={scanner.kill}
        >
          <M3eIcon slot='leadingIcon' name='stop' />
          {t('dashboard.scan.kill')}
        </M3eButton>

        {/* 组间垂直分隔符 */}
        <M3eDivider vertical className='mx-1 h-6' />

        {/* 响度分析组 */}
        <M3eButton
          variant='filled'
          disabled={analysis.state === 'running'}
          onClick={() => setPendingAction('analysis')}
        >
          <M3eIcon slot='leadingIcon' name='play_arrow' />
          {t('dashboard.analysis.start')}
        </M3eButton>
        <M3eButton
          variant='outlined'
          className='text-[var(--md-sys-color-error)]'
          disabled={analysis.state !== 'running'}
          onClick={analysis.kill}
        >
          <M3eIcon slot='leadingIcon' name='stop' />
          {t('dashboard.analysis.kill')}
        </M3eButton>

        {/* 标题净化组：范围 = 下方搜索框当前条件，弹窗内只读展示 */}
        <M3eDivider vertical className='mx-1 h-6' />
        <M3eButton
          variant='filled'
          title={t('dashboard.metadata.sanitize-title')}
          onClick={() => setSanitizeOpen(true)}
        >
          <M3eIcon slot='leadingIcon' name='cleaning_services' />
          {t('dashboard.metadata.sanitize')}
        </M3eButton>

        {/* 批量软删除组：无全局语义，仅对选中生效（无选中禁用） */}
        <M3eDivider vertical className='mx-1 h-6' />
        <M3eButton
          variant='outlined'
          className='text-[var(--md-sys-color-error)]'
          disabled={selectedIds.size === 0}
          onClick={() => setPendingAction('delete')}
        >
          <M3eIcon slot='leadingIcon' name='delete' />
          {t('dashboard.audio.delete-selected')}
        </M3eButton>
      </div>

      <ScannerPanel ev={scanner} />
      <AnalysisPanel ev={analysis} />

      {/* 搜索行：左侧快捷筛选下拉（写入/移除 LQL 片段）+ 搜索框。
          标题净化入口已上移至顶部操作行（第三组） */}
      <div className='flex items-center gap-2'>
        <M3eIconButton
          aria-label={t('dashboard.audio.quick-filter')}
          title={t('dashboard.audio.quick-filter')}
          onClick={(e) =>
            setQuickFilterMenu({ anchor: e.currentTarget as HTMLElement })
          }
        >
          <M3eIcon name='filter_list' />
        </M3eIconButton>
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
            ref={searchInputRef}
            type='text'
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              // 回车提交搜索；IME 组合中（选词确认）的回车不触发
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                applyQ(q);
              }
            }}
            className='w-full border-none bg-transparent py-2 text-sm outline-none'
          />
          {/* suffix 清空按钮：q 非空时显示；点击清空搜索并重聚焦输入框 */}
          {q !== '' && (
            <M3eIconButton
              slot='suffix'
              aria-label={t('dashboard.audio.clear-search')}
              title={t('dashboard.audio.clear-search')}
              onClick={() => {
                applyQ('');
                searchInputRef.current?.focus();
              }}
            >
              <M3eIcon name='close' />
            </M3eIconButton>
          )}
        </M3eFormField>
      </div>

      {/* 快捷筛选菜单：与操作弹窗同级渲染，show() 以筛选按钮为锚点 */}
      <M3eMenu ref={quickFilterMenuRef}>
        {QUICK_FILTERS.map((f) => (
          <M3eMenuItem key={f.expr} onClick={() => toggleQuickFilter(f.expr)}>
            <span slot='icon'>
              <M3eIcon
                name={quickFilterActive(f.expr) ? 'check' : f.icon}
                className={
                  quickFilterActive(f.expr)
                    ? 'text-[var(--md-sys-color-primary)]'
                    : ''
                }
              />
            </span>
            {t(f.labelKey)}
          </M3eMenuItem>
        ))}
      </M3eMenu>

      {/* 表格区：flex-1 吃掉剩余高度，纵横溢出都交给本容器滚动 */}
      {worksQuery.isLoading ? (
        <div className='flex min-h-0 flex-1 items-center justify-center opacity-60'>
          {t('common.loading')}
        </div>
      ) : works.length === 0 ? (
        <div className='flex min-h-0 flex-1 items-center justify-center opacity-60'>
          {t('dashboard.metadata.no-results')}
        </div>
      ) : (
        <div className='min-h-0 flex-1 overflow-auto rounded-md border border-[var(--md-sys-color-outline-variant)]'>
          {/* border-collapse：默认 separate 模型下 tr 的边框不会被绘制 */}
          <table className='w-full border-collapse text-sm'>
            {/* 表头吸顶：背景必须不透明，否则行会从表头下透出
                （故文字用 on-surface-variant 而非 opacity） */}
            <thead className='sticky top-0 z-10 bg-[var(--md-sys-color-surface)]'>
              <tr className='border-b border-[var(--md-sys-color-outline-variant)] text-left text-xs uppercase text-[var(--md-sys-color-on-surface-variant)]'>
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

      {/* 底部行：左侧已选计数（有选中才显示），右侧分页居右（ml-auto）。
          两者都无内容时整行不渲染，避免多余 gap */}
      {(selectedIds.size > 0
        || (!worksQuery.isLoading
          && pagination
          && pagination.totalCount > 0)) && (
        <div className='flex items-center gap-2'>
          {selectedIds.size > 0 && (
            <div className='text-sm opacity-80'>
              {t('dashboard.audio.selected-count', { n: selectedIds.size })}
            </div>
          )}
          {/* 分页（有结果时显示；翻页请求进行中禁用，同 Works.tsx 用法）。
              多选仅当前页语义，翻页时清空 */}
          {!worksQuery.isLoading && pagination && pagination.totalCount > 0 && (
            <div className='ml-auto flex items-center gap-2'>
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
        </div>
      )}

      <ConfirmDialog
        open={pendingAction !== null}
        destructive={pendingAction === 'delete'}
        title={
          pendingAction === 'analysis'
            ? t('dashboard.audio.analysis-confirm-title')
            : pendingAction === 'update'
              ? t('dashboard.audio.update-confirm-title')
              : t('dashboard.audio.delete-confirm-title')
        }
        message={
          pendingAction === 'update'
            ? selectedIds.size > 0
              ? t('dashboard.audio.update-confirm-selected', {
                  count: selectedIds.size,
                })
              : t('dashboard.audio.update-confirm-all')
            : pendingAction === 'analysis'
              ? selectedIds.size > 0
                ? t('dashboard.audio.analysis-confirm-selected', {
                    count: selectedIds.size,
                  })
                : t('dashboard.audio.analysis-confirm-all')
              : t('dashboard.audio.delete-confirm-selected', {
                  count: selectedIds.size,
                })
        }
        onConfirm={() => {
          const ids = selectedIds.size > 0 ? [...selectedIds] : undefined;
          if (pendingAction === 'update') scanner.start('update', ids);
          else if (pendingAction === 'analysis') analysis.start(ids);
          else if (pendingAction === 'delete' && ids) {
            batchDelete.mutate(ids, {
              onSuccess: () => setSelectedIds(new Set()),
            });
          }
          setPendingAction(null);
        }}
        onCancel={() => setPendingAction(null)}
      />

      <TitleSanitizeDialog
        open={sanitizeOpen}
        q={committedQ}
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

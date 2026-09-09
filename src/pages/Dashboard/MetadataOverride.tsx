import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { M3eButton } from '@m3e/react/button';
import { M3eFormField } from '@m3e/react/form-field';
import { M3eActionList, M3eListAction } from '@m3e/react/list';
import { getWorksList } from '../../api/works';
import DashboardPage from '../../components/dashboard/DashboardPage';
import Paginator from '../../components/common/Paginator';
import MetadataEditDialog from '../../components/work/MetadataEditDialog';
import TitleSanitizeDialog from '../../components/work/TitleSanitizeDialog';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';

/**
 * 元数据覆盖管理页：搜索作品 → 选中打开编辑弹窗（复用 MetadataEditDialog）。
 * 搜索复用公开 works 列表 API（LQL：标题/社团/标签/声优/裸词）；
 * 列表仅显示标题（列表项同作品库列表视图的 M3eListAction 样式）并带分页。
 * 搜索框旁挂标题净化快捷入口：弹窗内范围只读套用当前搜索条件。
 */
export default function MetadataOverride() {
  const [q, setQ] = useState('');
  const debouncedQ = useDebouncedValue(q, 300);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [sanitizeOpen, setSanitizeOpen] = useState(false);

  // 搜索词变化（防抖后）时回到第 1 页。
  // 渲染期比较调整（react-hooks/set-state-in-effect：effect 内同步
  // setState 会级联渲染，不适用于这种「外部值变化重置 state」场景）
  const [prevDebouncedQ, setPrevDebouncedQ] = useState(debouncedQ);
  if (debouncedQ !== prevDebouncedQ) {
    setPrevDebouncedQ(debouncedQ);
    setPage(1);
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

  return (
    <DashboardPage title='元数据覆盖'>
      {/* 搜索框 + 标题净化快捷入口（范围 = 本搜索框当前条件，见弹窗组件注释）。
          hideSubscript 去掉字段底部保留区，按钮与输入框垂直居中对齐 */}
      <div className='flex items-center gap-2'>
        <M3eFormField
          variant='outlined'
          hideSubscript='always'
          className='min-w-0 flex-1 [--m3e-form-field-width:100%] density-3'
        >
          <label slot='label' htmlFor='metadata-admin-search'>
            搜索作品（LQL：标题/社团/标签/声优/裸词；overridden:title
            过滤覆盖状态）
          </label>
          <input
            id='metadata-admin-search'
            type='text'
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className='w-full border-none bg-transparent py-2 text-sm outline-none'
          />
        </M3eFormField>
        <M3eButton
          variant='outlined'
          className='shrink-0'
          title='标题净化（批量正则替换）'
          onClick={() => setSanitizeOpen(true)}
        >
          标题净化
        </M3eButton>
      </div>

      <TitleSanitizeDialog
        open={sanitizeOpen}
        q={debouncedQ}
        onClose={() => setSanitizeOpen(false)}
      />

      {worksQuery.isLoading ? (
        <div className='py-8 text-center opacity-60'>加载中…</div>
      ) : works.length === 0 ? (
        <div className='py-8 text-center opacity-60'>无匹配作品</div>
      ) : (
        <M3eActionList
          style={
            {
              '--m3e-list-item-container-shape': 'calc(infinity * 1px)',
              '--m3e-list-item-hover-container-shape': 'calc(infinity * 1px)',
            } as React.CSSProperties
          }
        >
          {works.map((w) => (
            <M3eListAction key={w.id} onClick={() => setSelected(w.id)}>
              <span className='line-clamp-1'>{w.title}</span>
            </M3eListAction>
          ))}
        </M3eActionList>
      )}

      {/* 分页（有结果时显示；翻页请求进行中禁用，同 Works.tsx 用法） */}
      {!worksQuery.isLoading && pagination && pagination.totalCount > 0 && (
        <div className='mt-3 flex items-center justify-center gap-2'>
          <Paginator
            length={pagination.totalCount}
            pageSize={pagination.pageSize}
            pageIndex={page - 1}
            disabled={worksQuery.isFetching}
            onPage={(index) => setPage(index + 1)}
          />
        </div>
      )}

      <MetadataEditDialog
        workId={selected ?? ''}
        open={selected !== null}
        onClose={() => setSelected(null)}
      />
    </DashboardPage>
  );
}

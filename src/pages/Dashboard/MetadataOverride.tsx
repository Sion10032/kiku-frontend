import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { M3eButton } from '@m3e/react/button';
import { M3eFormField } from '@m3e/react/form-field';
import { getWorksList } from '../../api/works';
import DashboardPage from '../../components/dashboard/DashboardPage';
import MetadataEditDialog from '../../components/work/MetadataEditDialog';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';

/**
 * 元数据覆盖管理页：搜索作品 → 选中打开编辑弹窗（复用 MetadataEditDialog）。
 * 搜索复用公开 works 列表 API（LQL：标题/社团/标签/声优/裸词）；
 * 「列出全部有覆盖的作品」为 spec 开放问题，暂不做。
 */
export default function MetadataOverride() {
  const [q, setQ] = useState('');
  const debouncedQ = useDebouncedValue(q, 300);
  const [selected, setSelected] = useState<string | null>(null);

  const worksQuery = useQuery({
    queryKey: ['works', { adminSearch: debouncedQ, page: 1 }],
    queryFn: () =>
      getWorksList({
        q: debouncedQ || undefined,
        page: 1,
        order: 'release',
        sort: 'desc',
      }),
    placeholderData: keepPreviousData,
  });

  const works = worksQuery.data?.works ?? [];

  return (
    <DashboardPage title='元数据覆盖'>
      <M3eFormField variant='outlined' className='w-full'>
        <label slot='label' htmlFor='metadata-admin-search'>
          搜索作品（LQL：标题/社团/标签/声优/裸词）
        </label>
        <input
          id='metadata-admin-search'
          type='text'
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className='w-full border-none bg-transparent py-2 text-sm outline-none'
        />
      </M3eFormField>

      {worksQuery.isLoading ? (
        <div className='py-8 text-center opacity-60'>加载中…</div>
      ) : works.length === 0 ? (
        <div className='py-8 text-center opacity-60'>无匹配作品</div>
      ) : (
        <ul className='m-0 flex list-none flex-col gap-1 p-0'>
          {works.map((w) => (
            <li key={w.id}>
              <M3eButton variant='text' onClick={() => setSelected(w.id)}>
                <span className='text-left'>
                  {w.title}
                  <span className='ml-2 text-xs opacity-60'>
                    {w.circle.name} · {w.id}
                    {w.overriddenFields && w.overriddenFields.length > 0 && (
                      <span className='ml-1'>
                        （已覆盖：{w.overriddenFields.join('/')}）
                      </span>
                    )}
                  </span>
                </span>
              </M3eButton>
            </li>
          ))}
        </ul>
      )}

      <MetadataEditDialog
        workId={selected ?? ''}
        open={selected !== null}
        onClose={() => setSelected(null)}
      />
    </DashboardPage>
  );
}

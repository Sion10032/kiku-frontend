import { useQuery } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { M3eButton } from '@m3e/react/button';
import { M3eDialog } from '@m3e/react/dialog';
import { M3eFormField } from '@m3e/react/form-field';
import { getTags, getVas } from '../../api/works';
import {
  useMetadataOverride,
  useResetMetadataFieldMutation,
  useSaveMetadataOverrideMutation,
} from '../../queries/useMetadataOverrideQuery';
import type {
  MetadataOverrideDetail,
  SaveMetadataOverrideInput,
} from '../../types';

interface Props {
  workId: string;
  open: boolean;
  onClose: () => void;
}

/**
 * 弹窗编辑状态：标量 = 最终值草稿；tags/vas = 相对载入时生效值的动作列表。
 * 保存只提交有变化的键（空 payload 时按钮置灰），符合后端动作列表契约。
 */
interface Draft {
  title: string;
  circleName: string;
  seriesName: string;
  ageRating: 'all' | 'r15' | 'r18';
  removedTagIds: number[];
  addedTagNames: string[];
  removedVaIds: string[];
  addedVas: Array<{ id?: string; name: string }>;
}

function toDraft(detail: MetadataOverrideDetail): Draft {
  return {
    title: detail.effective.title,
    circleName: detail.effective.circle?.name ?? '',
    seriesName: detail.effective.series?.name ?? '',
    ageRating: (detail.effective.ageRating as Draft['ageRating']) ?? 'all',
    removedTagIds: [],
    addedTagNames: [],
    removedVaIds: [],
    addedVas: [],
  };
}

export default function MetadataEditDialog({ workId, open, onClose }: Props) {
  const detailQuery = useMetadataOverride(workId, open);
  const detail = detailQuery.data ?? null;
  const [draft, setDraft] = useState<Draft | null>(null);
  const saveMutation = useSaveMetadataOverrideMutation(workId);
  const resetMutation = useResetMetadataFieldMutation(workId);

  // 维度名补全数据：与列表页共享缓存（useListQuery 同 key），仅弹窗打开时拉取
  const tagsQuery = useQuery({
    queryKey: ['tags'],
    queryFn: getTags,
    enabled: open,
  });
  const vasQuery = useQuery({
    queryKey: ['vas'],
    queryFn: getVas,
    enabled: open,
  });

  // 载入完成（或重新打开后重新拉取）时用生效值重置草稿，动作列表随之清零
  useEffect(() => {
    if (detail) setDraft(toDraft(detail));
  }, [detail]);

  if (!open) return null;

  const overridden = new Set(detail?.overriddenFields ?? []);

  // 已存在的维度条目与手工新名字都按名提交（后端按名 upsert 幂等），
  // 仅拦截重复添加：已在新增列表或已是生效值时忽略。
  const addTag = (raw: string) => {
    const name = raw.trim();
    if (!draft || !name) return;
    if (draft.addedTagNames.includes(name)) return;
    if (detail?.effective.tags.some((t) => t.name === name)) return;
    setDraft({ ...draft, addedTagNames: [...draft.addedTagNames, name] });
  };

  /** 移除：先前 add 的直接撤出动作列表；effective 既有项记入 removedTagIds。 */
  const removeTag = (tagId: number, name: string) => {
    if (!draft) return;
    if (draft.addedTagNames.includes(name)) {
      setDraft({
        ...draft,
        addedTagNames: draft.addedTagNames.filter((n) => n !== name),
      });
      return;
    }
    if (!draft.removedTagIds.includes(tagId)) {
      setDraft({ ...draft, removedTagIds: [...draft.removedTagIds, tagId] });
    }
  };

  const addVa = (raw: string) => {
    const name = raw.trim();
    if (!draft || !name) return;
    if (draft.addedVas.some((v) => v.name === name)) return;
    if (detail?.effective.vas.some((v) => v.name === name)) return;
    // 优先带已有维度 id（匹配 /api/vas 列表），手工新条目只传名字
    const known = vasQuery.data?.find((v) => v.name === name);
    setDraft({
      ...draft,
      addedVas: [...draft.addedVas, { id: known?.id, name }],
    });
  };

  const removeVa = (vaId: string, name: string) => {
    if (!draft) return;
    if (draft.addedVas.some((v) => v.name === name)) {
      setDraft({
        ...draft,
        addedVas: draft.addedVas.filter((v) => v.name !== name),
      });
      return;
    }
    if (!draft.removedVaIds.includes(vaId)) {
      setDraft({ ...draft, removedVaIds: [...draft.removedVaIds, vaId] });
    }
  };

  const buildPayload = (): SaveMetadataOverrideInput | null => {
    if (!draft || !detail) return null;
    const input: SaveMetadataOverrideInput = {
      title: draft.title !== detail.effective.title ? draft.title : undefined,
      circleName:
        draft.circleName !== (detail.effective.circle?.name ?? '')
          ? draft.circleName || null
          : undefined,
      seriesName:
        draft.seriesName !== (detail.effective.series?.name ?? '')
          ? draft.seriesName || null
          : undefined,
      ageRating:
        draft.ageRating !== detail.effective.ageRating
          ? draft.ageRating
          : undefined,
      addTags: draft.addedTagNames.length > 0 ? draft.addedTagNames : undefined,
      removeTagIds:
        draft.removedTagIds.length > 0 ? draft.removedTagIds : undefined,
      addVas: draft.addedVas.length > 0 ? draft.addedVas : undefined,
      removeVaIds:
        draft.removedVaIds.length > 0 ? draft.removedVaIds : undefined,
    };
    const hasAny = Object.values(input).some((v) => v !== undefined);
    return hasAny ? input : null;
  };

  const chip = 'flex items-center gap-1 rounded px-2 py-0.5 text-xs';

  return (
    <M3eDialog open={open} onClosed={onClose} dismissible closeLabel='关闭'>
      <span slot='header'>编辑元数据（覆盖层）</span>
      <div
        className='flex max-h-[70vh] flex-col gap-4 overflow-y-auto py-2'
        style={{ minWidth: 360 }}
      >
        {detailQuery.isLoading || !detail || !draft ? (
          <div className='py-8 text-center opacity-60'>加载中…</div>
        ) : (
          <>
            <FieldRow
              label='标题'
              overridden={overridden.has('title')}
              onReset={() => resetMutation.mutate('title')}
            >
              <input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                className='w-full border-none bg-transparent py-2 text-sm outline-none'
              />
            </FieldRow>

            <FieldRow
              label='社团'
              overridden={overridden.has('circle')}
              onReset={() => resetMutation.mutate('circle')}
            >
              <input
                value={draft.circleName}
                onChange={(e) =>
                  setDraft({ ...draft, circleName: e.target.value })
                }
                className='w-full border-none bg-transparent py-2 text-sm outline-none'
              />
            </FieldRow>

            <FieldRow
              label='系列'
              overridden={overridden.has('series')}
              onReset={() => resetMutation.mutate('series')}
            >
              <input
                value={draft.seriesName}
                onChange={(e) =>
                  setDraft({ ...draft, seriesName: e.target.value })
                }
                className='w-full border-none bg-transparent py-2 text-sm outline-none'
              />
            </FieldRow>

            <FieldRow
              label='年龄分级'
              overridden={overridden.has('ageRating')}
              onReset={() => resetMutation.mutate('ageRating')}
            >
              <div className='flex gap-2'>
                {(['all', 'r15', 'r18'] as const).map((v) => (
                  <M3eButton
                    key={v}
                    variant={draft.ageRating === v ? 'filled' : 'text'}
                    onClick={() => setDraft({ ...draft, ageRating: v })}
                  >
                    {v}
                  </M3eButton>
                ))}
              </div>
            </FieldRow>

            <FieldRow
              label='标签'
              overridden={overridden.has('tags')}
              onReset={() => resetMutation.mutate('tags')}
            >
              <div className='flex flex-wrap gap-1'>
                {detail.effective.tags.map((t) => {
                  const removed = draft.removedTagIds.includes(t.id);
                  return (
                    <span
                      key={`tag-${t.id}`}
                      className={`${chip} ${removed ? 'line-through opacity-40' : 'bg-black/10 dark:bg-white/20'}`}
                    >
                      {t.name}
                      {!removed && (
                        <button
                          type='button'
                          aria-label={`移除 ${t.name}`}
                          onClick={() => removeTag(t.id, t.name)}
                        >
                          ×
                        </button>
                      )}
                    </span>
                  );
                })}
                {draft.addedTagNames.map((n) => (
                  <span
                    key={`tag-add-${n}`}
                    className={`${chip} bg-green-600/20`}
                  >
                    {n}
                    <button
                      type='button'
                      aria-label={`撤销新增 ${n}`}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          addedTagNames: draft.addedTagNames.filter(
                            (x) => x !== n,
                          ),
                        })
                      }
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <M3eFormField variant='outlined' className='w-full'>
                <label slot='label' htmlFor='metadata-add-tag'>
                  新增标签（回车确认）
                </label>
                <input
                  id='metadata-add-tag'
                  type='text'
                  list='metadata-tag-options'
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      addTag(e.currentTarget.value);
                      e.currentTarget.value = '';
                    }
                  }}
                  className='w-full border-none bg-transparent py-2 text-sm outline-none'
                />
              </M3eFormField>
              <datalist id='metadata-tag-options'>
                {tagsQuery.data?.map((t) => (
                  <option key={t.id} value={t.name} />
                ))}
              </datalist>
            </FieldRow>

            <FieldRow
              label='声优'
              overridden={overridden.has('vas')}
              onReset={() => resetMutation.mutate('vas')}
            >
              <div className='flex flex-wrap gap-1'>
                {detail.effective.vas.map((v) => {
                  const removed = draft.removedVaIds.includes(v.id);
                  return (
                    <span
                      key={`va-${v.id}`}
                      className={`${chip} ${removed ? 'line-through opacity-40' : 'bg-black/10 dark:bg-white/20'}`}
                    >
                      {v.name}
                      {!removed && (
                        <button
                          type='button'
                          aria-label={`移除 ${v.name}`}
                          onClick={() => removeVa(v.id, v.name)}
                        >
                          ×
                        </button>
                      )}
                    </span>
                  );
                })}
                {draft.addedVas.map((v) => (
                  <span
                    key={`va-add-${v.name}`}
                    className={`${chip} bg-green-600/20`}
                  >
                    {v.name}
                    <button
                      type='button'
                      aria-label={`撤销新增 ${v.name}`}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          addedVas: draft.addedVas.filter(
                            (x) => x.name !== v.name,
                          ),
                        })
                      }
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <M3eFormField variant='outlined' className='w-full'>
                <label slot='label' htmlFor='metadata-add-va'>
                  新增声优（回车确认）
                </label>
                <input
                  id='metadata-add-va'
                  type='text'
                  list='metadata-va-options'
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      addVa(e.currentTarget.value);
                      e.currentTarget.value = '';
                    }
                  }}
                  className='w-full border-none bg-transparent py-2 text-sm outline-none'
                />
              </M3eFormField>
              <datalist id='metadata-va-options'>
                {vasQuery.data?.map((v) => (
                  <option key={v.id} value={v.name} />
                ))}
              </datalist>
            </FieldRow>

            <p className='text-xs opacity-60'>
              保存只提交有改动的字段；标签/声优为增量动作，之后重新扫描新增的原始标签会自动出现在未编辑的作品上。
            </p>
          </>
        )}
      </div>
      <div slot='actions' className='flex justify-end gap-2'>
        <M3eButton variant='text' onClick={onClose}>
          取消
        </M3eButton>
        <M3eButton
          variant='filled'
          disabled={!buildPayload() || saveMutation.isPending}
          onClick={() => {
            const input = buildPayload();
            if (input) saveMutation.mutate(input, { onSuccess: onClose });
          }}
        >
          {saveMutation.isPending ? '保存中…' : '保存'}
        </M3eButton>
      </div>
    </M3eDialog>
  );
}

/** 字段行：标签 + 覆盖徽标 + 逐字段「恢复原始」；children 为编辑控件。 */
function FieldRow(props: {
  label: string;
  overridden: boolean;
  onReset: () => void;
  children: ReactNode;
}) {
  return (
    <div className='flex flex-col gap-1'>
      <div className='flex items-center gap-2'>
        <span className='text-sm opacity-70'>{props.label}</span>
        {props.overridden && (
          <>
            <span
              className='rounded bg-black/10 px-1 text-xs dark:bg-white/20'
              title='该字段已被管理员覆盖，与 DLsite 原始数据不同'
            >
              已覆盖
            </span>
            <button
              type='button'
              className='ml-auto text-xs underline opacity-70'
              onClick={props.onReset}
            >
              恢复原始
            </button>
          </>
        )}
      </div>
      {props.children}
    </div>
  );
}

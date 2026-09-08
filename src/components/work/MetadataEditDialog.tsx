import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { M3eButton } from '@m3e/react/button';
import {
  M3eInputChipSet,
  type M3eInputChipElement,
  type M3eInputChipSetElement,
} from '@m3e/react/chips';
import { M3eDialog, type M3eDialogElement } from '@m3e/react/dialog';
import { M3eFormField } from '@m3e/react/form-field';
import {
  M3eButtonSegment,
  M3eSegmentedButton,
} from '@m3e/react/segmented-button';
import { getTags, getVas } from '../../api/works';
import { SETTING_CONTROL_FILL } from '../../constants';
import { useM3eStyle } from '../../hooks/useM3eStyle';
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

  // 对话框卡片：限高 + 内容区内部滚动（头部/操作栏常驻），
  // 部件级样式注入同 components/preview/FilePreviewDialog.tsx
  const dialogRef = useM3eStyle<M3eDialogElement>({
    style: {
      '.base': { maxHeight: '90dvh' },
      '.content': {
        flex: 1,
        overflowY: 'auto',
        paddingTop: 'var(--md-sys-measurement-space300, 24px)',
        paddingBottom: 'var(--md-sys-measurement-space300, 24px)',
      },
    },
  });

  if (!open) return null;

  const overridden = new Set(detail?.overriddenFields ?? []);

  // 已存在的维度条目与手工新名字都按名提交（后端按名 upsert 幂等）。
  // chip DOM 由 m3e-input-chip-set 自治（见 ChipSetSync），此处只同步草稿状态。
  const addTagByName = (name: string) => {
    if (!draft) return;
    if (draft.addedTagNames.includes(name)) return;
    const existing = detail?.effective.tags.find((t) => t.name === name);
    if (existing) {
      // 重新输入刚移除的既有项 = 撤销移除（组件已把新 chip 建回 DOM）
      if (draft.removedTagIds.includes(existing.id)) {
        setDraft({
          ...draft,
          removedTagIds: draft.removedTagIds.filter((id) => id !== existing.id),
        });
      }
      return;
    }
    setDraft({ ...draft, addedTagNames: [...draft.addedTagNames, name] });
  };

  const removeTagByName = (name: string) => {
    if (!draft) return;
    if (draft.addedTagNames.includes(name)) {
      setDraft({
        ...draft,
        addedTagNames: draft.addedTagNames.filter((n) => n !== name),
      });
      return;
    }
    const existing = detail?.effective.tags.find((t) => t.name === name);
    if (existing && !draft.removedTagIds.includes(existing.id)) {
      setDraft({
        ...draft,
        removedTagIds: [...draft.removedTagIds, existing.id],
      });
    }
  };

  const addVaByName = (name: string) => {
    if (!draft) return;
    if (draft.addedVas.some((v) => v.name === name)) return;
    const existing = detail?.effective.vas.find((v) => v.name === name);
    if (existing) {
      if (draft.removedVaIds.includes(existing.id)) {
        setDraft({
          ...draft,
          removedVaIds: draft.removedVaIds.filter((id) => id !== existing.id),
        });
      }
      return;
    }
    setDraft({ ...draft, addedVas: [...draft.addedVas, { name }] });
  };

  const removeVaByName = (name: string) => {
    if (!draft) return;
    if (draft.addedVas.some((v) => v.name === name)) {
      setDraft({
        ...draft,
        addedVas: draft.addedVas.filter((v) => v.name !== name),
      });
      return;
    }
    const existing = detail?.effective.vas.find((v) => v.name === name);
    if (existing && !draft.removedVaIds.includes(existing.id)) {
      setDraft({
        ...draft,
        removedVaIds: [...draft.removedVaIds, existing.id],
      });
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

  return (
    <M3eDialog
      ref={dialogRef}
      className='[--m3e-dialog-min-width:95vw] [--m3e-dialog-max-width:95vw] lg:[--m3e-dialog-min-width:60vw] lg:[--m3e-dialog-max-width:60vw]'
      open={open}
      onClosed={onClose}
      dismissible
      closeLabel='关闭'
    >
      <span slot='header'>编辑元数据</span>
      <div className='flex flex-col gap-4'>
        {detailQuery.isLoading || !detail || !draft ? (
          <div className='py-8 text-center opacity-60'>加载中…</div>
        ) : (
          <>
            <FieldRow
              label='标题'
              overridden={overridden.has('title')}
              onReset={() => resetMutation.mutate('title')}
            >
              <SettingsInput
                label='标题'
                value={draft.title}
                onChange={(title) => setDraft({ ...draft, title })}
              />
            </FieldRow>

            <FieldRow
              label='社团'
              overridden={overridden.has('circle')}
              onReset={() => resetMutation.mutate('circle')}
            >
              <SettingsInput
                label='社团'
                value={draft.circleName}
                onChange={(circleName) => setDraft({ ...draft, circleName })}
              />
            </FieldRow>

            <FieldRow
              label='系列'
              overridden={overridden.has('series')}
              onReset={() => resetMutation.mutate('series')}
            >
              <SettingsInput
                label='系列'
                value={draft.seriesName}
                onChange={(seriesName) => setDraft({ ...draft, seriesName })}
              />
            </FieldRow>

            <FieldRow
              label='年龄分级'
              overridden={overridden.has('ageRating')}
              onReset={() => resetMutation.mutate('ageRating')}
            >
              {/* 组 value 为 getter-only：受控靠每段 checked（同 SettingRows.SegmentedRow） */}
              <M3eSegmentedButton
                className={SETTING_CONTROL_FILL}
                aria-label='年龄分级'
                onInput={(e) =>
                  setDraft({
                    ...draft,
                    ageRating: (e.target as HTMLInputElement)
                      .value as Draft['ageRating'],
                  })
                }
              >
                {(['all', 'r15', 'r18'] as const).map((v) => (
                  <M3eButtonSegment
                    key={v}
                    value={v}
                    checked={draft.ageRating === v}
                  >
                    {v}
                  </M3eButtonSegment>
                ))}
              </M3eSegmentedButton>
            </FieldRow>

            <FieldRow
              label='标签'
              overridden={overridden.has('tags')}
              onReset={() => resetMutation.mutate('tags')}
            >
              <M3eFormField
                variant='outlined'
                hideSubscript='always'
                className='w-full [--m3e-form-field-width:100%]'
              >
                <ChipSetSync
                  version={detail}
                  items={detail.effective.tags.map((t) => t.name)}
                  ariaLabel='标签'
                  listId='metadata-tag-options'
                  placeholder='新增标签，回车确认'
                  onAdd={addTagByName}
                  onRemove={removeTagByName}
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
              <M3eFormField
                variant='outlined'
                hideSubscript='always'
                className='w-full [--m3e-form-field-width:100%]'
              >
                <ChipSetSync
                  version={detail}
                  items={detail.effective.vas.map((v) => v.name)}
                  ariaLabel='声优'
                  listId='metadata-va-options'
                  placeholder='新增声优，回车确认'
                  onAdd={addVaByName}
                  onRemove={removeVaByName}
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

/**
 * 组件自治的输入 chip 集合（m3e-input-chip-set 的正确用法）。
 *
 * chip 的 DOM 完全由 m3e-input-chip-set 自己增删：Enter 提交时自建 chip、
 * remove 事件时自摘节点（源码 handleChipRemove 会 chip.remove()）。
 * 不能用 JSX 渲染 chip——组件命令式摘除后 React 再卸载同一节点会报
 * 「Node.removeChild: not a child of this node」。
 *
 * React 侧只渲染 slotted 输入框：初始 chips 在 version（detail 对象）变化时
 * 命令式重建；增/删通过 change 事件（detail.type add/remove + value）同步草稿。
 */
function ChipSetSync(props: {
  /** 重建标识：detail 对象身份变化（载入/恢复/保存后重拉）时重建全部 chip */
  version: unknown;
  /** 初始 chip 集合（value = label = 维度名） */
  items: string[];
  ariaLabel: string;
  listId: string;
  placeholder: string;
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
}) {
  const ref = useRef<M3eInputChipSetElement>(null);

  // 按 version 重建初始 chips（items 随 version 一起变，不进依赖避免每渲染重建）
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    (async () => {
      await el.updateComplete;
      if (cancelled) return;
      for (const chip of [...el.chips]) chip.remove();
      for (const name of props.items) {
        if (cancelled) return;
        const chip = document.createElement('m3e-input-chip');
        chip.removable = true;
        chip.value = name;
        chip.textContent = name;
        el.appendChild(chip);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.version]);

  // 增/删经 change 事件同步回草稿；remove 的 value 取自 chip.value（初始 chip 已设）
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    function onChange(e: Event) {
      const { type, value, chip } = (
        e as CustomEvent<{
          type: 'add' | 'remove';
          value: string;
          chip: M3eInputChipElement;
        }>
      ).detail;
      if (type === 'add') {
        // 组件自建 chip 未设 value（无 autocomplete 匹配时），补上供后续 remove 识别
        chip.value = value;
        props.onAdd(value);
      } else if (value) {
        props.onRemove(value);
      }
    }
    el.addEventListener('change', onChange);
    return () => el.removeEventListener('change', onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.onAdd, props.onRemove]);

  return (
    <M3eInputChipSet ref={ref} aria-label={props.ariaLabel}>
      <input
        slot='input'
        type='text'
        aria-label={props.placeholder}
        list={props.listId}
        placeholder={props.placeholder}
      />
    </M3eInputChipSet>
  );
}

/**
 * 高级设置（pages/Dashboard/SettingRows.tsx 的 InputRow）同款 outlined 输入框。
 * 可见标签在 FieldRow 头部，此处 input 沿用其 aria-label + 无边框样式。
 */
function SettingsInput(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <M3eFormField
      variant='outlined'
      hideSubscript='always'
      className='w-full [--m3e-form-field-width:100%]'
    >
      <input
        type='text'
        aria-label={props.label}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className='w-full border-none bg-transparent py-2 text-sm outline-none'
      />
    </M3eFormField>
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

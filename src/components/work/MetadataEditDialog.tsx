import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  M3eAutocomplete,
  type AutocompleteQueryEventDetail,
  type M3eAutocompleteElement,
} from '@m3e/react/autocomplete';
import { M3eButton } from '@m3e/react/button';
import {
  M3eInputChipSet,
  type M3eInputChipElement,
  type M3eInputChipSetElement,
} from '@m3e/react/chips';
import { M3eDialog } from '@m3e/react/dialog';
import { M3eFormField } from '@m3e/react/form-field';
import { M3eOption, type M3eOptionElement } from '@m3e/react/option';
import {
  M3eButtonSegment,
  M3eSegmentedButton,
} from '@m3e/react/segmented-button';
import { getCircles, getSeries, getTags, getVas } from '../../api/works';
import { SETTING_CONTROL_FILL } from '../../constants';
import {
  useMetadataOverride,
  useSaveMetadataOverrideMutation,
} from '../../queries/useMetadataOverrideQuery';
import type {
  MetadataField,
  MetadataOverrideDetail,
  SaveMetadataOverrideInput,
} from '../../types';
import clsx from 'clsx';

interface Props {
  workId: string;
  open: boolean;
  onClose: () => void;
}

/**
 * 弹窗编辑状态：标量 = 最终值草稿；tags/vas = 动作列表（基准跟随 resetFields：
 * 默认相对载入时生效值，标记 reset 后相对原始值，与 chips 显示集合一致）。
 * resetFields = 本会话点过「恢复原始」的字段（纯本地草稿标记，保存时随 PATCH
 * resetFields 原子提交；标量被再编辑则撤销标记，tags/vas 被再编辑保留标记——
 * 后端先 purge 后 apply，动作相对 original 叠加）。保存只提交有变化的键
 * （空 payload 时按钮置灰）。
 */
interface Draft {
  title: string;
  circleName: string;
  seriesName: string;
  ageRating: 'all' | 'r15' | 'r18';
  resetFields: MetadataField[];
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
    resetFields: [],
    removedTagIds: [],
    addedTagNames: [],
    removedVaIds: [],
    addedVas: [],
  };
}

export default function MetadataEditDialog({ workId, open, onClose }: Props) {
  const { t } = useTranslation();
  const detailQuery = useMetadataOverride(workId, open);
  const detail = detailQuery.data ?? null;
  const [draft, setDraft] = useState<Draft | null>(null);
  const saveMutation = useSaveMetadataOverrideMutation(workId);

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
  // 社团/系列：与列表页共享缓存（useListQuery 同 key），仅弹窗打开时拉取
  const circlesQuery = useQuery({
    queryKey: ['circles'],
    queryFn: getCircles,
    enabled: open,
  });
  const seriesQuery = useQuery({
    queryKey: ['series'],
    queryFn: getSeries,
    enabled: open,
  });

  // 草稿生命周期以「会话」驱动：session = 打开时的 workId（关闭 = null）。
  // P1-13：useMetadataOverride staleTime 0 + refetchOnWindowFocus，后台 refetch
  // 会以新对象身份返回 detail；旧逻辑「detail 变了就 toDraft 整体重置」会把
  // 用户未保存的编辑静默清掉（切窗口回来即丢数据）。新语义：
  // 1) 会话变化（打开/workId 切换）后的首次载入才整体播种；
  // 2) 会话内后续 refetch 一律不动草稿（「恢复原始」已改为纯本地草稿操作，
  //    不存在需要 refetch 合并的待恢复字段）；
  // 3) 以下两个顺序块沿用渲染期 setState 模式（刻意不用 effect，避免
  //    react-hooks/set-state-in-effect 级联渲染，与旧实现一致）。
  const session = open ? workId : null;
  const [prevSession, setPrevSession] = useState<string | null>(null);
  const [seededSession, setSeededSession] = useState<string | null>(null);
  const [chipEpochs, setChipEpochs] = useState({ tags: 0, vas: 0 });

  // 块 1：会话切换 → 作废上一会话的播种，清空草稿（含 reset 标记）。
  // 关闭（session = null）也走这里：未保存编辑即刻放弃，重开不残留。
  if (session !== prevSession) {
    setPrevSession(session);
    setSeededSession(null);
    setDraft(null);
  }
  // 块 2：本会话首次拿到 detail（含关闭态下缓存已存在的情况，重开时
  // 再次播种，语义一致）→ 用生效值整体播种，动作列表与 reset 标记清零，
  // chip DOM 同步重建（epoch 号变化触发 ChipSetSync 重建，见 version 注释）。
  if (detail && seededSession !== session) {
    setSeededSession(session);
    setDraft(toDraft(detail));
    setChipEpochs((e) => ({ tags: e.tags + 1, vas: e.vas + 1 }));
  }

  // 对话框高度：用官方变量 --m3e-dialog-max-height 限高（2.7.11 起默认
  // min(560px, 100% - 48px)），内容超出时由 dialog 内置的 m3e-scroll-container
  // 滚动（.content 自带 flex/padding，无需注入）。
  // 注：不使用 useM3eStyle——open=false 时 dialog 未渲染，ref 为 null，
  // 挂载时一次性注入会空跑且不再重试。

  if (!open) return null;

  const overridden = new Set(detail?.overriddenFields ?? []);
  // reset 标记下被覆盖徽标/按钮立即隐藏（保存成功重开后按服务器状态重现）
  const resetMarked = (field: MetadataField): boolean =>
    draft?.resetFields.includes(field) ?? false;

  // 已存在的维度条目与手工新名字都按名提交（后端按名 upsert 幂等）。
  // chip DOM 由 m3e-input-chip-set 自治（见 ChipSetSync），此处只同步草稿状态。
  // 增删判定基准跟随 reset 标记：标记 tags/vas 后动作相对 original（后端先
  // purge 后 apply，结果 = original + 本次编辑），否则维持相对 effective。
  const addTagByName = (name: string) => {
    if (!draft || !detail) return;
    if (draft.addedTagNames.includes(name)) return;
    const basis = resetMarked('tags')
      ? detail.original.tags
      : detail.effective.tags;
    const existing = basis.find((t) => t.name === name);
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
    if (!draft || !detail) return;
    if (draft.addedTagNames.includes(name)) {
      setDraft({
        ...draft,
        addedTagNames: draft.addedTagNames.filter((n) => n !== name),
      });
      return;
    }
    const basis = resetMarked('tags')
      ? detail.original.tags
      : detail.effective.tags;
    const existing = basis.find((t) => t.name === name);
    if (existing && !draft.removedTagIds.includes(existing.id)) {
      setDraft({
        ...draft,
        removedTagIds: [...draft.removedTagIds, existing.id],
      });
    }
  };

  const addVaByName = (name: string) => {
    if (!draft || !detail) return;
    if (draft.addedVas.some((v) => v.name === name)) return;
    const basis = resetMarked('vas')
      ? detail.original.vas
      : detail.effective.vas;
    const existing = basis.find((v) => v.name === name);
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
    if (!draft || !detail) return;
    if (draft.addedVas.some((v) => v.name === name)) {
      setDraft({
        ...draft,
        addedVas: draft.addedVas.filter((v) => v.name !== name),
      });
      return;
    }
    const basis = resetMarked('vas')
      ? detail.original.vas
      : detail.effective.vas;
    const existing = basis.find((v) => v.name === name);
    if (existing && !draft.removedVaIds.includes(existing.id)) {
      setDraft({
        ...draft,
        removedVaIds: [...draft.removedVaIds, existing.id],
      });
    }
  };

  const buildPayload = (): SaveMetadataOverrideInput | null => {
    if (!draft || !detail) return null;
    const resets = draft.resetFields;
    // 标量三态：reset 标记 → 显式 null（撤销覆盖；「手输回原值」不是 reset，
    // 走 diff 作为普通覆盖钉住）；有编辑 → diff vs effective 提交最终值；
    // 未改 → undefined（不提交该键）。tags/vas 动作在 reset 标记下本就相对
    // original 基准，直发即可；tagsCleared/vasCleared 由后端 reset 语义处理。
    const input: SaveMetadataOverrideInput = {
      title: resets.includes('title')
        ? null
        : draft.title !== detail.effective.title
          ? draft.title
          : undefined,
      circleName: resets.includes('circle')
        ? null
        : draft.circleName !== (detail.effective.circle?.name ?? '')
          ? draft.circleName || null
          : undefined,
      seriesName: resets.includes('series')
        ? null
        : draft.seriesName !== (detail.effective.series?.name ?? '')
          ? draft.seriesName || null
          : undefined,
      ageRating: resets.includes('ageRating')
        ? null
        : draft.ageRating !== detail.effective.ageRating
          ? draft.ageRating
          : undefined,
      addTags: draft.addedTagNames.length > 0 ? draft.addedTagNames : undefined,
      removeTagIds:
        draft.removedTagIds.length > 0 ? draft.removedTagIds : undefined,
      addVas: draft.addedVas.length > 0 ? draft.addedVas : undefined,
      removeVaIds:
        draft.removedVaIds.length > 0 ? draft.removedVaIds : undefined,
      resetFields: resets.length > 0 ? resets : undefined,
    };
    const hasAny = Object.values(input).some((v) => v !== undefined);
    return hasAny ? input : null;
  };

  // 「恢复原始」统一入口：纯本地草稿操作（零网络请求）——立即把界面恢复为
  // 原始值并记入 draft.resetFields，保存时经 PATCH resetFields 原子提交；
  // 取消/关闭即随草稿丢弃。标量直接落 original 值（空值回退与 toDraft 一致）；
  // tags/vas 清空动作列表并 bump chip epoch（DOM 以 original 集合重建）。
  const resetField = (field: MetadataField) => {
    if (!draft || !detail) return;
    const mark = draft.resetFields.includes(field)
      ? draft.resetFields
      : [...draft.resetFields, field];
    if (field === 'tags') {
      setDraft({
        ...draft,
        resetFields: mark,
        removedTagIds: [],
        addedTagNames: [],
      });
      setChipEpochs((e) => ({ ...e, tags: e.tags + 1 }));
    } else if (field === 'vas') {
      setDraft({
        ...draft,
        resetFields: mark,
        removedVaIds: [],
        addedVas: [],
      });
      setChipEpochs((e) => ({ ...e, vas: e.vas + 1 }));
    } else {
      const scalar =
        field === 'title'
          ? { title: detail.original.title }
          : field === 'circle'
            ? { circleName: detail.original.circle?.name ?? '' }
            : field === 'series'
              ? { seriesName: detail.original.series?.name ?? '' }
              : {
                  ageRating:
                    (detail.original.ageRating as Draft['ageRating']) ?? 'all',
                };
      setDraft({ ...draft, resetFields: mark, ...scalar });
    }
  };

  return (
    <M3eDialog
      className={clsx(
        // 官方 CSS 变量：弹窗尺寸 + 下拉面板限高（变量沿 DOM 继承到面板）
        '[--m3e-dialog-min-width:95vw] [--m3e-dialog-max-width:95vw]',
        'lg:[--m3e-dialog-min-width:60vw] lg:[--m3e-dialog-max-width:60vw]',
        '[--m3e-dialog-max-height:90dvh]',
        '[--m3e-option-panel-container-max-height:380px]',
      )}
      open={open}
      onClosed={onClose}
      dismissible
      closeLabel={t('common.close')}
    >
      <span slot='header'>{t('works.meta.title')}</span>
      <div className='flex flex-col gap-4'>
        {detailQuery.isLoading || !detail || !draft ? (
          <div className='py-8 text-center opacity-60'>
            {t('works.meta.loading')}
          </div>
        ) : (
          <>
            <FieldRow
              label={t('works.meta.field-title')}
              overridden={overridden.has('title') && !resetMarked('title')}
              onReset={() => resetField('title')}
            >
              <SettingsInput
                label={t('works.meta.field-title')}
                value={draft.title}
                onChange={(title) =>
                  setDraft({
                    ...draft,
                    title,
                    // reset 后再编辑 = 转为普通覆盖（标量全量替换，无需基准），
                    // 撤销 reset 标记；「手输回原值」是重新钉住，不发 null
                    resetFields: draft.resetFields.filter((f) => f !== 'title'),
                  })
                }
              />
            </FieldRow>

            <FieldRow
              label={t('works.meta.field-circle')}
              overridden={overridden.has('circle') && !resetMarked('circle')}
              onReset={() => resetField('circle')}
            >
              <SingleAutocomplete
                label={t('works.meta.field-circle')}
                placeholder={t('works.meta.filter-placeholder')}
                value={draft.circleName}
                candidates={circlesQuery.data?.map((c) => c.name) ?? []}
                onChange={(circleName) =>
                  setDraft({
                    ...draft,
                    circleName,
                    resetFields: draft.resetFields.filter(
                      (f) => f !== 'circle',
                    ),
                  })
                }
              />
            </FieldRow>

            <FieldRow
              label={t('works.meta.field-series')}
              overridden={overridden.has('series') && !resetMarked('series')}
              onReset={() => resetField('series')}
            >
              <SingleAutocomplete
                label={t('works.meta.field-series')}
                placeholder={t('works.meta.filter-placeholder')}
                value={draft.seriesName}
                candidates={seriesQuery.data?.map((s) => s.name) ?? []}
                onChange={(seriesName) =>
                  setDraft({
                    ...draft,
                    seriesName,
                    resetFields: draft.resetFields.filter(
                      (f) => f !== 'series',
                    ),
                  })
                }
              />
            </FieldRow>

            <FieldRow
              label={t('works.meta.field-age-rating')}
              overridden={
                overridden.has('ageRating') && !resetMarked('ageRating')
              }
              onReset={() => resetField('ageRating')}
            >
              {/* 组 value 为 getter-only：受控靠每段 checked（同 SettingRows.SegmentedRow） */}
              <M3eSegmentedButton
                className={SETTING_CONTROL_FILL}
                aria-label={t('works.meta.field-age-rating')}
                onInput={(e) =>
                  setDraft({
                    ...draft,
                    ageRating: (e.target as HTMLInputElement)
                      .value as Draft['ageRating'],
                    resetFields: draft.resetFields.filter(
                      (f) => f !== 'ageRating',
                    ),
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
              label={t('works.meta.field-tags')}
              overridden={overridden.has('tags') && !resetMarked('tags')}
              onReset={() => resetField('tags')}
            >
              <M3eFormField
                variant='outlined'
                hideSubscript='always'
                className='w-full [--m3e-form-field-width:100%]'
              >
                <ChipSetSync
                  version={chipEpochs.tags}
                  items={(resetMarked('tags')
                    ? detail.original.tags
                    : detail.effective.tags
                  ).map((t) => t.name)}
                  candidates={tagsQuery.data?.map((t) => t.name) ?? []}
                  ariaLabel={t('works.meta.field-tags')}
                  placeholder={t('works.meta.tags-placeholder')}
                  onAdd={addTagByName}
                  onRemove={removeTagByName}
                />
              </M3eFormField>
            </FieldRow>

            <FieldRow
              label={t('works.meta.field-vas')}
              overridden={overridden.has('vas') && !resetMarked('vas')}
              onReset={() => resetField('vas')}
            >
              <M3eFormField
                variant='outlined'
                hideSubscript='always'
                className='w-full [--m3e-form-field-width:100%]'
              >
                <ChipSetSync
                  version={chipEpochs.vas}
                  items={(resetMarked('vas')
                    ? detail.original.vas
                    : detail.effective.vas
                  ).map((v) => v.name)}
                  candidates={vasQuery.data?.map((v) => v.name) ?? []}
                  ariaLabel={t('works.meta.field-vas')}
                  placeholder={t('works.meta.vas-placeholder')}
                  onAdd={addVaByName}
                  onRemove={removeVaByName}
                />
              </M3eFormField>
            </FieldRow>

            <p className='text-xs opacity-60'>{t('works.meta.hint')}</p>
          </>
        )}
      </div>
      <div slot='actions' className='flex justify-end gap-2'>
        <M3eButton variant='text' onClick={onClose}>
          {t('common.cancel')}
        </M3eButton>
        <M3eButton
          variant='filled'
          disabled={!buildPayload() || saveMutation.isPending}
          onClick={() => {
            const input = buildPayload();
            if (input) saveMutation.mutate(input, { onSuccess: onClose });
          }}
        >
          {saveMutation.isPending
            ? t('works.meta.saving')
            : t('works.meta.save')}
        </M3eButton>
      </div>
    </M3eDialog>
  );
}

/** autocomplete 下拉最多展示的候选条数（配合全局 380px 面板限高，8 条约 374px 全显） */
const MAX_AUTOCOMPLETE_OPTIONS = 8;

/**
 * ChipSetSync 输入框 id 生成器（须为 CSS 安全 ident：chip-set 与 autocomplete
 * 都用 querySelector 按 id 解析联动，React useId 的 «r0» 格式不可靠）
 */
let chipInputIdSeed = 0;

/**
 * 按当前输入计算下拉候选：空输入给默认前缀（前 8 条），非空 contains 过滤。
 * 必须保证克隆快照非空：autocomplete 的 showMenu 在 input/focus 时同步读
 * light-DOM 选项的克隆快照判定是否开面板，而 React 渲染 + MutationObserver
 * 重建克隆是异步的——若把空结果渲染为空，面板将永远等不到首次打开。
 */
function computeChipOptions(candidates: string[], term: string): string[] {
  const t = term.trim().toLowerCase();
  const pool = t
    ? candidates.filter((name) => name.toLowerCase().includes(t))
    : candidates;
  return pool.slice(0, MAX_AUTOCOMPLETE_OPTIONS);
}

/**
 * 组件自治的输入 chip 集合（m3e-input-chip-set 的正确用法），
 * 配套 m3e-autocomplete 提供按输入过滤的候选下拉（query 事件模式）。
 *
 * chip 的 DOM 完全由 m3e-input-chip-set 自己增删：Enter 提交时自建 chip、
 * remove 事件时自摘节点（源码 handleChipRemove 会 chip.remove()）。
 * 不能用 JSX 渲染 chip——组件命令式摘除后 React 再卸载同一节点会报
 * 「Node.removeChild: not a child of this node」。
 *
 * React 侧只渲染 slotted 输入框与候选选项：初始 chips 在 version
 * （播种/reset 时的 chipEpochs 号）变化时命令式重建；候选 options 在 query
 * 事件后按输入过滤渲染；chip 增/删通过 chip-set 的 change 事件
 * （detail.type add/remove + value）同步草稿。
 */
function ChipSetSync(props: {
  /** 重建标识：播种或本地 reset（epoch 号 +1）触发重建；
   *  普通 refetch 号不变、不重建（否则 DOM chips 会打回服务器值，与草稿失同步） */
  version: unknown;
  /** 初始 chip 集合（value = label = 维度名） */
  items: string[];
  /** 候选全量：autocomplete 按输入过滤后最多展示 MAX_AUTOCOMPLETE_OPTIONS 条 */
  candidates: string[];
  ariaLabel: string;
  placeholder: string;
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
}) {
  const { t } = useTranslation();
  const ref = useRef<M3eInputChipSetElement>(null);
  const autocompleteRef = useRef<M3eAutocompleteElement>(null);
  const [inputId] = useState(() => `metadata-chip-input-${++chipInputIdSeed}`);
  const [options, setOptions] = useState<string[]>([]);

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

  // autocomplete 的 query 事件：按输入更新候选（空输入 = 默认前缀，见
  // computeChipOptions）。candidates 存 ref 避免监听器随派生数组每渲染重挂。
  const candidatesRef = useRef(props.candidates);
  // 最新 candidates 给事件监听器（渲染期禁写 ref，改在 effect 同步）
  useEffect(() => {
    candidatesRef.current = props.candidates;
  }, [props.candidates]);
  const termRef = useRef('');
  useEffect(() => {
    const el = autocompleteRef.current;
    if (!el) return;
    function onQuery(e: CustomEvent<AutocompleteQueryEventDetail>) {
      termRef.current = e.detail.term;
      setOptions(computeChipOptions(candidatesRef.current, termRef.current));
    }
    el.addEventListener('query', onQuery);
    return () => el.removeEventListener('query', onQuery);
  }, []);

  // 候选数据异步到达/变化时按当前词重算，避免面板停留在空快照
  useEffect(() => {
    setOptions(computeChipOptions(props.candidates, termRef.current));
  }, [props.candidates]);

  // 下拉面板挂载：@m3e/web 2.7.11 起 autocomplete 会优先把面板挂到
  // closest("m3e-dialog")（旧版硬编码挂 body，会被 showModal 的 hit-test
  // 拦截导致无法点击/滚动）；本次升级后无需再手工搬运。

  return (
    <>
      <M3eInputChipSet ref={ref} aria-label={props.ariaLabel}>
        <input
          slot='input'
          id={inputId}
          type='text'
          aria-label={props.placeholder}
          placeholder={props.placeholder}
        />
      </M3eInputChipSet>
      {/* 不设 hideNoData：无匹配时面板显示「无匹配项」并保持打开——
          autocomplete 仅在菜单存在时随选项变化重投影（handleMutation 的
          if (this.menu) 分支），一旦因无匹配关面板，之后的选项恢复将无人
          重新打开（克隆更新不触发 showMenu）。面板由组件投影到 body，
          不受弹窗内容区 overflow 裁剪；required 保持 false 保留自由输入。
          panelClass：全局样式把面板限高提到 380px，8 条候选全显无滚动。 */}
      <M3eAutocomplete
        ref={autocompleteRef}
        htmlFor={inputId}
        panelClass='metadata-autocomplete-panel'
        noDataLabel={t('works.meta.no-match')}
      >
        {options.map((name) => (
          <M3eOption key={name} value={name}>
            {name}
          </M3eOption>
        ))}
      </M3eAutocomplete>
    </>
  );
}

/**
 * 单选 autocomplete 输入框（社团/系列）：自由输入 + 下拉候选（与 ChipSetSync
 * 共用 computeChipOptions 过滤规则与 380px 面板限高），区别是无 chip-set——
 * input 本身就是唯一值。
 *
 * 联动要点（@m3e/web 2.7.11 selectOption 源码）：
 * - 选中时组件直接赋 input.value = option.label（不派发 input 事件），随后
 *   在 autocomplete 元素上派发 bubbles 的 change——草稿必须监听该 change
 *   同步，否则 React 下次渲染会把输入框值打回旧草稿。
 * - selectOption 开头 if (option.selected) return：已选中的 option 再点会
 *   静默失效（先选 A、改输入、再点回 A 的路径）。query 每次输入都会派发，
 *   在此清除全部 option 的选中态，保证重选始终生效。
 * - required 必须保持 false：required 时组件会在 change 里把 input.value
 *   强制改写为选中 label，自由输入会被抹掉。
 */
function SingleAutocomplete(props: {
  label: string;
  placeholder: string;
  value: string;
  /** 候选全量：按输入过滤后最多展示 MAX_AUTOCOMPLETE_OPTIONS 条 */
  candidates: string[];
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const autocompleteRef = useRef<M3eAutocompleteElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputId] = useState(
    () => `metadata-single-input-${++chipInputIdSeed}`,
  );
  const [options, setOptions] = useState<string[]>([]);

  const candidatesRef = useRef(props.candidates);
  // 最新 candidates 给事件监听器（渲染期禁写 ref，改在 effect 同步）
  useEffect(() => {
    candidatesRef.current = props.candidates;
  }, [props.candidates]);
  const termRef = useRef('');

  // query 事件：按输入更新候选 + 清除 option 选中态（重选同项需能再次
  // selectOption，见组件注释）。candidates 存 ref 避免监听器随派生数组重挂。
  useEffect(() => {
    const el = autocompleteRef.current;
    if (!el) return;
    function onQuery(e: CustomEvent<AutocompleteQueryEventDetail>) {
      const current = autocompleteRef.current;
      if (!current) return;
      termRef.current = e.detail.term;
      setOptions(computeChipOptions(candidatesRef.current, termRef.current));
      for (const opt of current.querySelectorAll<M3eOptionElement>(
        'm3e-option',
      ))
        opt.selected = false;
    }
    el.addEventListener('query', onQuery);
    return () => el.removeEventListener('query', onQuery);
  }, []);

  // 选中 option 时组件派发 bubbles change（此时 input.value 已是 label）
  useEffect(() => {
    const el = autocompleteRef.current;
    if (!el) return;
    function onChange() {
      if (inputRef.current) props.onChange(inputRef.current.value);
    }
    el.addEventListener('change', onChange);
    return () => el.removeEventListener('change', onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.onChange]);

  // 候选数据异步到达/变化时按当前词重算，避免面板停留在空快照
  useEffect(() => {
    setOptions(computeChipOptions(props.candidates, termRef.current));
  }, [props.candidates]);

  return (
    <M3eFormField
      variant='outlined'
      hideSubscript='always'
      className='w-full [--m3e-form-field-width:100%]'
    >
      <input
        ref={inputRef}
        id={inputId}
        type='text'
        aria-label={props.label}
        placeholder={props.placeholder}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className='w-full border-none bg-transparent py-2 text-sm outline-none'
      />
      <M3eAutocomplete
        ref={autocompleteRef}
        htmlFor={inputId}
        panelClass='metadata-autocomplete-panel'
        noDataLabel={t('works.meta.no-match')}
      >
        {options.map((name) => (
          <M3eOption key={name} value={name}>
            {name}
          </M3eOption>
        ))}
      </M3eAutocomplete>
    </M3eFormField>
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
  const { t } = useTranslation();
  return (
    <div className='flex flex-col gap-1'>
      <div className='flex items-center gap-2'>
        <span className='text-sm opacity-70'>{props.label}</span>
        {props.overridden && (
          <>
            <span
              className='rounded bg-black/10 px-1 text-xs dark:bg-white/20'
              title={t('works.field-overridden')}
            >
              {t('works.meta.overridden')}
            </span>
            <button
              type='button'
              className='ml-auto text-xs underline opacity-70'
              onClick={props.onReset}
            >
              {t('works.meta.reset')}
            </button>
          </>
        )}
      </div>
      {props.children}
    </div>
  );
}

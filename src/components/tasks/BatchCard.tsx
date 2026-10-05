import { useEffect, useRef } from 'react';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import { M3eButton } from '@m3e/react/button';
import { M3eExpansionPanel } from '@m3e/react/expansion-panel';
import type { M3eExpansionPanelElement } from '@m3e/web/expansion-panel';
import type { BatchInfo, WorkPipelineState } from '../../api/tasks';
import PhaseDots from './PhaseDots';

/**
 * 批次卡片（m3e-expansion-panel）：header = kind 标签 + 状态 + 合计进度 + 取消；
 * 面板内容 = 各作品流水线阶段点（含失败原因）。toggle 统一在左侧
 * （toggle-position="before"）。
 *
 * 开合为非受控：仅挂载时把 running 批次设为初始展开；之后完全由组件内部管理。
 * 不用受控 open prop——任务面板随 SSE 快照（250ms 节流）高频重渲染，
 * 受控值会把组件内部正在动画的 open 拉回旧值，打断展开动画。
 *
 * 无流水线的批次仍渲染 panel（toggle 展示但 disabled，不可点击展开）。
 */
export default function BatchCard({
  batch,
  pipelines,
  onCancel,
}: {
  batch: BatchInfo;
  pipelines: WorkPipelineState[];
  onCancel: (batchId: string) => void;
}) {
  const { t } = useTranslation();
  const panelRef = useRef<M3eExpansionPanelElement>(null);

  // 初始展开仅 running 批次；后续开合由组件自管（不受 React 重渲染覆盖）
  useEffect(() => {
    if (panelRef.current && batch.status === 'running') {
      panelRef.current.open = true;
    }
  }, [batch.status]);

  const done = batch.counters.completed + batch.counters.failed;
  const statusKey = `tasks.status.${batch.status}` as const;
  const kindKey = `tasks.kind.${batch.kind}` as const;
  const expandable = pipelines.length > 0;
  /** header 摘要（官方单行高度内垂直居中） */
  const header = (
    <span className='flex w-full min-w-0 items-center gap-2 text-left'>
      <span className='shrink-0 rounded bg-[var(--md-sys-color-surface-variant)] px-2 py-0.5 text-xs'>
        {t(kindKey)}
      </span>
      <span className='min-w-0 flex-1 truncate text-xs opacity-60'>
        {t(statusKey)}
        {batch.completedAt ? ` · ${batch.completedAt}` : ''}
      </span>
      {batch.status === 'running' && (
        <M3eButton
          variant='text'
          className='shrink-0 text-[var(--md-sys-color-error)]'
          onClick={(e: Event) => {
            // 阻断冒泡：点取消不应触发 header 的展开/收起 toggle
            e.stopPropagation();
            onCancel(batch.batchId);
          }}
        >
          {t('tasks.cancel')}
        </M3eButton>
      )}
      <span className='shrink-0 text-xs tabular-nums opacity-70'>
        {t('tasks.count.progress', { done, total: batch.counters.total })}
      </span>
    </span>
  );

  /** 面板内容：各作品流水线阶段点 */
  const rows = (
    <ul className='m-0 flex list-none flex-col gap-1 p-0 text-xs'>
      {pipelines.map((p) => {
        const failedPhase = Object.values(p.phases).find(
          (ph) => ph.status === 'failed',
        );
        return (
          <li key={p.workId} className='flex items-center gap-2'>
            <span className='w-24 shrink-0 truncate font-mono'>{p.workId}</span>
            <PhaseDots pipeline={p} />
            {failedPhase?.error && (
              <span
                className='min-w-0 flex-1 truncate text-[var(--md-sys-color-error)]'
                title={failedPhase.error}
              >
                {failedPhase.error}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );

  return (
    <M3eExpansionPanel
      ref={panelRef}
      togglePosition='before'
      disabled={!expandable}
      className={clsx(
        'rounded-md border border-[var(--md-sys-color-outline-variant)] text-sm',
        // toggle 在左（12px 与边缘间距）+ 右侧内容留白 16px；保持官方 48/64px
        // 数值高度（数值才能 height 过渡动画，auto 会杀死动画）
        '[--m3e-expansion-header-padding-left:12px] [--m3e-expansion-header-padding-right:16px]',
        // 显式恢复动画时长：TaskCenterDialog 所在的 index.css 压制了
        // --md-sys-motion-duration-*（dialog 自身动画），会继承给 dialog 内所有
        // m3e 组件；此变量是官方扩展点，短路时长链（fallback 250ms = medium1）
        '[--m3e-collapsible-animation-duration:250ms]',
        // 无流水线批次仅禁点击，不禁视觉（保持正常文字外观）
        !expandable && '[--m3e-expansion-panel-disabled-text-opacity:1]',
      )}
    >
      <span slot='header'>{header}</span>
      {rows}
    </M3eExpansionPanel>
  );
}

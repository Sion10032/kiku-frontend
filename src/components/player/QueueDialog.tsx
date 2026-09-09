import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { M3eDialog } from '@m3e/react/dialog';
import { M3eIcon } from '@m3e/react/icon';
import { useTranslation } from 'react-i18next';
import '@m3e/icons/outlined/drag_indicator';
import clsx from 'clsx';
import { usePlayerStore, type QueuedTrack } from '../../stores/playerStore';

/**
 * 播放列表对话框：列出队列、当前曲目高亮、点击切曲、拖拽排序。
 * 从 AudioPlayer 抽出，供全屏播放器与 PlayerBar 复用。
 */
export default function QueueDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const queue = usePlayerStore((s) => s.queue);
  const currentUid = usePlayerStore((s) => s.currentUid);
  const playFromQueue = usePlayerStore((s) => s.playFromQueue);
  const reorderQueue = usePlayerStore((s) => s.reorderQueue);

  const sensors = useSensors(
    // 5px 拖动阈值，避免点击切曲被误判为拖拽
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (over == null || active.id === over.id) return;
    const oldIndex = queue.findIndex((t) => t.uid === active.id);
    const newIndex = queue.findIndex((t) => t.uid === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    reorderQueue(oldIndex, newIndex);
  }

  return (
    // m3e-dialog 的 max-width 默认 560px，覆盖了浏览器对原生 <dialog> 的
    // 视口保护，窄屏会横向溢出；clamp 到视口内（下划线 = 空格）
    <M3eDialog
      open={open}
      onClosed={onClose}
      dismissible
      closeLabel={t('common.close')}
      className='[--m3e-dialog-max-width:min(560px,calc(100vw-2rem))] [--m3e-dialog-min-width:min(280px,calc(100vw-2rem))]'
    >
      <span slot='header'>{t('player.queue-title', { n: queue.length })}</span>

      <div className='max-h-[60vh] overflow-y-auto'>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={queue.map((t) => t.uid)}
            strategy={verticalListSortingStrategy}
          >
            {queue.map((track) => (
              <QueueRow
                key={track.uid}
                track={track}
                active={track.uid === currentUid}
                onPlay={() => playFromQueue(track.uid)}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </M3eDialog>
  );
}

/**
 * 播放列表行：可拖拽（drag_indicator 把手），点击切曲并播放。
 */
function QueueRow({
  track,
  active,
  onPlay,
}: {
  track: QueuedTrack;
  active: boolean;
  onPlay: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: track.uid });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onClick={onPlay}
      className={clsx(
        'flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2',
        active
          ? 'bg-(--md-sys-color-primary-container) text-(--md-sys-color-on-primary-container)'
          : 'hover:bg-(--md-sys-color-surface-container-high)',
      )}
      {...attributes}
      {...listeners}
    >
      <M3eIcon name='drag_indicator' className='shrink-0 opacity-40' />
      <div className='min-w-0 flex-1'>
        <div className='truncate text-sm'>{track.title}</div>
        <div className='truncate text-xs opacity-60'>{track.workTitle}</div>
      </div>
    </div>
  );
}

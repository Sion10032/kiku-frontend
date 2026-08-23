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
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { M3eDialog } from '@m3e/react/dialog';
import { M3eIcon } from '@m3e/react/icon';
import '@m3e/icons/outlined/drag_indicator';
import { usePlayerStore, type Track } from '../stores/playerStore';

/**
 * 播放列表对话框：列出队列、当前曲目高亮、点击切曲、拖拽排序。
 * 从 AudioPlayer 抽出，供全屏播放器与 PlayerBar 复用。
 */
export default function QueueDialog({ open, onClose }: { open: boolean; onClose: () => void; }) {
  const queue = usePlayerStore(s => s.queue);
  const queueIndex = usePlayerStore(s => s.queueIndex);
  const setQueue = usePlayerStore(s => s.setQueue);

  const sensors = useSensors(
    // 5px 拖动阈值，避免点击切曲被误判为拖拽
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (over == null || active.id === over.id) return;
    const oldIndex = Number(active.id);
    const newIndex = Number(over.id);
    if (
      Number.isNaN(oldIndex)
      || Number.isNaN(newIndex)
      || oldIndex === newIndex
    ) {
      return;
    }
    const nextQueue = arrayMove(queue, oldIndex, newIndex);
    // 修正当前播放索引：被拖的是当前曲 → 跟随；跨过当前曲 → 相应 ±1
    let nextIndex = queueIndex;
    if (oldIndex === queueIndex) nextIndex = newIndex;
    else if (oldIndex < queueIndex && newIndex > queueIndex)
      nextIndex = queueIndex - 1;
    else if (oldIndex > queueIndex && newIndex < queueIndex)
      nextIndex = queueIndex + 1;
    // store 无队列重排 action，整表写回（不改 store 文件）
    usePlayerStore.setState({ queue: nextQueue, queueIndex: nextIndex });
  }

  return (
    <M3eDialog open={open} onClosed={onClose} dismissible closeLabel='关闭'>
      <span slot='header'>播放列表（{queue.length}）</span>

      <div className='max-h-[60vh] overflow-y-auto'>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}>
          <SortableContext
            items={queue.map((_, i) => i)}
            strategy={verticalListSortingStrategy}>
            {queue.map((track, index) => (
              <QueueRow
                key={`${track.hash}-${index}`}
                track={track}
                index={index}
                active={index === queueIndex}
                onPlay={() => setQueue(queue, index)} />
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
  index,
  active,
  onPlay,
}: {
  track: Track;
  index: number;
  active: boolean;
  onPlay: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: index });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onClick={onPlay}
      className={[
        'flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2',
        active
          ? 'bg-(--md-sys-color-primary-container) text-(--md-sys-color-on-primary-container)'
          : 'hover:bg-(--md-sys-color-surface-container-high)',
      ].join(' ')}
      {...attributes}
      {...listeners}>
      <M3eIcon name='drag_indicator' className='shrink-0 opacity-40' />
      <div className='min-w-0 flex-1'>
        <div className='truncate text-sm'>{track.title}</div>
        <div className='truncate text-xs opacity-60'>{track.workTitle}</div>
      </div>
      {active && (
        <span className='shrink-0 text-xs font-medium'>正在播放</span>
      )}
    </div>
  );
}

import { useTranslation } from 'react-i18next';
import type { BatchLog } from '../../api/tasks';

/** 批次日志列表：时间戳列 + level + message（母级容器负责滚动）。 */
export default function TaskLogList({ logs }: { logs: BatchLog[] }) {
  const { t } = useTranslation();
  if (logs.length === 0) {
    return <p className='m-0 text-xs opacity-60'>{t('tasks.logs-empty')}</p>;
  }
  return (
    <ul className='m-0 flex max-h-64 list-none flex-col gap-0.5 overflow-y-auto p-0 font-mono text-xs'>
      {[...logs].reverse().map((l, i) => (
        <li
          // 日志无稳定 id；以倒序索引 + 时间戳为 key（追加式列表仅尾部变化）
          key={`${l.timestamp}-${i}`}
          className='flex gap-2'
        >
          <time className='shrink-0 opacity-60'>
            {l.timestamp.slice(11, 19)}
          </time>
          <span
            className={`w-14 shrink-0 ${
              l.level === 'error'
                ? 'text-[var(--md-sys-color-error)]'
                : 'opacity-60'
            }`}
          >
            {l.level}
          </span>
          <span className='min-w-0 flex-1 break-all'>{l.message}</span>
        </li>
      ))}
    </ul>
  );
}

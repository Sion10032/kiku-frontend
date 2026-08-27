import { M3eDialog } from '@m3e/react/dialog';
import { M3eButton } from '@m3e/react/button';

/** 通用确认对话框（M3eDialog 封装）：危险操作二次确认。 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = '确认',
  destructive = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <M3eDialog open={open} dismissible closeLabel='关闭' onClosed={onCancel}>
      <span slot='header'>{title}</span>
      <p className='m-0 text-sm'>{message}</p>
      <div slot='actions' className='flex justify-end gap-2'>
        <M3eButton variant='text' onClick={onCancel}>
          取消
        </M3eButton>
        <M3eButton
          variant='text'
          className={
            destructive
              ? 'text-[var(--md-sys-color-error)]'
              : 'text-[var(--md-sys-color-primary)]'
          }
          onClick={onConfirm}
        >
          {confirmLabel}
        </M3eButton>
      </div>
    </M3eDialog>
  );
}

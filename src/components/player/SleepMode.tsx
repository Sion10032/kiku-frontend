import { useState } from 'react';
import { M3eDialog } from '@m3e/react/dialog';
import { M3eButton } from '@m3e/react/button';
import { M3eFormField } from '@m3e/react/form-field';
import { useTranslation } from 'react-i18next';
import { usePlayerStore } from '../../stores/playerStore';

interface SleepModeProps {
  open: boolean;
  onClose: () => void;
}

/**
 * 睡眠定时器组件。
 *
 * - 状态已创建，待步骤 8 挂载到 AudioPlayer。
 * - UI：时间选择（HH:MM 输入）+ 开启/关闭按钮。
 * - 使用 playerStore.setSleepTimer / clearSleepMode。
 */
export default function SleepMode({ open, onClose }: SleepModeProps) {
  const { t } = useTranslation();
  const sleepTime = usePlayerStore((s) => s.sleepTime);
  const sleepMode = usePlayerStore((s) => s.sleepMode);
  const setSleepTimer = usePlayerStore((s) => s.setSleepTimer);
  const clearSleepMode = usePlayerStore((s) => s.clearSleepMode);

  // 初始化时间：已有定时 → 用已有值；否则用当前时间
  const [time, setTime] = useState(() => {
    if (sleepMode && sleepTime) return sleepTime;
    const now = new Date();
    return (
      String(now.getHours()).padStart(2, '0')
      + ':'
      + String(now.getMinutes()).padStart(2, '0')
    );
  });

  function handleSet() {
    setSleepTimer(time);
    onClose();
  }

  function handleClear() {
    clearSleepMode();
    onClose();
  }

  return (
    <M3eDialog
      open={open}
      onClosed={onClose}
      dismissible
      closeLabel={t('common.close')}
    >
      <span slot='header'>{t('player.sleep-timer')}</span>

      <div className='flex flex-col gap-4 py-2'>
        <M3eFormField variant='outlined'>
          <label slot='label' htmlFor='sleep-time'>
            {t('player.sleep-stop-at')}
          </label>
          <input
            id='sleep-time'
            type='time'
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className='w-full border-none bg-transparent py-2 text-sm outline-none'
          />
        </M3eFormField>

        {sleepMode && sleepTime && (
          <p className='m-0 text-sm opacity-70'>
            {t('player.sleep-active', { time: sleepTime })}
          </p>
        )}
      </div>

      <div slot='actions' className='flex items-center justify-between'>
        <div>
          <M3eButton variant='text' disabled={!sleepMode} onClick={handleClear}>
            {t('player.sleep-cancel')}
          </M3eButton>
        </div>
        <div className='flex gap-2'>
          <M3eButton variant='text' onClick={onClose}>
            {t('common.cancel')}
          </M3eButton>
          <M3eButton variant='filled' onClick={handleSet}>
            {t('common.ok')}
          </M3eButton>
        </div>
      </div>
    </M3eDialog>
  );
}

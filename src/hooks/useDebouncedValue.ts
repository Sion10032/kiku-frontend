import { useEffect, useState } from 'react';

/**
 * 延迟更新 value 的防抖值，用于搜索输入等高频变更场景。
 *
 * value 变化后静置 `delay` 毫秒才同步返回值，期间保持上一次结果；
 * 连续输入时每次变更都会重置计时器。
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [ debounced, setDebounced ] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [ value, delay ]);

  return debounced;
}

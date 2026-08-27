import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';

/**
 * 单行文本；溢出时 hover 滚动一轮（0 → -50% → 0 往返），不溢出保持静止。
 *
 * 父级容器需带 `group` class，内层动画使用 `group-hover:animate-marquee`。
 */
export default function MarqueeText({
  text,
  className = '',
}: {
  text: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setOverflow(el.scrollWidth > el.clientWidth);
    check();
    // 字体加载/窗口缩放后复测
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text]);

  return (
    <span ref={ref} className={clsx('block truncate', className)}>
      {/* 内层：溢出且 hover 时加 marquee 动画；文本重复两份实现无缝往返 */}
      <span
        className={clsx(
          'inline-block whitespace-nowrap',
          overflow ? 'group-hover:animate-marquee' : 'truncate',
        )}
      >
        {text}
        {overflow && <span className='pl-8'>{text}</span>}
      </span>
    </span>
  );
}

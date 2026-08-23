import { useEffect, useRef } from 'react';
import { createStyleElement, type CssInput } from '../utils/css';

/** 带 updateComplete 的元素（Lit 系 web component 的结构化约束）。 */
export type M3eStyleElement = Element & {
  readonly updateComplete: Promise<boolean>;
};

export type M3eStyleOptions = {
  style?: CssInput;
};

export function useM3eStyle<T extends M3eStyleElement = M3eStyleElement>({ style }: M3eStyleOptions) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    (async () => {
      const el = ref.current;
      if (!el) {
        return;
      }

      await el.updateComplete;

      const root = el.shadowRoot;
      if (style && root && root.querySelector('style') === null) {
        root.appendChild(createStyleElement(style));
      }
    })();
    // 仅为挂载时一次性注入（调用方传静态内容，内部幂等）；style 不进依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return ref;
}

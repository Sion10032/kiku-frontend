import { useEffect, useRef } from "react";
import { type M3eListOptionElement } from "@m3e/react/list";
import { createStyleElement, type CssInput } from "../utils/css";

export type M3eListOptionStyleOptions = {
  style: CssInput;
};

export function useM3eListOptionStyle({ style }: M3eListOptionStyleOptions) {
  const ref = useRef<M3eListOptionElement>(null);

  useEffect(() => {
    (async () => {
      if (!ref.current) {
        return;
      }

      await ref.current.updateComplete;

      const outerRoot = ref.current.shadowRoot;
      if (style && outerRoot && outerRoot.querySelector('style') === null) {
        outerRoot.appendChild(createStyleElement(style));
      }
    })();
  }, []);

  return ref;
}

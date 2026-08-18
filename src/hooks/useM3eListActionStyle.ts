import { useEffect, useRef } from "react";
import { type M3eListActionElement } from "@m3e/react/list";
import { createStyleElement, type CssInput } from "../utils/css";

export type M3eListActionStyleOptions = {
  actionStyle?: CssInput;
  buttonStyle?: CssInput;
};

export function useM3eListActionStyle({ actionStyle, buttonStyle }: M3eListActionStyleOptions) {
  const ref = useRef<M3eListActionElement>(null);

  useEffect(() => {
    (async () => {
      if (!ref.current) {
        return;
      }

      await ref.current.updateComplete;

      const outerRoot = ref.current.shadowRoot;
      if (actionStyle && outerRoot && outerRoot.querySelector('style') === null) {
        outerRoot.appendChild(createStyleElement(actionStyle));
      }

      const innerButtonRoot = outerRoot?.firstElementChild?.shadowRoot;
      if (buttonStyle && innerButtonRoot && innerButtonRoot.querySelector('style') === null) {
        innerButtonRoot.appendChild(createStyleElement(buttonStyle));
      }
    })();
  }, []);

  return ref;
}

import { CSSProperties } from 'react';

// 定义选择器 + 属性对象的结构
export type StyleObject = Record<string, CSSProperties>;
export type CssInput = string | StyleObject;

/**
 * 将 camelCase 转换为 kebab-case（例如 alignSelf -> align-self）
 */
function camelToKebab(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

/**
 * 将 StyleObject 或 string 统一转换为 CSS 字符串
 */
export function serializeCss(input: CssInput): string {
  if (typeof input === 'string') {
    return input;
  }

  return Object.entries(input)
    .map(([selector, styles]) => {
      const styleRules = Object.entries(styles)
        .map(([prop, value]) => {
          if (value === undefined || value === null) return '';
          return `  ${camelToKebab(prop)}: ${value};`;
        })
        .filter(Boolean)
        .join('\n');

      return `${selector} {\n${styleRules}\n}`;
    })
    .join('\n');
}

export function createStyleElement(input: CssInput) {
  const style = document.createElement('style');
  style.textContent = serializeCss(input);
  return style;
}

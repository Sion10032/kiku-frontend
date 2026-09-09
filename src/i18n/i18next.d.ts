// typed key：t('不存在的key') 编译期报错（key 集合由 zh-CN.json 决定）
import type zhCN from './locales/zh-CN.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    resources: { translation: typeof zhCN };
  }
}

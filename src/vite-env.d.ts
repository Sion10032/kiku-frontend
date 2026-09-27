/// <reference types="vite/client" />

/** 构建期注入的前端版本号（见 vite.config.ts 的 define，来源 APP_VERSION_FRONTEND） */
declare const __APP_VERSION__: string;
/** 构建期注入的 git 短 hash（来源 GIT_COMMIT_FRONTEND）；未注入时为 'unknown' */
declare const __APP_COMMIT__: string;

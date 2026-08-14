/**
 * 全局类型定义，对齐 kiku-backend 的 zod schema（src/routes/*.ts）。
 */

// ---------- 基础实体 ----------

export interface Circle {
  id: number;
  name: string;
}

export interface Tag {
  id: number;
  name: string;
}

export interface Va {
  /** 声优 id（后端为 string） */
  id: string;
  name: string;
}

/**
 * 作品（formattedWorkSchema）。
 * 字段命名与后端响应保持一致（snake_case）。
 */
export interface Work {
  id: number;
  rootFolder: string;
  dir: string;
  title: string;
  circle: Circle;
  nsfw: boolean;
  release: string | null;
  /** 下载量 */
  dl_count: number | null;
  price: number | null;
  review_count: number | null;
  rate_count: number | null;
  rate_average_2dp: number | null;
  rate_count_detail: Record<string, number>;
  rank: Record<string, number> | null;
  tags: Tag[];
  vas: Va[];
  /** 当前用户对该作品的评分（1-5），未评分为 null */
  userRating: number | null;
}

export interface Pagination {
  currentPage: number;
  pageSize: number;
  totalCount: number;
}

// ---------- 作品列表 / 筛选 ----------

/** /works 排序字段（对齐原 kikoeru-quasar 的排序选项） */
export type WorksOrder =
  | 'release'
  | 'rating' // 我的评价（userRating）
  | 'dl_count'
  | 'price'
  | 'rate_average_2dp'
  | 'review_count'
  | 'id'
  | 'nsfw'
  | 'random';

export type WorksSort = 'desc' | 'asc';

export interface WorksParams {
  page?: number;
  order?: WorksOrder;
  sort?: WorksSort;
  /** random/betterRandom 排序的随机种子 */
  seed?: number;
  circleId?: number;
  tagId?: number;
  /** 声优 id（后端为 string） */
  vaId?: string;
  keyword?: string;
}

/** /works 列表响应（含分页） */
export interface WorksPage {
  works: Work[];
  pagination: Pagination;
}

// ---------- 文件树 ----------

export interface TrackLeaf {
  /** 文件相对路径（作为 media index） */
  mediaPath: string;
  title: string;
  type?: string;
  children?: never;
}

export interface TrackFolder {
  title: string;
  children: TrackNode[];
  mediaPath?: never;
}

export type TrackNode = TrackLeaf | TrackFolder;

/** /tracks/:id 响应（文件树根数组） */
export type Tracks = TrackNode[];

// ---------- 评价 ----------

/** 收听进度（reviewSchema.progress） */
export type Progress =
  | 'marked'
  | 'listening'
  | 'listened'
  | 'replay'
  | 'postponed';

/** 评价项（reviewResponseSchema） */
export interface Review {
  userName: string;
  workId: number;
  rating: number | null;
  reviewText: string | null;
  progress: Progress | null;
  createdAt: string | null;
  updatedAt: string | null;
}

/** PUT /review 请求体 */
export interface SubmitReviewInput {
  work_id: number;
  rating?: number;
  review_text?: string;
  progress?: Progress;
  starOnly?: boolean;
  progressOnly?: boolean;
}

// ---------- 认证 ----------

export interface LoginInput {
  name: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  name: string;
  group: string;
}

export interface MeResponse {
  name: string;
  group: string;
}

// ---------- 用户管理 ----------

export type UserGroup = 'user' | 'guest' | 'admin';

export interface User {
  name: string;
  group: string;
}

export interface CreateUserInput {
  name: string;
  password: string;
  group: 'user' | 'guest';
}

export interface UpdatePasswordInput {
  name: string;
  newPassword: string;
}

export interface DeleteUsersInput {
  users: { name: string }[];
}

// ---------- 配置 ----------

export type TagLanguage = 'ja-jp' | 'zh-tw' | 'zh-cn';

export interface SharedConfig {
  auth: boolean;
  pageSize: number;
  tagLanguage: TagLanguage;
  enableGzip: boolean;
  rewindSeekTime: number;
  forwardSeekTime: number;
  offloadMedia: boolean;
  offloadStreamPath: string;
  offloadDownloadPath: string;
}

export interface RootFolder {
  name: string;
  path: string;
}

export interface AdminConfig extends SharedConfig {
  production: boolean;
  dbBusyTimeout: number;
  checkUpdate: boolean;
  checkBetaUpdate: boolean;
  maxParallelism: number;
  rootFolders: RootFolder[];
  coverFolderDir: string;
  databaseFolderDir: string;
  md5secret: string;
  jwtsecret: string;
  expiresIn: number;
  scannerMaxRecursionDepth: number;
  retry: number;
  dlsiteTimeout: number;
  hvdbTimeout: number;
  retryDelay: number;
  httpProxyHost: string;
  httpProxyPort: number;
  listenPort: number;
  blockRemoteConnection: boolean;
  behindProxy: boolean;
  httpsEnabled: boolean;
  httpsPrivateKey: string;
  httpsCert: string;
  httpsPort: number;
  skipCleanup: boolean;
}

/** 版本检查：GET /api/version */
export interface VersionResponse {
  /** 当前版本号 */
  current: string;
  /** 最新版本号（无更新时为 null） */
  latest: string | null;
  /** 是否有可用更新 */
  updateAvailable: boolean;
}

// ---------- 媒体 ----------

export interface CheckLrcResponse {
  hasLrc: boolean;
  lrc?: string;
}

// ---------- 扫描器 SSE ----------

export type ScanEventType = string;

export interface ScanInitState {
  isScanning: boolean;
}

export interface ScanEvent {
  type: ScanEventType;
  [key: string]: unknown;
}

// ---------- API 错误 ----------

export interface ApiErrorBody {
  error?: string;
}

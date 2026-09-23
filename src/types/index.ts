/**
 * 全局类型定义，对齐 kiku-backend 的 zod schema（src/routes/*.ts）。
 */

// ---------- 基础实体 ----------

/** 年龄分级三档（对齐后端 formattedWorkSchema.ageRating）。 */
export type AgeRating = 'all' | 'r15' | 'r18';

export interface Circle {
  /** DLsite maker_id（RG/VG + 5 或 8 位）；旧库迁移未知时为 "unknown" */
  id: string;
  name: string;
}

export interface Tag {
  id: number;
  name: string;
  /** 管理员覆盖新增（原始项缺省，对齐后端 formattedWorkSchema） */
  overridden?: boolean;
}

export interface Va {
  /** 声优 id（后端为 string） */
  id: string;
  name: string;
  /** 管理员覆盖新增（原始项缺省，对齐后端 formattedWorkSchema） */
  overridden?: boolean;
}

export interface Series {
  /** 系列 id（后端为 string） */
  id: string;
  name: string;
}

/**
 * 作品（formattedWorkSchema）。
 * 字段命名与后端响应保持一致（snake_case）。
 */
export interface Work {
  /** 作品 id，完整 RJ code（如 "RJ01173549"） */
  id: string;
  rootFolder: string;
  dir: string;
  title: string;
  circle: Circle;
  /** 年龄分级：all 全年龄 / r15 / r18 */
  ageRating: AgeRating;
  release: string | null;
  /** 下载量 */
  dl_count: number | null;
  price: number | null;
  review_count: number | null;
  rate_count: number | null;
  rate_average_2dp: number | null;
  rate_count_detail: Record<string, number>;
  rank: Array<{
    term: string;
    category: string;
    rank: number;
    rank_date: string;
  }> | null;
  tags: Tag[];
  vas: Va[];
  /** 所属系列（至多 1 个，无系列为 null） */
  series: Series | null;
  /** 当前用户对该作品的评分（1-5），未评分为 null */
  userRating: number | null;
  /** 当前用户播放进度聚合（null = 未读/未登录） */
  userProgress: UserWorkProgress | null;
  /** 当前用户已读标记（独立于进度；未登录恒 false） */
  read: boolean;
  /** 作品总时长（秒，后端 SUM(t_track.duration_sec)）；无音轨/全未知为 null（对齐 formattedWorkSchema.duration） */
  duration: number | null;
  /** 作品整合响度（LUFS，已分析音轨按时长加权）；未分析为 null */
  loudnessLufs: number | null;
  /** 作品峰值电平（dBTP，已分析音轨最大 True Peak）；未分析为 null */
  loudnessTruePeakDb: number | null;
  /** 被管理员覆盖的字段（无覆盖时缺省） */
  overriddenFields?: MetadataField[];
}

export interface Pagination {
  currentPage: number;
  pageSize: number;
  totalCount: number;
}

// ---------- 作品列表 / 筛选 ----------

/** /works 排序字段（对齐后端 schema） */
export type WorksOrder = 'release' | 'id' | 'random' | 'betterRandom';

export type WorksSort = 'desc' | 'asc';

export interface WorksParams {
  page?: number;
  order?: WorksOrder;
  sort?: WorksSort;
  /** random/betterRandom 排序的随机种子 */
  seed?: number;
  /** LQL 查询文本（tag:标签1 -tag:标签2 circle:"xx" va:x 裸词） */
  q?: string;
}

/** /works 列表响应（含分页） */
export interface WorksPage {
  works: Work[];
  pagination: Pagination;
}

// ---------- 文件树 ----------

/** 文件树节点类型（对齐原 kikoeru-quasar 的 tracks 响应）。 */
export type TrackItemType = 'folder' | 'audio' | 'text' | 'image' | 'other';

export interface TrackFolder {
  title: string;
  type: 'folder';
  children: TrackNode[];
}

/** 歌词文件引用（后端建树时匹配，仅 audio 叶子携带）。 */
export interface LyricsRef {
  /** 歌词文件相对路径（media index） */
  hash: string;
  type: 'lrc' | 'vtt';
}

export interface TrackLeaf {
  title: string;
  /** 文件类型（folder 单独建模为 TrackFolder） */
  type: Exclude<TrackItemType, 'folder'>;
  /** 文件相对路径（media index），如 `subfolder/track01.mp3` */
  hash: string;
  /** 歌词引用（仅 audio；后端建树时匹配） */
  lyrics?: LyricsRef;
  /** 时长秒数（仅 audio；未探测/解析失败为 null，对齐后端 /api/tracks/:id） */
  durationSec?: number | null;
  /** 整合响度 LUFS（仅 audio；未分析为 null，与 durationSec 同构） */
  loudnessLufs?: number | null;
  children?: never;
}

export type TrackNode = TrackFolder | TrackLeaf;

/** /tracks/:id 响应（文件树根数组） */
export type Tracks = TrackNode[];

/** 作品响度测量值快照（播放队列音轨入队时携带；播放时按当前响度设置计算增益）。 */
export interface LoudnessInfo {
  /** 作品整合响度（LUFS）；未分析为 null */
  lufs: number | null;
  /** 作品峰值电平（dBTP）；未分析为 null */
  truePeakDb: number | null;
}

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
  /** 作品 id，完整 RJ code */
  workId: string;
  rating: number | null;
  reviewText: string | null;
  progress: Progress | null;
  createdAt: string | null;
  updatedAt: string | null;
}

/** PUT /review 请求体 */
export interface SubmitReviewInput {
  /** 作品 id，完整 RJ code */
  work_id: string;
  rating?: number;
  review_text?: string;
  progress?: Progress;
  starOnly?: boolean;
  progressOnly?: boolean;
}

// ---------- 收藏 ----------

/** 收藏目标类型（多态：四选一） */
export type FavouriteTargetType = 'work' | 'series' | 'va' | 'circle';

/** 作品目标摘要 */
export interface FavouriteWorkTarget {
  id: string;
  title: string;
  circleName: string;
}

/** 系列/声优/社团目标摘要（workCount 为在库作品数） */
export interface FavouriteEntityTarget {
  id: string | number;
  name: string;
  workCount: number;
}

/** GET /api/favourites 返回项 */
export interface FavouriteItem {
  targetType: FavouriteTargetType;
  targetId: string;
  createdAt: string;
  target: FavouriteWorkTarget | FavouriteEntityTarget;
}

/** GET /api/favourites/status 返回（id → 是否已收藏） */
export type FavouriteStatusMap = Record<string, boolean>;

/** 判别收窄：实体目标（含 name）vs 作品目标（含 title） */
export function isEntityTarget(
  t: FavouriteItem['target'],
): t is FavouriteEntityTarget {
  return 'name' in t;
}

// ---------- 播放进度 ----------

/** works 列表注入的进度聚合（userProgressSchema） */
export interface UserWorkProgress {
  /** 上次播放的音轨（media index = 文件相对路径） */
  mediaIndex: string;
  trackTitle: string | null;
  /** 上次播放到的时间（秒） */
  position: number;
  duration: number | null;
  /** 已听完的轨数（position/duration ≥ 0.95） */
  listenedCount: number;
  updatedAt: string;
}

/** GET /api/progress/:workId 返回的进度行 */
export interface ProgressRow {
  userName: string;
  workId: string;
  mediaIndex: string;
  trackTitle: string | null;
  position: number;
  duration: number | null;
  updatedAt: string | null;
}

/** PUT /api/progress 请求体 */
export interface ReportProgressInput {
  work_id: string;
  media_index: string;
  track_title?: string;
  position: number;
  duration?: number | null;
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

export type InstanceMode = 'private' | 'public';

export interface SharedConfig {
  instanceMode: InstanceMode;
  allowRegistration: boolean;
  pageSize: number;
  tagLanguage: TagLanguage;
  enableGzip: boolean;
  rewindSeekTime: number;
  forwardSeekTime: number;
  offloadMedia: boolean;
  offloadStreamPath: string;
  offloadDownloadPath: string;
  /** 扫描结束后自动接力响度分析（默认 false） */
  autoLoudnessAnalysis: boolean;
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

// ---------- 扫描器 SSE ----------

export type ScanEventType = string;

export interface ScanTaskPayload {
  id: number;
  title: string;
  status: 'pending' | 'scanning' | 'completed' | 'failed';
  error?: string;
}

export interface ScanLogPayload {
  level: string;
  message: string;
  timestamp: string;
}

/** 重连补播快照（SCAN_INIT_STATE 携带） */
export interface ScanSnapshot {
  tasks: ScanTaskPayload[];
  failedTasks: ScanTaskPayload[];
  completed: number;
  logs: ScanLogPayload[];
  /** 产出该快照的运行模式；缺省视为 'scan' */
  mode?: 'scan' | 'update';
}

export interface ScanInitState {
  isScanning: boolean;
  snapshot: ScanSnapshot | null;
}

export interface ScanEvent {
  type: ScanEventType;
  [key: string]: unknown;
}

// ---------- API 错误 ----------

export interface ApiErrorBody {
  error?: string;
}

// ---------- 云端备份 ----------

export interface SettingsBackupSummary {
  name: string;
  updatedAt: string;
}

export interface SettingsBackupDetail {
  name: string;
  payload: Record<string, unknown>;
  updatedAt: string;
}

// ---------- 元数据覆盖 ----------

export const METADATA_FIELDS = [
  'title',
  'circle',
  'series',
  'ageRating',
  'tags',
  'vas',
] as const;
export type MetadataField = (typeof METADATA_FIELDS)[number];

export type MetadataEntityRef<T> = { id: T; name: string };
export type MetadataActionRow<T> = MetadataEntityRef<T> & {
  action: 'add' | 'remove';
};

export interface MetadataOverrideDetail {
  original: {
    title: string;
    circle: MetadataEntityRef<string> | null;
    series: MetadataEntityRef<string> | null;
    ageRating: string;
    tags: MetadataEntityRef<number>[];
    vas: MetadataEntityRef<string>[];
  };
  effective: {
    title: string;
    circle: MetadataEntityRef<string> | null;
    series: MetadataEntityRef<string> | null;
    ageRating: string;
    tags: MetadataEntityRef<number>[];
    vas: MetadataEntityRef<string>[];
  };
  override: {
    title: string | null;
    circle: MetadataEntityRef<string> | null;
    series: MetadataEntityRef<string> | null;
    ageRating: string | null;
    tagsCleared: boolean;
    vasCleared: boolean;
    tagActions: MetadataActionRow<number>[];
    vaActions: MetadataActionRow<string>[];
    updatedBy: string | null;
    updatedAt: string | null;
  };
  overriddenFields: MetadataField[];
}

export interface SaveMetadataOverrideInput {
  title?: string | null;
  circleName?: string | null;
  seriesName?: string | null;
  ageRating?: 'all' | 'r15' | 'r18' | null;
  tagsCleared?: boolean;
  vasCleared?: boolean;
  addTags?: string[];
  removeTagIds?: number[];
  addVas?: Array<{ id?: string; name: string }>;
  removeVaIds?: string[];
  /** 本请求内先恢复原始的字段；随后再套用本次编辑（后端叠加语义） */
  resetFields?: MetadataField[];
}

// ---------- 标题净化 ----------

export interface SanitizeTitlesSample {
  id: string;
  before: string;
  after: string;
  overridden: boolean;
}

/** dryRun=true → 含 samples；false → success + 计数。 */
export interface SanitizeTitlesResponse {
  success?: boolean;
  matched: number;
  overridden: number;
  samples?: SanitizeTitlesSample[];
}

export interface SanitizeTitlesInput {
  pattern: string;
  replacement: string;
  q?: string;
  dryRun: boolean;
}

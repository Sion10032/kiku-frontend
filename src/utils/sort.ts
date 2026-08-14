import type { WorksOrder, WorksSort } from '../types';

/** 排序选项（label + order + sort）。 */
export interface SortOption {
  label: string;
  order: WorksOrder;
  sort: WorksSort;
}

/** 作品库排序选项（对齐原 kikoeru-quasar）。 */
export const SORT_OPTIONS: SortOption[] = [
  { label: '按照发售日期新到老的顺序', order: 'release', sort: 'desc' },
  { label: '按照我的评价排序', order: 'rating', sort: 'desc' },
  { label: '按照发售日期老到新的顺序', order: 'release', sort: 'asc' },
  { label: '按照售出数量多到少的顺序', order: 'dl_count', sort: 'desc' },
  { label: '按照价格便宜到贵的顺序', order: 'price', sort: 'asc' },
  { label: '按照价格贵到便宜的顺序', order: 'price', sort: 'desc' },
  { label: '按照评价高到低的顺序', order: 'rate_average_2dp', sort: 'desc' },
  { label: '按照评论多到少的顺序', order: 'review_count', sort: 'desc' },
  { label: '按照RJ号大到小的顺序', order: 'id', sort: 'desc' },
  { label: '按照RJ号小到大的顺序', order: 'id', sort: 'asc' },
  { label: '按照全年龄新作优先的顺序', order: 'nsfw', sort: 'asc' },
  { label: '随机排序', order: 'random', sort: 'desc' },
];

export const DEFAULT_SORT: SortOption = SORT_OPTIONS[0];

/** localStorage 排序持久化 key。 */
const SORT_KEY = 'kiku-sort-option';

export function loadSortOption(): SortOption {
  try {
    const raw = localStorage.getItem(SORT_KEY);
    if (!raw) return DEFAULT_SORT;
    const parsed = JSON.parse(raw) as { order?: string; sort?: string };
    const found = SORT_OPTIONS.find(
      (o) => o.order === parsed.order && o.sort === parsed.sort,
    );
    return found ?? DEFAULT_SORT;
  } catch {
    return DEFAULT_SORT;
  }
}

export function saveSortOption(opt: SortOption): void {
  try {
    localStorage.setItem(SORT_KEY, JSON.stringify(opt));
  } catch {
    /* localStorage 不可用时静默 */
  }
}

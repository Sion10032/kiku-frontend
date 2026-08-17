import type { WorksOrder, WorksSort } from '../types';

/** 排序选项（label + order + sort）。 */
export interface SortOption {
  label: string;
  order: WorksOrder;
  sort: WorksSort;
}

/** 作品库排序选项（对齐后端 schema）。 */
export const SORT_OPTIONS: SortOption[] = [
  { label: '按照发售日期新到老的顺序', order: 'release', sort: 'desc' },
  { label: '按照发售日期老到新的顺序', order: 'release', sort: 'asc' },
  { label: '按照RJ号大到小的顺序', order: 'id', sort: 'desc' },
  { label: '按照RJ号小到大的顺序', order: 'id', sort: 'asc' },
  { label: '随机排序', order: 'random', sort: 'desc' },
  { label: '更好的随机排序', order: 'betterRandom', sort: 'desc' },
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

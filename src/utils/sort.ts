import type { WorksOrder, WorksSort } from '../types';

/** 排序选项（i18n label key + order + sort；渲染处 t(label)）。 */
export interface SortOption {
  label:
    | 'works.sort-release-desc'
    | 'works.sort-release-asc'
    | 'works.sort-id-desc'
    | 'works.sort-id-asc'
    | 'works.sort-random'
    | 'works.sort-better-random';
  order: WorksOrder;
  sort: WorksSort;
}

/** 作品库排序选项（对齐后端 schema）。 */
export const SORT_OPTIONS: SortOption[] = [
  { label: 'works.sort-release-desc', order: 'release', sort: 'desc' },
  { label: 'works.sort-release-asc', order: 'release', sort: 'asc' },
  { label: 'works.sort-id-desc', order: 'id', sort: 'desc' },
  { label: 'works.sort-id-asc', order: 'id', sort: 'asc' },
  { label: 'works.sort-random', order: 'random', sort: 'desc' },
  { label: 'works.sort-better-random', order: 'betterRandom', sort: 'desc' },
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

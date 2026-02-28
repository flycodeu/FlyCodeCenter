export interface PaginationResult<T> {
  items: T[];
  currentPage: number;
  lastPage: number;
  hasPrev: boolean;
  hasNext: boolean;
  total: number;
  pageSize: number;
}

export function paginatePageMode<T>(source: T[], currentPage: number, pageSize: number): PaginationResult<T> {
  const total = source.length;
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.max(1, Math.min(currentPage, lastPage));
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  return {
    items: source.slice(start, end),
    currentPage: page,
    lastPage,
    hasPrev: page > 1,
    hasNext: page < lastPage,
    total,
    pageSize
  };
}

export function getPageWindow(currentPage: number, lastPage: number, maxNumbers = 7): number[] {
  if (lastPage <= maxNumbers) {
    return Array.from({ length: lastPage }, (_, i) => i + 1);
  }

  const half = Math.floor(maxNumbers / 2);
  let start = currentPage - half;
  let end = currentPage + half;

  if (start < 1) {
    start = 1;
    end = maxNumbers;
  }
  if (end > lastPage) {
    end = lastPage;
    start = lastPage - maxNumbers + 1;
  }

  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

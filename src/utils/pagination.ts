export interface PaginationResult<T> {
  items: T[];
  currentPage: number;
  lastPage: number;
  hasPrev: boolean;
  hasNext: boolean;
  total: number;
  pageSize: number;
}

export type PageWindowItem = number | "start-ellipsis" | "end-ellipsis";

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

export function getPageWindow(currentPage: number, lastPage: number, maxNumbers = 7): PageWindowItem[] {
  if (lastPage <= maxNumbers) {
    return Array.from({ length: lastPage }, (_, i) => i + 1);
  }

  const siblingCount = maxNumbers >= 7 ? 1 : 0;
  const leftSibling = Math.max(2, currentPage - siblingCount);
  const rightSibling = Math.min(lastPage - 1, currentPage + siblingCount);
  const showLeftEllipsis = leftSibling > 2;
  const showRightEllipsis = rightSibling < lastPage - 1;

  if (!showLeftEllipsis) {
    const leftRangeEnd = Math.min(lastPage - 1, 3 + siblingCount * 2);
    return [1, ...Array.from({ length: leftRangeEnd - 1 }, (_, i) => i + 2), "end-ellipsis", lastPage];
  }

  if (!showRightEllipsis) {
    const rightRangeStart = Math.max(2, lastPage - (2 + siblingCount * 2));
    return [
      1,
      "start-ellipsis",
      ...Array.from({ length: lastPage - rightRangeStart }, (_, i) => rightRangeStart + i),
      lastPage
    ];
  }

  return [
    1,
    "start-ellipsis",
    ...Array.from({ length: rightSibling - leftSibling + 1 }, (_, i) => leftSibling + i),
    "end-ellipsis",
    lastPage
  ];
}

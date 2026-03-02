import type { PostEntry } from "@/utils/content";
import { resolveArticleMeta } from "@/utils/article-meta";

export interface ArchiveDayBucket {
  key: string;
  year: string;
  month: string;
  day: string;
  entries: PostEntry[];
}

export interface ArchiveMonthBucket {
  key: string;
  year: string;
  month: string;
  total: number;
  days: ArchiveDayBucket[];
}

export interface ArchiveYearBucket {
  year: string;
  total: number;
  months: ArchiveMonthBucket[];
}

export function buildArchiveTimeline(entries: PostEntry[]): ArchiveYearBucket[] {
  const dayMap = new Map<string, ArchiveDayBucket>();

  for (const entry of entries) {
    const meta = resolveArticleMeta(entry);
    const year = String(meta.createTime.getFullYear());
    const month = String(meta.createTime.getMonth() + 1).padStart(2, "0");
    const day = String(meta.createTime.getDate()).padStart(2, "0");
    const key = `${year}-${month}-${day}`;
    const bucket = dayMap.get(key) ?? { key, year, month, day, entries: [] };
    bucket.entries.push(entry);
    dayMap.set(key, bucket);
  }

  const days = [...dayMap.values()].sort((a, b) => b.key.localeCompare(a.key));
  for (const day of days) {
    day.entries.sort((a, b) => resolveArticleMeta(b).createTime.getTime() - resolveArticleMeta(a).createTime.getTime());
  }

  const monthMap = new Map<string, ArchiveMonthBucket>();
  for (const day of days) {
    const monthKey = `${day.year}-${day.month}`;
    const monthBucket = monthMap.get(monthKey) ?? {
      key: monthKey,
      year: day.year,
      month: day.month,
      total: 0,
      days: []
    };
    monthBucket.days.push(day);
    monthBucket.total += day.entries.length;
    monthMap.set(monthKey, monthBucket);
  }

  const months = [...monthMap.values()].sort((a, b) => b.key.localeCompare(a.key));
  const yearMap = new Map<string, ArchiveYearBucket>();

  for (const month of months) {
    const yearBucket = yearMap.get(month.year) ?? { year: month.year, total: 0, months: [] };
    yearBucket.months.push(month);
    yearBucket.total += month.total;
    yearMap.set(month.year, yearBucket);
  }

  return [...yearMap.values()].sort((a, b) => Number(b.year) - Number(a.year));
}


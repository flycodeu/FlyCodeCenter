import { getCollection, type CollectionEntry } from "astro:content";
import siteConfig from "@/site.config";
import { resolveEntryCode } from "@/utils/content-code";
import { trimPath, withBase } from "@/utils/url";

export type InterviewEntry = CollectionEntry<"interview">;
export type InterviewDifficulty = "easy" | "medium" | "hard";
export type InterviewSortDirection = "asc" | "desc";

const interviewMetaCache = new WeakMap<InterviewEntry, ResolvedInterviewMeta>();

export interface ResolvedInterviewMeta {
  title: string;
  code: string;
  permalink: string;
  summary: string;
  description: string;
  tags: string[];
  type: string;
  difficulty: InterviewDifficulty;
  order: number;
  createTime: Date;
  updatedTime?: Date;
  encrypted: boolean;
  passwordHint: string;
  cover: string;
  icon: string;
  space: string;
}

export interface InterviewSpaceBucket {
  key: string;
  label: string;
  description: string;
  type: string;
  cover: string;
  icon: string;
  order: number;
  sortDirection: InterviewSortDirection;
  entries: InterviewEntry[];
  readmeEntry?: InterviewEntry;
  latestAt: number;
}

interface InterviewSeriesFrontmatter {
  title?: string;
  summary?: string;
  description?: string;
  type?: string;
  cover?: string;
  icon?: string;
  order?: number;
  sortDirection?: InterviewSortDirection;
}

interface InterviewCenterFrontmatter {
  spaceSortDirection?: InterviewSortDirection;
}

function pickText(...values: Array<unknown>): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function pickNumber(fallback: number, ...values: Array<unknown>): number {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return fallback;
}

function pickBoolean(...values: Array<unknown>): boolean {
  for (const value of values) {
    if (typeof value === "boolean") return value;
  }
  return false;
}

function parseDateTime(value: unknown): Date | undefined {
  if (!value) return undefined;
  const raw = String(value).trim();
  if (!raw) return undefined;

  const matched = raw.match(/^(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (matched) {
    const [, y, m, d, hh, mm, ss] = matched;
    const utc = Date.UTC(Number(y), Number(m) - 1, Number(d), Number(hh) - 8, Number(mm), Number(ss));
    const date = new Date(utc);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  const fallback = new Date(raw);
  return Number.isNaN(fallback.getTime()) ? undefined : fallback;
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((tag) => String(tag || "").trim()).filter(Boolean))];
}

function normalizeEntryId(entryId: string): string {
  return String(entryId || "").replace(/\\/g, "/").trim();
}

function getEntrySegments(entryId: string): string[] {
  return normalizeEntryId(entryId).split("/").filter(Boolean);
}

function getEntryStem(entryId: string): string {
  const segments = getEntrySegments(entryId);
  const last = segments.at(-1) || "";
  return last.replace(/\.(md|mdx)$/i, "").trim();
}

function deriveTitleFromStem(stem: string): string {
  const normalized = String(stem || "").replace(/[_-]+/g, " ").trim();
  if (!normalized) return "未命名面试题";
  return normalized.replace(/\b[a-z]/g, (char) => char.toUpperCase());
}

export function normalizeInterviewSpaceKey(space: string): string {
  return String(space || "").trim();
}

function normalizeInterviewSortDirection(value: unknown, fallback: InterviewSortDirection = "asc"): InterviewSortDirection {
  return value === "desc" ? "desc" : fallback;
}

const SPACE_ROUTE_ALIASES: Record<string, string> = {
  "c++": "cpp"
};

const SPACE_ROUTE_ALIAS_INVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(SPACE_ROUTE_ALIASES).map(([key, value]) => [value, key])
);

export function toInterviewSpaceRouteKey(spaceKey: string): string {
  const normalized = normalizeInterviewSpaceKey(spaceKey);
  if (!normalized) return normalized;
  return SPACE_ROUTE_ALIASES[normalized] ?? normalized;
}

export function fromInterviewSpaceRouteKey(routeKey: string): string {
  const normalized = normalizeInterviewSpaceKey(routeKey);
  if (!normalized) return normalized;
  return SPACE_ROUTE_ALIAS_INVERSE[normalized] ?? normalized;
}

export function resolveInterviewSpaceKey(entry: InterviewEntry): string {
  if (isInterviewGlobalReadmeEntry(entry)) return "";
  const raw = String((entry.data as { space?: string }).space || "").trim();
  if (raw) return normalizeInterviewSpaceKey(raw);
  return normalizeInterviewSpaceKey(getEntrySegments(entry.id)[0] || "");
}

export function isInterviewReadmeEntry(entry: InterviewEntry): boolean {
  return /^readme$/i.test(getEntryStem(entry.id));
}

export function isInterviewGlobalReadmeEntry(entry: InterviewEntry): boolean {
  return isInterviewReadmeEntry(entry) && getEntrySegments(entry.id).length === 1;
}

export function isInterviewSpaceReadmeEntry(entry: InterviewEntry): boolean {
  return isInterviewReadmeEntry(entry) && getEntrySegments(entry.id).length > 1;
}

export function resolveInterviewSlug(entry: InterviewEntry): string {
  const stem = getEntryStem(entry.id);
  if (/^readme$/i.test(stem)) return "index";
  return stem;
}

function prettifySpaceLabel(key: string): string {
  const raw = normalizeInterviewSpaceKey(key);
  if (!raw) return "未分类";
  if (/^[a-z0-9 +#-]+$/i.test(raw)) {
    return raw.replace(/[-_]+/g, " ").replace(/\b[a-z]/g, (char) => char.toUpperCase());
  }
  return raw;
}

export function formatInterviewDifficultyLabel(difficulty: InterviewDifficulty): string {
  if (difficulty === "easy") return "简单";
  if (difficulty === "hard") return "困难";
  return "中等";
}

export function buildInterviewQuestionPermalink(code: string): string {
  const route = String(siteConfig.pages.interviewCenter.route || "/interview").replace(/\/$/, "");
  return `${route}/${code}/`;
}

export function buildInterviewSpacePermalink(spaceKey: string): string {
  const route = String(siteConfig.pages.interviewCenter.route || "/interview").replace(/\/$/, "");
  return `${route}/${encodeURIComponent(toInterviewSpaceRouteKey(spaceKey))}/`;
}

export function resolveInterviewCode(entry: InterviewEntry): string {
  return resolveEntryCode(entry);
}

export function resolveInterviewMeta(entry: InterviewEntry): ResolvedInterviewMeta {
  const cached = interviewMetaCache.get(entry);
  if (cached) return cached;

  const data = entry.data as Record<string, unknown>;
  const stem = getEntryStem(entry.id);
  const space = resolveInterviewSpaceKey(entry) || "general";
  const title = pickText(data.title, deriveTitleFromStem(stem));
  const summary = pickText(data.summary);
  const description = pickText(data.description, summary, title);
  const difficulty = (pickText(data.difficulty, "medium") as InterviewDifficulty) || "medium";
  const createTime = parseDateTime(data.createTime) ?? new Date("2026-01-01T00:00:00.000Z");
  const code = resolveInterviewCode(entry);
  const permalink = isInterviewSpaceReadmeEntry(entry) ? buildInterviewSpacePermalink(space) : buildInterviewQuestionPermalink(code);

  const resolved: ResolvedInterviewMeta = {
    title,
    code,
    permalink,
    summary,
    description,
    tags: normalizeTags(data.tags),
    type: pickText(data.type, space),
    difficulty: difficulty === "easy" || difficulty === "hard" ? difficulty : "medium",
    order: pickNumber(999, data.order),
    createTime,
    updatedTime: parseDateTime(data.updatedTime),
    encrypted: pickBoolean(data.encrypted),
    passwordHint: pickText(data.passwordHint),
    cover: pickText(data.cover),
    icon: pickText(data.icon),
    space
  };

  interviewMetaCache.set(entry, resolved);
  return resolved;
}

function resolveBucketMetaFromReadme(readme: InterviewEntry) {
  const data = (readme.data ?? {}) as InterviewSeriesFrontmatter;
  return {
    label: pickText(data.title),
    description: pickText(data.description, data.summary),
    type: pickText(data.type),
    cover: pickText(data.cover),
    icon: pickText(data.icon),
    order: typeof data.order === "number" && Number.isFinite(data.order) ? data.order : undefined,
    sortDirection: normalizeInterviewSortDirection(data.sortDirection, "asc")
  };
}

function resolveInterviewCenterSortDirection(entry?: InterviewEntry): InterviewSortDirection {
  if (!entry) return "asc";
  const data = (entry.data ?? {}) as InterviewCenterFrontmatter;
  return normalizeInterviewSortDirection(data.spaceSortDirection, "asc");
}

function compareInterviewOrder(
  orderA: number,
  timeA: number,
  orderB: number,
  timeB: number,
  direction: InterviewSortDirection
): number {
  if (orderA !== orderB) {
    return direction === "desc" ? orderB - orderA : orderA - orderB;
  }
  return direction === "desc" ? timeB - timeA : timeA - timeB;
}

function sortInterviewEntriesByDirection(
  entries: InterviewEntry[],
  direction: InterviewSortDirection = "asc"
): InterviewEntry[] {
  return [...entries].sort((a, b) => {
    if (Number(isInterviewReadmeEntry(a)) !== Number(isInterviewReadmeEntry(b))) {
      return Number(isInterviewReadmeEntry(b)) - Number(isInterviewReadmeEntry(a));
    }
    const metaA = resolveInterviewMeta(a);
    const metaB = resolveInterviewMeta(b);
    return compareInterviewOrder(metaA.order, metaA.createTime.getTime(), metaB.order, metaB.createTime.getTime(), direction);
  });
}

function sortInterviewSpaceBucketsByDirection(
  buckets: InterviewSpaceBucket[],
  direction: InterviewSortDirection = "asc"
): InterviewSpaceBucket[] {
  return [...buckets].sort((a, b) => {
    if (a.order !== b.order) {
      return direction === "desc" ? b.order - a.order : a.order - b.order;
    }
    return direction === "desc"
      ? b.label.localeCompare(a.label, "zh-CN")
      : a.label.localeCompare(b.label, "zh-CN");
  });
}

async function fetchAllInterviewCollectionEntries(): Promise<InterviewEntry[]> {
  return getCollection("interview", (entry) => !entry.data.draft);
}

export async function fetchInterviewEntries(): Promise<InterviewEntry[]> {
  const all = await fetchAllInterviewCollectionEntries();
  return all.filter((entry) => !isInterviewGlobalReadmeEntry(entry));
}

export async function fetchInterviewSpaceEntries(space: string): Promise<InterviewEntry[]> {
  const all = await fetchInterviewEntries();
  const normalized = normalizeInterviewSpaceKey(space);
  const bucket = buildInterviewSpaceBuckets(all).get(normalized);
  return bucket?.entries ?? [];
}

export async function fetchInterviewSpaceBuckets(): Promise<InterviewSpaceBucket[]> {
  const all = await fetchAllInterviewCollectionEntries();
  const spaceSortDirection = resolveInterviewCenterSortDirection(all.find((entry) => isInterviewGlobalReadmeEntry(entry)));
  const entries = all.filter((entry) => !isInterviewGlobalReadmeEntry(entry));
  return sortInterviewSpaceBucketsByDirection([...buildInterviewSpaceBuckets(entries).values()], spaceSortDirection);
}

export async function findInterviewEntryByCode(code: string): Promise<InterviewEntry | null> {
  const normalized = String(code || "").trim().toLowerCase();
  if (!normalized) return null;

  const entries = await fetchInterviewEntries();
  return entries.find((entry) => !isInterviewReadmeEntry(entry) && resolveInterviewMeta(entry).code === normalized) ?? null;
}

export function getInterviewEntryUrl(entry: InterviewEntry): string {
  return trimPath(withBase(resolveInterviewMeta(entry).permalink));
}

export function getInterviewSpaceUrl(spaceKey: string): string {
  return trimPath(withBase(buildInterviewSpacePermalink(spaceKey)));
}

export function buildInterviewSpaceBuckets(entries: InterviewEntry[]): Map<string, InterviewSpaceBucket> {
  const map = new Map<string, InterviewSpaceBucket>();

  for (const entry of entries) {
    if (isInterviewGlobalReadmeEntry(entry)) continue;
    const meta = resolveInterviewMeta(entry);
    const key = normalizeInterviewSpaceKey(meta.space || "general") || "general";

    if (!map.has(key)) {
      map.set(key, {
        key,
        label: prettifySpaceLabel(key),
        description: "",
        type: meta.type,
        cover: meta.cover,
        icon: meta.icon,
        order: Number.MAX_SAFE_INTEGER,
        sortDirection: "asc",
        entries: [],
        latestAt: 0
      });
    }

    const bucket = map.get(key)!;
    bucket.entries.push(entry);
    bucket.latestAt = Math.max(bucket.latestAt, meta.createTime.getTime());
    if (isInterviewReadmeEntry(entry) && !bucket.readmeEntry) {
      bucket.readmeEntry = entry;
    }
  }

  for (const bucket of map.values()) {
    if (!bucket.readmeEntry) continue;

    const meta = resolveBucketMetaFromReadme(bucket.readmeEntry);
    if (meta.label) bucket.label = meta.label;
    if (meta.description) bucket.description = meta.description;
    if (meta.type) bucket.type = meta.type;
    if (meta.cover) bucket.cover = meta.cover;
    if (meta.icon) bucket.icon = meta.icon;
    if (meta.order !== undefined) bucket.order = meta.order;
    bucket.sortDirection = meta.sortDirection;
  }

  for (const bucket of map.values()) {
    bucket.entries = sortInterviewEntriesByDirection(bucket.entries, bucket.sortDirection);
  }

  return map;
}

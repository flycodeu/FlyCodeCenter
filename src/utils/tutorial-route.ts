function normalizeSlashes(value: string): string {
  return String(value || "").replace(/\\/g, "/").trim();
}

function stripMarkdownExtension(value: string): string {
  return String(value || "").replace(/\.(md|mdx)$/i, "");
}

export function normalizeSeriesKey(series: string): string {
  return String(series || "").trim();
}

const SERIES_ROUTE_ALIASES: Record<string, string> = {
  "c++": "cpp"
};

const SERIES_ROUTE_ALIAS_INVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(SERIES_ROUTE_ALIASES).map(([key, value]) => [value, key])
);

export function toSeriesRouteKey(seriesKey: string): string {
  const normalized = normalizeSeriesKey(seriesKey);
  if (!normalized) return normalized;
  return SERIES_ROUTE_ALIASES[normalized] ?? normalized;
}

export function fromSeriesRouteKey(routeKey: string): string {
  const normalized = normalizeSeriesKey(routeKey);
  if (!normalized) return normalized;
  return SERIES_ROUTE_ALIAS_INVERSE[normalized] ?? normalized;
}

export function getTutorialEntrySegments(entryId: string): string[] {
  return normalizeSlashes(entryId).split("/").filter(Boolean);
}

export function getTutorialEntryStem(entryId: string): string {
  const segments = getTutorialEntrySegments(entryId);
  const last = segments.at(-1) || "";
  return stripMarkdownExtension(last).trim();
}

export function isTutorialReadmeStem(stem: string): boolean {
  return /^readme$/i.test(String(stem || "").trim());
}

export function isTutorialReadmeEntryId(entryId: string): boolean {
  const segments = getTutorialEntrySegments(entryId);
  return segments.length === 2 && isTutorialReadmeStem(getTutorialEntryStem(entryId));
}

export function resolveSeriesKeyFromTutorialEntryId(entryId: string): string {
  const segments = getTutorialEntrySegments(entryId);
  return normalizeSeriesKey(segments[0] || "");
}

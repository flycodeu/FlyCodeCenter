import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

export const root = process.cwd();
export const blogPrefix = "blog";
export const projectPrefix = "projects";
export const tutorialPrefix = "tutorials";
export const tutorialSeriesPrefix = "tutorials";
export const interviewPrefix = "interview";
export const targets = [
  { collection: "blog", dir: path.join(root, "src", "content", "blog") },
  { collection: "tutorial", dir: path.join(root, "src", "content", "tutorial") },
  { collection: "projects", dir: path.join(root, "src", "content", "projects") },
  { collection: "interview", dir: path.join(root, "src", "content", "interview") }
];

export const CREATE_TIME_RE = /^\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}:\d{2}$/;

const TITLE_ACRONYM_MAP = {
  ai: "AI",
  api: "API",
  css: "CSS",
  html: "HTML",
  http: "HTTP",
  https: "HTTPS",
  js: "JS",
  json: "JSON",
  llm: "LLM",
  mcp: "MCP",
  rag: "RAG",
  redis: "Redis",
  rss: "RSS",
  rtsp: "RTSP",
  sse: "SSE",
  sql: "SQL",
  ts: "TS",
  ui: "UI",
  ux: "UX",
  url: "URL",
  uuid: "UUID"
};

const TAG_ALIAS_MAP = {
  springboot: "SpringBoot",
  "spring boot": "SpringBoot",
  "spring-boot": "SpringBoot",
  ffmpeg: "FFmpeg",
  websocket: "WebSocket",
  mysql: "MySQL",
  centos: "CentOS7",
  centos7: "CentOS7",
  redis: "Redis",
  docker: "Docker",
  jenkins: "Jenkins",
  ai: "AI",
  mediamtx: "MediaMTX",
  langchain4j: "LangChain4j",
  sse: "SSE",
  mcp: "MCP",
  java: "Java",
  git: "Git",
  astro: "Astro",
  typescript: "TypeScript",
  javascript: "JavaScript"
};

const TUTORIAL_SERIES_ROUTE_ALIASES = {
  "c++": "cpp"
};

const INTERVIEW_SPACE_ROUTE_ALIASES = {
  "c++": "cpp"
};

function normalizeSlashes(value) {
  return String(value || "").replace(/\\/g, "/");
}

function stripMarkdownExtension(value) {
  return String(value || "").replace(/\.(md|mdx)$/i, "");
}

function stripReadmeSegments(segments) {
  return segments.map((segment, index) => {
    if (index > 0 && /^readme$/i.test(segment)) return "";
    return segment;
  });
}

function normalizeSourceIdentity(value) {
  return normalizeSlashes(stripMarkdownExtension(String(value || "")))
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function createShortHashCode(seed, prefix) {
  const hex = createHash("sha1").update(seed).digest("hex").slice(0, 12);
  const encoded = BigInt(`0x${hex}`).toString(36).padStart(8, "0").slice(0, 8);
  return `${prefix}${encoded}`;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatDateTime(date) {
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function isValidDate(date) {
  return Boolean(date) && !Number.isNaN(date.getTime());
}

function formatAsciiTitleWord(word) {
  const normalized = String(word || "").toLowerCase();
  return TITLE_ACRONYM_MAP[normalized] || normalized.replace(/^[a-z]/, (char) => char.toUpperCase());
}

export function normalizeTag(tag) {
  const raw = String(tag || "").trim();
  if (!raw) return "";
  const key = raw.toLowerCase().replace(/\s+/g, " ");
  return TAG_ALIAS_MAP[key] || raw;
}

export async function walk(dir) {
  const items = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const item of items) {
    const absolute = path.join(dir, item.name);
    if (item.isDirectory()) {
      files.push(...(await walk(absolute)));
      continue;
    }
    if (item.isFile() && (absolute.endsWith(".md") || absolute.endsWith(".mdx"))) {
      files.push(absolute);
    }
  }
  return files;
}

export function getRelativeContentPath(target, file) {
  return normalizeSlashes(path.relative(target.dir, file));
}

export function getSourceStemFromRelativePath(relativePath) {
  const segments = stripReadmeSegments(
    normalizeSlashes(relativePath)
      .split("/")
      .filter(Boolean)
      .map((segment) => stripMarkdownExtension(segment))
  ).filter(Boolean);
  return segments.at(-1) || stripMarkdownExtension(path.basename(relativePath)) || "";
}

export function deriveTitleFromSourceStem(stem) {
  let title = stripMarkdownExtension(String(stem || "").trim());
  if (!title) return "Untitled Article";

  if (/^[0-9]{1,4}[-_].+/.test(title) && /^[a-z0-9#+._-]+$/i.test(title)) {
    title = title.replace(/^[0-9]{1,4}[-_]+/, "");
  }

  if (/[-_]/.test(title) && /^[a-z0-9#+._ -]+$/i.test(title)) {
    const words = title
      .replace(/[_-]+/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => formatAsciiTitleWord(word));
    return words.join(" ").trim() || "Untitled Article";
  }

  return title;
}

export function sanitizeManualCode(input) {
  return String(input || "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function createGeneratedCode(collection, relativePath, fallback) {
  const segments = stripReadmeSegments(
    normalizeSlashes(relativePath)
      .split("/")
      .filter(Boolean)
      .map((segment) => stripMarkdownExtension(segment))
  ).filter(Boolean);
  const identity = normalizeSourceIdentity(segments.join("/"));
  const normalizedFallback = normalizeSourceIdentity(fallback || collection || "article");
  const seed = `${collection}:${identity || normalizedFallback || "article"}`;
  return createShortHashCode(seed, String(collection || "a").slice(0, 1).toLowerCase() || "a");
}

function getRawSourceStem(relativePath) {
  const normalized = normalizeSlashes(relativePath);
  const last = normalized.split("/").filter(Boolean).at(-1) || "";
  return stripMarkdownExtension(last).trim();
}

function normalizeSeriesKey(value) {
  return String(value || "").trim();
}

function normalizeInterviewSpaceKey(value) {
  return String(value || "").trim();
}

function toTutorialSeriesRouteKey(seriesKey) {
  const normalized = normalizeSeriesKey(seriesKey);
  if (!normalized) return normalized;
  return TUTORIAL_SERIES_ROUTE_ALIASES[normalized] || normalized;
}

function toInterviewSpaceRouteKey(spaceKey) {
  const normalized = normalizeInterviewSpaceKey(spaceKey);
  if (!normalized) return normalized;
  return INTERVIEW_SPACE_ROUTE_ALIASES[normalized] || normalized;
}

function getTutorialSeriesKeyFromRelativePath(relativePath) {
  const segments = normalizeSlashes(relativePath).split("/").filter(Boolean);
  return normalizeSeriesKey(segments[0] || "");
}

function isTutorialReadmeRelativePath(relativePath) {
  const segments = normalizeSlashes(relativePath).split("/").filter(Boolean);
  return segments.length === 2 && /^readme$/i.test(getRawSourceStem(relativePath));
}

function getInterviewSpaceKeyFromRelativePath(relativePath) {
  const segments = normalizeSlashes(relativePath).split("/").filter(Boolean);
  return normalizeInterviewSpaceKey(segments[0] || "");
}

function isInterviewReadmeRelativePath(relativePath) {
  const segments = normalizeSlashes(relativePath).split("/").filter(Boolean);
  return segments.length === 2 && /^readme$/i.test(getRawSourceStem(relativePath));
}

export function describePermalinkPattern(collection, relativePath = "") {
  if (collection === "blog") return `/${blogPrefix}/{code}/`;
  if (collection === "tutorial") {
    return isTutorialReadmeRelativePath(relativePath)
      ? `/${tutorialSeriesPrefix}/{series}/`
      : `/${tutorialPrefix}/{code}/`;
  }
  if (collection === "projects") return `/${projectPrefix}/{code}/`;
  if (collection === "interview") {
    return isInterviewReadmeRelativePath(relativePath)
      ? `/${interviewPrefix}/{space}/`
      : `/${interviewPrefix}/{code}/`;
  }
  return `/{collection}/{code}/`;
}

export function normalizePermalink(collection, _input, code, relativePath = "") {
  if (collection === "blog") {
    return `/${blogPrefix}/${code}/`;
  }
  if (collection === "tutorial") {
    if (isTutorialReadmeRelativePath(relativePath)) {
      const routeSeriesKey = toTutorialSeriesRouteKey(getTutorialSeriesKeyFromRelativePath(relativePath));
      if (routeSeriesKey) return `/${tutorialSeriesPrefix}/${routeSeriesKey}/`;
    }
    return `/${tutorialPrefix}/${code}/`;
  }

  if (collection === "projects") {
    return `/${projectPrefix}/${code}/`;
  }

  if (collection === "interview") {
    if (isInterviewReadmeRelativePath(relativePath)) {
      const routeSpaceKey = toInterviewSpaceRouteKey(getInterviewSpaceKeyFromRelativePath(relativePath));
      if (routeSpaceKey) return `/${interviewPrefix}/${routeSpaceKey}/`;
    }
    return `/${interviewPrefix}/${code}/`;
  }

  return `/${code}/`;
}

export function isValidArticlePermalink(collection, relativePath, permalink) {
  const trimmed = String(permalink || "").replace(/^\/+|\/+$/g, "");
  const parts = trimmed.split("/").filter(Boolean);
  if (collection === "blog") {
    return parts.length === 2 && parts[0] === blogPrefix && /^[a-z0-9-]+$/.test(parts[1]);
  }
  if (collection === "tutorial") {
    if (isTutorialReadmeRelativePath(relativePath)) {
      return parts.length === 2 && parts[0] === tutorialSeriesPrefix && Boolean(parts[1]);
    }
    return parts.length === 2 && parts[0] === tutorialPrefix && /^[a-z0-9-]+$/.test(parts[1]);
  }
  if (collection === "projects") {
    return parts.length === 2 && parts[0] === projectPrefix && /^[a-z0-9-]+$/.test(parts[1]);
  }
  if (collection === "interview") {
    if (isInterviewReadmeRelativePath(relativePath)) {
      return parts.length === 2 && parts[0] === interviewPrefix && Boolean(parts[1]);
    }
    return parts.length === 2 && parts[0] === interviewPrefix && /^[a-z0-9-]+$/.test(parts[1]);
  }
  return false;
}

export function normalizeTagsValue(input) {
  let values = [];
  if (Array.isArray(input)) {
    values = input.map((item) => String(item || "").trim()).filter(Boolean);
  } else if (typeof input === "string") {
    const trimmed = input.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed.replace(/'/g, "\""));
        if (Array.isArray(parsed)) {
          values = parsed.map((item) => String(item || "").trim()).filter(Boolean);
        }
      } catch {
        values = trimmed
          .slice(1, -1)
          .split(/[,\uff0c]/)
          .map((item) => item.trim())
          .filter(Boolean);
      }
    } else {
      values = trimmed
        .split(/[,\uff0c]/)
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  if (!values.length) return [];

  const seen = new Set();
  const normalized = [];
  for (const value of values) {
    const tag = normalizeTag(value);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    normalized.push(tag);
  }
  return normalized;
}

function extractLegacyMeta(content) {
  const lines = String(content || "").split(/\r?\n/);
  let cursor = 0;
  while (cursor < lines.length && !lines[cursor].trim()) cursor += 1;
  const start = cursor;
  if (start >= lines.length) return null;

  const meta = {};
  let found = false;
  const knownKeys = new Set([
    "title",
    "createTime",
    "updatedTime",
    "code",
    "permalink",
    "summary",
    "description",
    "tags",
    "type",
    "difficulty",
    "encrypted",
    "passwordHint",
    "draft",
    "space"
  ]);
  while (cursor < lines.length) {
    const line = lines[cursor];
    if (!line.trim()) break;
    const match = line.match(/^\s*([A-Za-z][\w-]*)\s*:\s*(.*)\s*$/);
    if (!match) break;
    const key = match[1];
    if (!knownKeys.has(key)) break;
    meta[key] = match[2] ?? "";
    found = true;
    cursor += 1;
  }

  if (!found) return null;

  let end = cursor;
  if (end < lines.length && !lines[end].trim()) end += 1;
  return {
    meta,
    content: [...lines.slice(0, start), ...lines.slice(end)].join("\n")
  };
}

function deleteEmptyScalar(data, key) {
  if (typeof data[key] === "string" && !data[key].trim()) {
    delete data[key];
    return true;
  }
  return false;
}

export function reorderFrontmatter(data) {
  const ordered = {};
  const keys = [
    "title",
    "createTime",
    "updatedTime",
    "code",
    "permalink",
    "summary",
    "description",
    "outline",
    "series",
    "order",
    "tags",
    "cover",
    "category",
    "icon",
    "showOnHome",
    "coverMode",
    "coverPosition",
    "type",
    "difficulty",
    "space",
    "encrypted",
    "passwordHint",
    "draft",
    "pinned"
  ];

  for (const key of keys) {
    if (Object.hasOwn(data, key) && data[key] !== undefined) {
      ordered[key] = data[key];
    }
  }

  for (const [key, value] of Object.entries(data)) {
    if (Object.hasOwn(ordered, key)) continue;
    if (value === undefined) continue;
    ordered[key] = value;
  }

  return ordered;
}

function stringifyWithoutFrontmatter(content) {
  return String(content || "").replace(/^\r?\n/, "");
}

function normalizeSerializedFrontmatter(serialized) {
  const text = String(serialized || "");
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/);
  if (!match) return text;

  const [, rawFrontmatter, separator] = match;
  const normalizedFrontmatter = rawFrontmatter.replace(
    /^cover:\s*>-\r?\n([ \t]+)(.+)$/m,
    (_full, _indent, value) => `cover: ${String(value || "").trim()}`
  );

  return `---\n${normalizedFrontmatter}\n---${separator}${text.slice(match[0].length)}`;
}

function resolveGitFirstCommitDateText(file) {
  const relativePath = normalizeSlashes(path.relative(root, file));
  const result = spawnSync(
    "git",
    ["log", "--diff-filter=A", "--follow", "--format=%aI", "-1", "--", relativePath],
    { cwd: root, encoding: "utf8" }
  );
  if (result.status !== 0) return "";
  const iso = String(result.stdout || "").trim().split(/\r?\n/)[0]?.trim();
  if (!iso) return "";
  const date = new Date(iso);
  return isValidDate(date) ? formatDateTime(date) : "";
}

function resolveCreateTime(file, currentValue) {
  const explicit = String(currentValue || "").trim();
  if (explicit && CREATE_TIME_RE.test(explicit)) return explicit;

  const gitCreateTime = resolveGitFirstCommitDateText(file);
  if (gitCreateTime) return gitCreateTime;

  try {
    const stat = fsSync.statSync(file);
    if (isValidDate(stat.birthtime) && stat.birthtime.getFullYear() > 1970) {
      return formatDateTime(stat.birthtime);
    }
    if (isValidDate(stat.mtime)) {
      return formatDateTime(stat.mtime);
    }
  } catch {
    // ignore
  }

  return formatDateTime(new Date());
}

export function syncArticleFrontmatter(target, file, raw) {
  const parsed = matter(raw);
  let data = { ...(parsed.data ?? {}) };
  let content = parsed.content ?? "";
  let dirty = false;

  const legacy = extractLegacyMeta(content);
  if (legacy) {
    data = { ...data, ...legacy.meta };
    content = legacy.content;
    dirty = true;
  }

  const relativePath = getRelativeContentPath(target, file);
  const stem = getSourceStemFromRelativePath(relativePath);
  const derivedTitle = deriveTitleFromSourceStem(stem);
  if (typeof data.title !== "string" || !data.title.trim()) {
    data.title = derivedTitle;
    dirty = true;
  }

  const createTime = resolveCreateTime(file, data.createTime);
  if (data.createTime !== createTime) {
    data.createTime = createTime;
    dirty = true;
  }

  const manualCodeInput = typeof data.code === "string" ? data.code.trim() : "";
  const normalizedManualCode = manualCodeInput ? sanitizeManualCode(manualCodeInput) : "";
  if (manualCodeInput && !normalizedManualCode) {
    throw new Error(`${normalizeSlashes(path.relative(root, file))}: invalid manual code "${manualCodeInput}"`);
  }
  const code = normalizedManualCode || createGeneratedCode(target.collection, relativePath, stem);
  if (data.code !== code) {
    data.code = code;
    dirty = true;
  }

  const permalink = normalizePermalink(target.collection, data.permalink, code, relativePath);
  if (data.permalink !== permalink) {
    data.permalink = permalink;
    dirty = true;
  }

  const normalizedTags = normalizeTagsValue(data.tags);
  if (normalizedTags.length) {
    const currentTags = Array.isArray(data.tags) ? data.tags.map((item) => String(item || "").trim()).filter(Boolean) : [];
    const tagChanged =
      currentTags.length !== normalizedTags.length ||
      currentTags.some((value, index) => value !== normalizedTags[index]);
    if (tagChanged || !Array.isArray(data.tags)) {
      data.tags = normalizedTags;
      dirty = true;
    }
  } else if (data.tags !== undefined) {
    delete data.tags;
    dirty = true;
  }

  for (const key of ["summary", "description", "outline", "series", "cover", "category", "icon", "type", "passwordHint", "space"]) {
    if (deleteEmptyScalar(data, key)) {
      dirty = true;
    }
  }

  const ordered = reorderFrontmatter(data);
  const hasFrontmatter = Object.keys(ordered).length > 0;
  const next = hasFrontmatter
    ? normalizeSerializedFrontmatter(matter.stringify(content, ordered))
    : stringifyWithoutFrontmatter(content);

  return {
    changed: dirty || next !== raw,
    next,
    code,
    permalink
  };
}

export async function runFrontmatterSync() {
  let changed = 0;
  let total = 0;
  const codeMap = new Map();
  const permalinkMap = new Map();
  const updates = [];

  for (const target of targets) {
    const files = await walk(target.dir);
    for (const file of files) {
      total += 1;
      const raw = await fs.readFile(file, "utf8");
      const result = syncArticleFrontmatter(target, file, raw);
      const rel = normalizeSlashes(path.relative(root, file));

      const codeOwner = codeMap.get(result.code);
      if (codeOwner && codeOwner !== rel) {
        throw new Error(`Duplicate article code "${result.code}" in ${rel} and ${codeOwner}`);
      }
      codeMap.set(result.code, rel);

      const permalinkOwner = permalinkMap.get(result.permalink);
      if (permalinkOwner && permalinkOwner !== rel) {
        throw new Error(`Duplicate article permalink "${result.permalink}" in ${rel} and ${permalinkOwner}`);
      }
      permalinkMap.set(result.permalink, rel);

      updates.push({ file, result });
    }
  }

  for (const { file, result } of updates) {
    if (!result.changed) continue;
    await fs.writeFile(file, result.next, "utf8");
    changed += 1;
  }

  return { total, changed };
}

export const minimizeArticleFrontmatter = syncArticleFrontmatter;
export const runFrontmatterMinify = runFrontmatterSync;

import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import matter from "gray-matter";

const root = process.cwd();
const articlePrefix = "article";
const targets = [
  { collection: "blog", dir: path.join(root, "src", "content", "blog") },
  { collection: "tutorial", dir: path.join(root, "src", "content", "tutorial") },
  { collection: "projects", dir: path.join(root, "src", "content", "projects") }
];

const LEGACY_KEYS = new Set([
  "title",
  "createTime",
  "permalink",
  "summary",
  "description",
  "tags",
  "code"
]);

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

function normalizeTag(tag) {
  const raw = String(tag || "").trim();
  if (!raw) return "";
  const key = raw.toLowerCase().replace(/\s+/g, " ");
  return TAG_ALIAS_MAP[key] || raw;
}

async function walk(dir) {
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

function normalizeEntryId(relativeFile) {
  return relativeFile
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\.(md|mdx)$/i, "");
}

function sanitizeManualCode(input) {
  if (typeof input !== "string") return "";
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "");
}

function toBase36Short(hex) {
  const normalized = hex.replace(/[^0-9a-f]/gi, "").toLowerCase();
  if (!normalized) return "r0000000";
  const numeric = BigInt(`0x${normalized}`);
  let code = numeric.toString(36).slice(0, 8).padStart(8, "0");
  if (/^\d/.test(code)) {
    code = `r${code.slice(1)}`;
  }
  return code;
}

function createGeneratedCode(collection, entryId, createTime) {
  const seed = `${collection}:${entryId.replace(/\\/g, "/").replace(/^\/+/, "")}:${String(createTime || "").trim()}`;
  const hex = createHash("sha256").update(seed).digest("hex").slice(0, 16);
  return toBase36Short(hex);
}

function normalizePermalinkPath(input) {
  const raw = String(input || "").trim();
  if (!raw) return "";
  const value = /^https?:\/\//i.test(raw)
    ? (() => {
        try {
          return new URL(raw).pathname;
        } catch {
          return raw;
        }
      })()
    : raw;
  let pathname = value.startsWith("/") ? value : `/${value}`;
  pathname = pathname.replace(/\/{2,}/g, "/");
  if (!pathname.endsWith("/")) pathname += "/";
  return pathname;
}

function isValidArticlePermalink(permalink) {
  const trimmed = permalink.replace(/^\/+|\/+$/g, "");
  const parts = trimmed.split("/").filter(Boolean);
  return parts.length === 2 && parts[0] === articlePrefix;
}

function normalizeTagsValue(input) {
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
          .split(/[,，]/)
          .map((item) => item.trim())
          .filter(Boolean);
      }
    } else {
      values = trimmed
        .split(/[,，]/)
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }
  if (!values.length) return [];

  const seen = new Set();
  const normalized = [];
  for (const item of values) {
    const value = normalizeTag(String(item || "").trim());
    if (!value || seen.has(value)) continue;
    seen.add(value);
    normalized.push(value);
  }
  return normalized;
}

function isValidDate(date) {
  return Boolean(date) && !Number.isNaN(date.getTime());
}

function parseDateParts(input) {
  const raw = String(input || "").trim();
  if (!raw) return null;
  const full = raw.match(/^(\d{4})[-/](\d{2})[-/](\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (full) {
    const [, y, m, d, hh, mm, ss] = full;
    const date = new Date(
      Number(y),
      Number(m) - 1,
      Number(d),
      Number(hh),
      Number(mm),
      Number(ss)
    );
    return isValidDate(date) ? date : null;
  }
  const dateOnly = raw.match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/);
  if (dateOnly) {
    const [, y, m, d] = dateOnly;
    const date = new Date(Number(y), Number(m) - 1, Number(d), 0, 0, 0);
    return isValidDate(date) ? date : null;
  }
  const parsed = new Date(raw);
  return isValidDate(parsed) ? parsed : null;
}

function formatDateTime(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function resolveGitFirstCommitDate(absolutePath) {
  const relativePath = path.relative(root, absolutePath).replace(/\\/g, "/");
  const result = spawnSync(
    "git",
    ["log", "--diff-filter=A", "--follow", "--format=%aI", "-1", "--", relativePath],
    { cwd: root, encoding: "utf8" }
  );
  if (result.status !== 0) return null;
  const iso = String(result.stdout || "").trim().split(/\r?\n/)[0]?.trim();
  if (!iso) return null;
  const date = new Date(iso);
  return isValidDate(date) ? date : null;
}

async function resolveCreateTimeFromFile(absolutePath) {
  try {
    const stat = await fs.stat(absolutePath);
    if (isValidDate(stat.birthtime) && stat.birthtime.getFullYear() > 1970) {
      return stat.birthtime;
    }
    const gitDate = resolveGitFirstCommitDate(absolutePath);
    if (isValidDate(gitDate)) return gitDate;
    if (isValidDate(stat.mtime)) return stat.mtime;
  } catch {
    // ignore
  }
  return new Date();
}

function extractLegacyMeta(content) {
  const lines = String(content || "").split(/\r?\n/);
  let cursor = 0;
  while (cursor < lines.length && !lines[cursor].trim()) cursor += 1;
  const start = cursor;
  if (start >= lines.length) return null;

  const meta = {};
  let found = false;
  while (cursor < lines.length) {
    const line = lines[cursor];
    if (!line.trim()) break;
    const match = line.match(/^\s*([A-Za-z][\w-]*)\s*:\s*(.*)\s*$/);
    if (!match) break;
    const key = match[1];
    if (!LEGACY_KEYS.has(key)) break;
    meta[key] = match[2] ?? "";
    found = true;
    cursor += 1;
  }

  if (!found) return null;

  let end = cursor;
  if (end < lines.length && !lines[end].trim()) {
    end += 1;
  }
  const nextLines = [...lines.slice(0, start), ...lines.slice(end)];
  return { meta, content: nextLines.join("\n") };
}

function reorderFrontmatter(data) {
  const ordered = {};
  const keys = [
    "title",
    "createTime",
    "code",
    "permalink",
    "summary",
    "description",
    "tags",
    "cover",
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

async function processFile(target, file) {
  const raw = await fs.readFile(file, "utf8");
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

  const normalizedTags = normalizeTagsValue(data.tags);
  if (normalizedTags.length) {
    const current = Array.isArray(data.tags) ? data.tags.map((item) => String(item || "").trim()) : [];
    const changed =
      current.length !== normalizedTags.length ||
      current.some((value, idx) => value !== normalizedTags[idx]);
    if (changed || !Array.isArray(data.tags)) {
      data.tags = normalizedTags;
      dirty = true;
    }
  } else if (data.tags !== undefined) {
    delete data.tags;
    dirty = true;
  }

  const createTimeRaw = data.createTime;
  let createTimeValue = "";
  const createTimeStr = typeof createTimeRaw === "string" ? createTimeRaw.trim() : "";
  if (createTimeStr && /^\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}:\d{2}$/.test(createTimeStr)) {
    createTimeValue = createTimeStr;
  } else {
    const parsedDate =
      createTimeRaw instanceof Date
        ? createTimeRaw
        : parseDateParts(createTimeRaw);
    const fallbackDate = parsedDate ?? (await resolveCreateTimeFromFile(file));
    createTimeValue = formatDateTime(fallbackDate);
    if (createTimeValue !== createTimeStr) {
      data.createTime = createTimeValue;
      dirty = true;
    } else if (createTimeRaw !== createTimeValue) {
      data.createTime = createTimeValue;
      dirty = true;
    }
  }

  const relativeFile = path.relative(target.dir, file);
  const entryId = normalizeEntryId(relativeFile);
  const manualCodeRaw = typeof data.code === "string" ? data.code : "";
  const manualCode = sanitizeManualCode(manualCodeRaw);
  if (manualCodeRaw && manualCodeRaw.trim() !== manualCode) {
    data.code = manualCode;
    dirty = true;
  }
  let codeValue = manualCode;
  if (!codeValue) {
    codeValue = createGeneratedCode(target.collection, entryId, createTimeValue);
    if (data.code !== codeValue) {
      data.code = codeValue;
      dirty = true;
    }
  }

  const permalinkRaw = typeof data.permalink === "string" ? data.permalink : "";
  if (permalinkRaw.trim()) {
    const normalizedPermalink = normalizePermalinkPath(permalinkRaw);
    if (!isValidArticlePermalink(normalizedPermalink)) {
      data.permalink = `/${articlePrefix}/${codeValue}/`;
      if (!data.code) {
        data.code = codeValue;
      }
      dirty = true;
    } else if (normalizedPermalink !== permalinkRaw) {
      data.permalink = normalizedPermalink;
      dirty = true;
    }
  }

  if (!dirty) return false;

  const next = matter.stringify(content, reorderFrontmatter(data));
  await fs.writeFile(file, next, "utf8");
  return true;
}

async function main() {
  let changed = 0;
  let total = 0;

  for (const target of targets) {
    const files = await walk(target.dir);
    for (const file of files) {
      total += 1;
      const updated = await processFile(target, file);
      if (updated) changed += 1;
    }
  }

  console.log(`[rebuild:frontmatter] scanned ${total} file(s), updated ${changed} file(s).`);
}

main().catch((error) => {
  console.error("[rebuild:frontmatter] failed:", error);
  process.exit(1);
});

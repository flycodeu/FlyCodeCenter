import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import matter from "gray-matter";
import { normalizeTag } from "../src/config/tag-normalize.config.ts";

const root = process.cwd();
const articlePrefix = "article";
const targets = [
  { collection: "blog", dir: path.join(root, "src", "content", "blog") },
  { collection: "tutorial", dir: path.join(root, "src", "content", "tutorial") },
  { collection: "projects", dir: path.join(root, "src", "content", "projects") }
];

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

function sanitizeManualCode(input) {
  if (typeof input !== "string") return "";
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "");
}

function createGeneratedCode(collection, entryId, createTime) {
  const seed = `${collection}:${entryId}:${String(createTime || "").trim()}`;
  const hex = createHash("sha256").update(seed).digest("hex").slice(0, 16);
  const value = BigInt(`0x${hex}`).toString(36).slice(0, 8).padStart(8, "0");
  return /^\d/.test(value) ? `r${value.slice(1)}` : value;
}

function normalizeEntryId(relativeFile) {
  return relativeFile
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\.(md|mdx)$/i, "")
    .toLowerCase();
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

function normalizeTags(input) {
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  const tags = [];
  for (const item of input) {
    const value = normalizeTag(String(item || "").trim());
    if (!value) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    tags.push(value);
  }
  return tags;
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

async function main() {
  let changed = 0;

  for (const target of targets) {
    const files = await walk(target.dir);
    for (const file of files) {
      const raw = await fs.readFile(file, "utf8");
      const parsed = matter(raw);
      const data = { ...(parsed.data ?? {}) };
      let dirty = false;

      if (Array.isArray(data.tags) && data.tags.length) {
        const source = data.tags.map((tag) => String(tag || "").trim()).filter(Boolean);
        const normalized = normalizeTags(source);
        const tagChanged = source.length !== normalized.length || source.some((value, idx) => value !== normalized[idx]);
        if (tagChanged) {
          data.tags = normalized;
          dirty = true;
        }
      }

      const relativeFile = path.relative(target.dir, file);
      const entryId = normalizeEntryId(relativeFile);
      const manualCode = sanitizeManualCode(data.code);
      if (typeof data.code === "string" && data.code.trim() && manualCode !== data.code.trim()) {
        data.code = manualCode;
        dirty = true;
      }
      const code = manualCode || createGeneratedCode(target.collection, entryId, data.createTime);

      const permalink = normalizePermalinkPath(data.permalink);
      if (permalink && !isValidArticlePermalink(permalink)) {
        data.permalink = `/${articlePrefix}/${code}/`;
        if (!manualCode && !data.code) {
          data.code = code;
        }
        dirty = true;
      }

      if (!dirty) continue;

      const next = matter.stringify(parsed.content, reorderFrontmatter(data));
      await fs.writeFile(file, next, "utf8");
      changed += 1;
    }
  }

  console.log(`[fix:frontmatter] updated ${changed} file(s)`);
}

main().catch((error) => {
  console.error("[fix:frontmatter] failed:", error);
  process.exit(1);
});

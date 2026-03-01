import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import matter from "gray-matter";
import { slug as githubSlug } from "github-slugger";
import { normalizeTag } from "../src/config/tag-normalize.config.ts";

const root = process.cwd();
const articlePrefix = "article";
const targets = [
  { collection: "blog", dir: path.join(root, "src", "content", "blog") },
  { collection: "tutorial", dir: path.join(root, "src", "content", "tutorial") },
  { collection: "projects", dir: path.join(root, "src", "content", "projects") }
];

const CREATE_TIME_RE = /^\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}:\d{2}$/;

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

function extractFrontmatter(raw) {
  const matched = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return matched?.[1] ?? "";
}

function hasInlineTagsArray(frontmatter) {
  return /^\s*tags\s*:\s*\[[^\]]*]\s*$/m.test(frontmatter);
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

function getAstroGeneratedContentId(relativeFile) {
  const withoutExt = relativeFile.replace(/\.(md|mdx)$/i, "");
  const rawSegments = withoutExt.split(/[\\/]/).filter(Boolean);
  return rawSegments.map((segment) => githubSlug(segment)).join("/").replace(/\/index$/, "");
}

function getAstroLoaderId(relativeFile, data) {
  if (typeof data?.slug === "string" && data.slug.length > 0) {
    return data.slug;
  }
  return getAstroGeneratedContentId(relativeFile);
}

function normalizePermalink(input, code) {
  const fallback = `/${articlePrefix}/${code}/`;
  const raw = String(input || "").trim();
  if (!raw) return fallback;

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
  const normalized = [];
  for (const item of input) {
    const value = normalizeTag(String(item || "").trim());
    if (!value) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    normalized.push(value);
  }
  return normalized;
}

async function main() {
  const errors = [];
  const idMap = new Map();
  const codeMap = new Map();
  const permalinkMap = new Map();

  for (const target of targets) {
    const files = await walk(target.dir);
    for (const file of files) {
      const rel = path.relative(root, file).replaceAll("\\", "/");
      const raw = await fs.readFile(file, "utf8");
      const frontmatter = extractFrontmatter(raw);

      if (frontmatter && hasInlineTagsArray(frontmatter)) {
        errors.push(`${rel}: tags must use YAML list format`);
      }

      let data;
      try {
        data = matter(raw).data ?? {};
      } catch (error) {
        errors.push(`${rel}: invalid frontmatter (${error.message})`);
        continue;
      }

      if (typeof data.createTime === "string" && data.createTime.trim() && !CREATE_TIME_RE.test(data.createTime.trim())) {
        errors.push(`${rel}: "createTime" must match YYYY/MM/DD HH:mm:ss`);
      }

      if (Array.isArray(data.tags) && data.tags.length) {
        const source = data.tags.map((tag) => String(tag || "").trim()).filter(Boolean);
        const normalized = normalizeTags(source);
        const changed = source.length !== normalized.length || source.some((value, idx) => value !== normalized[idx]);
        if (changed) {
          errors.push(`${rel}: tags should be normalized -> [${normalized.join(", ")}]`);
        }
      }

      const relativeInCollection = path.relative(target.dir, file);
      const entryId = normalizeEntryId(relativeInCollection);
      const loaderId = getAstroLoaderId(relativeInCollection, data);
      const idKey = `${target.collection}:${loaderId}`;
      const idOwner = idMap.get(idKey);
      if (idOwner && idOwner !== rel) {
        errors.push(`${rel}: duplicate content id "${loaderId}" (already used in ${idOwner})`);
      } else {
        idMap.set(idKey, rel);
      }

      const manualCode = sanitizeManualCode(data.code);
      const code = manualCode || createGeneratedCode(target.collection, entryId, data.createTime);
      if (!code) {
        errors.push(`${rel}: invalid "code"`);
        continue;
      }

      const permalink = normalizePermalink(data.permalink, code);
      if (!isValidArticlePermalink(permalink)) {
        errors.push(`${rel}: invalid permalink "${permalink}", expected /article/{slug}/`);
      }

      const codeOwner = codeMap.get(code);
      if (codeOwner && codeOwner !== rel) {
        errors.push(`${rel}: duplicate code "${code}" (already used in ${codeOwner})`);
      } else {
        codeMap.set(code, rel);
      }

      const permalinkOwner = permalinkMap.get(permalink);
      if (permalinkOwner && permalinkOwner !== rel) {
        errors.push(`${rel}: duplicate permalink "${permalink}" (already used in ${permalinkOwner})`);
      } else {
        permalinkMap.set(permalink, rel);
      }
    }
  }

  if (errors.length) {
    console.error("[lint:frontmatter] failed:");
    for (const message of errors) {
      console.error(`- ${message}`);
    }
    process.exit(1);
  }

  console.log("[lint:frontmatter] ok");
}

main().catch((error) => {
  console.error("[lint:frontmatter] failed:", error);
  process.exit(1);
});

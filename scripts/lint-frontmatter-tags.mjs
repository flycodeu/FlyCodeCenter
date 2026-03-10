import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import {
  CREATE_TIME_RE,
  createGeneratedCode,
  describePermalinkPattern,
  getRelativeContentPath,
  getSourceStemFromRelativePath,
  isValidArticlePermalink,
  normalizePermalink,
  normalizeTagsValue,
  sanitizeManualCode,
  targets,
  walk
} from "./frontmatter-maintenance.mjs";

function extractFrontmatter(raw) {
  const matched = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return matched?.[1] ?? "";
}

function hasInlineTagsArray(frontmatter) {
  return /^\s*tags\s*:\s*\[[^\]]*]\s*$/m.test(frontmatter);
}

const errors = [];
const codeMap = new Map();
const permalinkMap = new Map();

for (const target of targets) {
  const files = await walk(target.dir);
  for (const file of files) {
    const rel = path.relative(process.cwd(), file).replaceAll("\\", "/");
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
      const normalized = normalizeTagsValue(source);
      const changed = source.length !== normalized.length || source.some((value, index) => value !== normalized[index]);
      if (changed) {
        errors.push(`${rel}: tags should be normalized -> [${normalized.join(", ")}]`);
      }
    }

    const relativePath = getRelativeContentPath(target, file);
    const manualCodeInput = typeof data.code === "string" ? data.code.trim() : "";
    const manualCode = manualCodeInput ? sanitizeManualCode(manualCodeInput) : "";
    if (manualCodeInput && !manualCode) {
      errors.push(`${rel}: invalid manual code "${manualCodeInput}"`);
      continue;
    }
    const code = manualCode || createGeneratedCode(target.collection, relativePath, getSourceStemFromRelativePath(relativePath));
    if (!code) {
      errors.push(`${rel}: invalid generated code`);
      continue;
    }

    const permalink = normalizePermalink(target.collection, data.permalink, code, relativePath);
    if (!isValidArticlePermalink(target.collection, relativePath, permalink)) {
      errors.push(`${rel}: invalid permalink "${permalink}", expected ${describePermalinkPattern(target.collection, relativePath)}`);
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

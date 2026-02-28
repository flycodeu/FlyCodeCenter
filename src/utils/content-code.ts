import { createHash } from "node:crypto";
import type { CollectionEntry } from "astro:content";

export type CodedCollection = "blog" | "tutorial" | "projects";
export type CodedEntry = CollectionEntry<CodedCollection>;

const PREFIX_MAP: Record<CodedCollection, string> = {
  blog: "B",
  tutorial: "T",
  projects: "P"
};

function sanitizeManualCode(input: string): string {
  return input
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-")
    .replace(/[^A-Z0-9-_]/g, "");
}

function normalizePath(input: string): string {
  return input.replace(/\\/g, "/").replace(/^\/+/, "");
}

export function resolveEntryCode(entry: CodedEntry): string {
  const manualCode = typeof entry.data.code === "string" ? sanitizeManualCode(entry.data.code) : "";
  if (manualCode) return manualCode;

  const prefix = PREFIX_MAP[entry.collection];
  const seed = `${entry.collection}:${normalizePath(entry.id)}`;
  const digest = createHash("sha256").update(seed).digest("hex").slice(0, 8).toUpperCase();
  return `${prefix}-${digest}`;
}


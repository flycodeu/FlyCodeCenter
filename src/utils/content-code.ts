import { createHash } from "node:crypto";
import type { CollectionEntry } from "astro:content";

export type CodedCollection = "blog" | "tutorial" | "projects";
export type CodedEntry = CollectionEntry<CodedCollection>;

function normalizePath(input: string): string {
  return input.replace(/\\/g, "/").replace(/^\/+/, "");
}

export function sanitizeManualCode(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "");
}

function toBase36Short(hex: string): string {
  const normalized = hex.replace(/[^0-9a-f]/gi, "").toLowerCase();
  if (!normalized) return "r0000000";
  const numeric = BigInt(`0x${normalized}`);
  let code = numeric.toString(36).slice(0, 8).padStart(8, "0");
  if (/^\d/.test(code)) {
    code = `r${code.slice(1)}`;
  }
  return code;
}

export function createGeneratedCode(input: {
  collection: CodedCollection;
  entryId: string;
  createTime?: string;
}): string {
  const seed = `${input.collection}:${normalizePath(input.entryId)}:${String(input.createTime || "").trim()}`;
  const hex = createHash("sha256").update(seed).digest("hex").slice(0, 16);
  return toBase36Short(hex);
}

export function resolveEntryCode(entry: CodedEntry): string {
  const manualCodeRaw = (entry.data as Record<string, unknown>).code;
  const manualCode = typeof manualCodeRaw === "string" ? sanitizeManualCode(manualCodeRaw) : "";
  if (manualCode) return manualCode;
  return createGeneratedCode({
    collection: entry.collection,
    entryId: entry.id,
    createTime: String((entry.data as Record<string, unknown>).createTime || "")
  });
}

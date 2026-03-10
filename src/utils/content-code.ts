import type { CollectionEntry } from "astro:content";
import {
  createGeneratedCodeFromSourcePath,
  getEntrySourceRelativePath,
  getEntrySourceStem,
  sanitizeManualCode
} from "@/utils/content-source";

export type CodedCollection = "blog" | "tutorial" | "projects" | "interview";
export type CodedEntry = CollectionEntry<CodedCollection>;

export function createGeneratedCode(input: {
  collection: CodedCollection;
  sourcePath?: string;
  fallback?: string;
}): string {
  return createGeneratedCodeFromSourcePath({
    collection: input.collection,
    sourcePath: input.sourcePath,
    fallback: input.fallback
  });
}

export function resolveEntryCode(entry: CodedEntry): string {
  const manualCodeRaw = (entry.data as Record<string, unknown>).code;
  const manualCodeInput = typeof manualCodeRaw === "string" ? manualCodeRaw.trim() : "";
  const manualCode = manualCodeInput ? sanitizeManualCode(manualCodeInput) : "";
  if (manualCodeInput && !manualCode) {
    throw new Error(
      `Invalid manual article code for ${entry.collection}:${entry.id}. Use letters, numbers, spaces, "_" or "-".`
    );
  }
  if (manualCode) return manualCode;
  return createGeneratedCode({
    collection: entry.collection,
    sourcePath: getEntrySourceRelativePath(entry),
    fallback: getEntrySourceStem(entry)
  });
}

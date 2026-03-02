import { getCollection, render, type CollectionEntry } from "astro:content";

export type PageEntry = CollectionEntry<"pages">;

export async function getPageEntryByCode(code: string): Promise<PageEntry | undefined> {
  const all = await getCollection("pages", (entry) => !entry.data.draft);
  return all.find((entry) => entry.data.code === code);
}

export async function getRenderedPageByCode(code: string) {
  const entry = await getPageEntryByCode(code);
  if (!entry) return undefined;
  const rendered = await render(entry);
  return {
    entry,
    Content: rendered.Content,
    headings: rendered.headings
  };
}

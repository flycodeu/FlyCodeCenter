import type { APIRoute } from "astro";

export const prerender = false;

const globalStore = (globalThis as any).__flyViewStats || {
  counts: new Map<string, number>(),
  dedupe: new Map<string, number>()
};
(globalThis as any).__flyViewStats = globalStore;

const DEDUPE_SECONDS = 60 * 60 * 6;
const DEDUPE_MS = DEDUPE_SECONDS * 1000;

const env =
  ((import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {}) as Record<string, string | undefined>;

const KV_URL = env.KV_REST_API_URL ?? env.UPSTASH_REDIS_REST_URL ?? "";
const KV_TOKEN = env.KV_REST_API_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN ?? "";

function normalizeSlug(input: string) {
  const slug = String(input || "").trim();
  if (!slug) return "";
  return slug.replace(/\s+/g, " ").slice(0, 220);
}

function clientIdFromRequest(request: Request) {
  return request.headers.get("x-client-id")?.trim() || "anonymous";
}

async function execKv(parts: string[]): Promise<any> {
  const path = parts.map((part) => encodeURIComponent(part)).join("/");
  const response = await fetch(`${KV_URL}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`
    }
  });

  if (!response.ok) {
    throw new Error(`KV request failed: ${response.status}`);
  }

  const payload = await response.json();
  return payload?.result;
}

async function kvGetCount(slug: string): Promise<number> {
  const value = await execKv(["HGET", "views:counts", slug]);
  return Number(value || 0);
}

async function kvIncrement(slug: string, clientId: string): Promise<number> {
  const dedupeKey = `views:dedupe:${slug}:${clientId}`;
  const dedupe = await execKv(["SET", dedupeKey, "1", "EX", String(DEDUPE_SECONDS), "NX"]);
  if (dedupe === null) {
    return kvGetCount(slug);
  }

  const count = await execKv(["HINCRBY", "views:counts", slug, "1"]);
  return Number(count || 0);
}

function pruneMemoryDedupe(now = Date.now()) {
  for (const [key, expiry] of globalStore.dedupe.entries()) {
    if (expiry <= now) {
      globalStore.dedupe.delete(key);
    }
  }
}

function memoryGetCount(slug: string): number {
  return Number(globalStore.counts.get(slug) || 0);
}

function memoryIncrement(slug: string, clientId: string): number {
  const now = Date.now();
  pruneMemoryDedupe(now);

  const dedupeKey = `${slug}:${clientId}`;
  const existing = globalStore.dedupe.get(dedupeKey);
  if (existing && existing > now) {
    return memoryGetCount(slug);
  }

  globalStore.dedupe.set(dedupeKey, now + DEDUPE_MS);
  const next = memoryGetCount(slug) + 1;
  globalStore.counts.set(slug, next);
  return next;
}

async function parseSlug(request: Request, url: URL): Promise<string> {
  if (request.method === "GET") {
    return normalizeSlug(url.searchParams.get("slug") || "");
  }

  try {
    const body = await request.json();
    return normalizeSlug(body?.slug || "");
  } catch {
    return normalizeSlug(url.searchParams.get("slug") || "");
  }
}

async function getCount(slug: string): Promise<number> {
  if (KV_URL && KV_TOKEN) {
    try {
      return await kvGetCount(slug);
    } catch (error) {
      console.warn("[views] kv get failed, fallback memory", error);
    }
  }
  return memoryGetCount(slug);
}

async function incrementCount(slug: string, clientId: string): Promise<number> {
  if (KV_URL && KV_TOKEN) {
    try {
      return await kvIncrement(slug, clientId);
    } catch (error) {
      console.warn("[views] kv increment failed, fallback memory", error);
    }
  }
  return memoryIncrement(slug, clientId);
}

export const GET: APIRoute = async ({ request, url }) => {
  const slug = await parseSlug(request, url);
  if (!slug) {
    return new Response(JSON.stringify({ error: "missing slug" }), {
      status: 400,
      headers: { "content-type": "application/json; charset=utf-8" }
    });
  }

  const count = await getCount(slug);
  return new Response(JSON.stringify({ slug, count }), {
    headers: { "content-type": "application/json; charset=utf-8" }
  });
};

export const POST: APIRoute = async ({ request, url }) => {
  const slug = await parseSlug(request, url);
  if (!slug) {
    return new Response(JSON.stringify({ error: "missing slug" }), {
      status: 400,
      headers: { "content-type": "application/json; charset=utf-8" }
    });
  }

  const clientId = clientIdFromRequest(request);
  const count = await incrementCount(slug, clientId);

  return new Response(JSON.stringify({ slug, count }), {
    headers: { "content-type": "application/json; charset=utf-8" }
  });
};
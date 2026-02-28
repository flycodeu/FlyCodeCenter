import siteConfig from "@/site.config";

export function stripSlashes(input: string): string {
  return input.replace(/^\/+|\/+$/g, "");
}

export function ensureLeadingSlash(input: string): string {
  if (!input) return "/";
  return input.startsWith("/") ? input : `/${input}`;
}

export function withBase(pathname: string): string {
  const base = siteConfig.site.base === "/" ? "" : siteConfig.site.base;
  return `${base}${ensureLeadingSlash(pathname)}`.replace(/\/{2,}/g, "/");
}

export function absoluteUrl(pathname: string): string {
  const normalized = withBase(pathname);
  return new URL(normalized, siteConfig.site.hostname).toString();
}

export function trimPath(pathname: string): string {
  return pathname.replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/";
}

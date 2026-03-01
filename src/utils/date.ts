import siteConfig from "@/site.config";

const TOKEN_RE = /YYYY|MM|DD|HH|mm|ss/g;
const LOCALE_LIKE_RE = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function formatWithPattern(date: Date, pattern: string): string {
  const map: Record<string, string> = {
    YYYY: String(date.getFullYear()),
    MM: pad(date.getMonth() + 1),
    DD: pad(date.getDate()),
    HH: pad(date.getHours()),
    mm: pad(date.getMinutes()),
    ss: pad(date.getSeconds())
  };
  return pattern.replace(TOKEN_RE, (token) => map[token] ?? token);
}

function formatByLocale(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export function formatDate(
  input: Date | string | undefined,
  format = siteConfig.ui.date.format,
  locale = siteConfig.site.lang
): string {
  if (!input) return "";
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return "";

  const normalized = String(format || "").trim();
  if (!normalized) {
    return formatWithPattern(date, "YYYY-MM-DD");
  }

  if (TOKEN_RE.test(normalized)) {
    TOKEN_RE.lastIndex = 0;
    return formatWithPattern(date, normalized);
  }

  TOKEN_RE.lastIndex = 0;
  if (LOCALE_LIKE_RE.test(normalized)) {
    return formatByLocale(date, normalized);
  }

  return formatWithPattern(date, "YYYY-MM-DD");
}

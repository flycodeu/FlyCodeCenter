const isPrivateIpv4 = (hostname: string) => {
  const parts = hostname.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const [first, second] = parts;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 0) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    first >= 224
  );
};

const isPrivateHostname = (hostname: string) => {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized === "metadata.google.internal" ||
    normalized === "host.docker.internal"
  ) {
    return true;
  }

  if (normalized.includes(":")) {
    return (
      normalized === "::1" ||
      normalized === "::" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe80:")
    );
  }

  return isPrivateIpv4(normalized);
};

export function resolveSafeUpstreamEndpoint(apiBase: string): string {
  const raw = String(apiBase || "").trim();
  if (!raw) return "";

  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return "";
    if (import.meta.env.PROD && isPrivateHostname(url.hostname)) return "";
    if (!/\/chat\/completions\/?$/i.test(url.pathname)) {
      url.pathname = `${url.pathname.replace(/\/$/, "")}/chat/completions`;
    }
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

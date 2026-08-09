interface ResponsiveImageSources {
  src: string;
  srcset?: string;
}

const WIDTH_PARAM_HOSTS = new Set(["images.unsplash.com"]);

export function buildResponsiveImageSources(
  source: string,
  widths: readonly number[],
  fallbackWidth?: number
): ResponsiveImageSources {
  const normalizedSource = String(source || "").trim();
  if (!normalizedSource) return { src: "" };

  let url: URL;
  try {
    url = new URL(normalizedSource);
  } catch {
    return { src: normalizedSource };
  }

  if (!WIDTH_PARAM_HOSTS.has(url.hostname.toLowerCase())) {
    return { src: normalizedSource };
  }

  const normalizedWidths = [...new Set(widths)]
    .map((width) => Math.round(Number(width)))
    .filter((width) => Number.isFinite(width) && width > 0)
    .sort((a, b) => a - b);

  if (!normalizedWidths.length) return { src: normalizedSource };

  const withWidth = (width: number) => {
    const candidate = new URL(url);
    candidate.searchParams.set("w", String(width));
    return candidate.toString();
  };

  const resolvedFallbackWidth =
    fallbackWidth && normalizedWidths.includes(fallbackWidth)
      ? fallbackWidth
      : normalizedWidths[normalizedWidths.length - 1];

  return {
    src: withWidth(resolvedFallbackWidth),
    srcset: normalizedWidths.map((width) => `${withWidth(width)} ${width}w`).join(", ")
  };
}

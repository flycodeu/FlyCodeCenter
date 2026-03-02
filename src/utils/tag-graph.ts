import { getTagHue } from "@/utils/tag-color";

export interface TagGraphSourceItem {
  name: string;
  count: number;
  href?: string;
}

export interface TagGraphScaleOptions {
  minFontSize: number;
  maxFontSize: number;
  minWeight: number;
  maxWeight: number;
  alphaMin: number;
  alphaMax: number;
}

export interface TagGraphItem extends TagGraphSourceItem {
  hue: number;
  fontSize: number;
  fontWeight: number;
  alpha: number;
  accent: number;
  style: string;
}

function remapHotHue(hue: number, scale: number): number {
  if (scale < 0.65) return hue;
  if (hue >= 88 && hue <= 165) {
    return (hue + 132) % 360;
  }
  return hue;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function scaleByCount(count: number, minCount: number, maxCount: number): number {
  if (maxCount <= minCount) return 1;
  return clamp((count - minCount) / (maxCount - minCount), 0, 1);
}

function mapRange(progress: number, min: number, max: number): number {
  return min + (max - min) * progress;
}

export function buildTagGraphItems(items: TagGraphSourceItem[], options: TagGraphScaleOptions): TagGraphItem[] {
  if (!items.length) return [];

  const counts = items.map((item) => Number(item.count) || 0);
  const minCount = Math.min(...counts);
  const maxCount = Math.max(...counts);

  return items.map((item) => {
    const count = Number(item.count) || 0;
    const scale = scaleByCount(count, minCount, maxCount);
    const fontSize = mapRange(scale, options.minFontSize, options.maxFontSize);
    const fontWeight = Math.round(mapRange(scale, options.minWeight, options.maxWeight));
    const alpha = mapRange(scale, options.alphaMin, options.alphaMax);
    const accent = mapRange(scale, 42, 100);
    const hue = remapHotHue(getTagHue(item.name), scale);

    return {
      ...item,
      hue,
      fontSize,
      fontWeight,
      alpha,
      accent,
      style: `--node-size:${fontSize.toFixed(3)}rem;--node-weight:${fontWeight};--node-hue:${hue};--node-alpha:${alpha.toFixed(3)};--node-accent:${accent.toFixed(1)}%;`
    };
  });
}

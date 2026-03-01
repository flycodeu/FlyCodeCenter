function hashTag(input: string): number {
  let hash = 0;
  for (const char of input.trim().toLowerCase()) {
    hash = (hash << 5) - hash + char.charCodeAt(0);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getTagHue(tag: string): number {
  if (!tag.trim()) return 220;
  return hashTag(tag) % 360;
}

export function getTagColorVars(tag: string): string {
  const hue = getTagHue(tag);
  return `--tag-hue:${hue};--tag-border:hsl(${hue} 66% 52% / 0.42);--tag-bg:hsl(${hue} 72% 96%);--tag-text:hsl(${hue} 58% 31%);--tag-count-bg:hsl(${hue} 52% 90%);`;
}

// 标签统一使用品牌色系（蓝），不再按名称哈希出彩虹色。
// 视觉层级交给字号/字重/透明度表达，颜色保持一致以降低噪音。
const BRAND_HUE = 216;

export function getTagHue(_tag: string): number {
  return BRAND_HUE;
}

export function getTagColorVars(_tag: string): string {
  const hue = BRAND_HUE;
  return `--tag-hue:${hue};--tag-border:hsl(${hue} 34% 62% / 0.38);--tag-bg:hsl(${hue} 44% 97%);--tag-text:hsl(${hue} 30% 34%);--tag-count-bg:hsl(${hue} 36% 92%);`;
}

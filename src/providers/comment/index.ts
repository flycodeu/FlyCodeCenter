import siteConfig from "@/site.config";

export function isCommentEnabled(): boolean {
  return siteConfig.comment.provider !== "off";
}

export function getCommentProvider(): "off" | "giscus" | "waline" | "twikoo" {
  return siteConfig.comment.provider;
}

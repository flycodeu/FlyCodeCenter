import siteConfig from "@/site.config";
import { absoluteUrl } from "@/utils/url";

export function makePageTitle(title?: string): string {
  if (!title) return siteConfig.site.title;
  return `${title} | ${siteConfig.site.title}`;
}

export function resolveCanonical(pathname: string): string {
  return absoluteUrl(pathname);
}

export function buildArticleJsonLd(input: {
  title: string;
  description: string;
  url: string;
  datePublished: Date;
  dateModified?: Date;
  image?: string;
  tags?: string[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: input.title,
    description: input.description,
    datePublished: input.datePublished.toISOString(),
    dateModified: (input.dateModified ?? input.datePublished).toISOString(),
    author: {
      "@type": "Person",
      name: siteConfig.copyright.author
    },
    mainEntityOfPage: input.url,
    image: input.image ? absoluteUrl(input.image) : absoluteUrl(siteConfig.seo.defaultOgImage),
    keywords: input.tags?.join(", ")
  };
}

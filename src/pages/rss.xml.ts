import rss from "@astrojs/rss";
import siteConfig from "@/site.config";
import { fetchBlogEntries } from "@/utils/query";
import { getBlogEntryUrl } from "@/utils/content";
import { resolveArticleMeta } from "@/utils/article-meta";

export async function GET(context: any) {
  if (!siteConfig.seo.rss.enable) {
    return new Response("RSS disabled", { status: 404 });
  }

  const posts = await fetchBlogEntries();
  const items = posts.slice(0, siteConfig.seo.rss.limit).map((post) => {
    const meta = resolveArticleMeta(post);
    return {
      title: post.data.title,
      description: meta.description || meta.summary,
      pubDate: meta.createTime,
      link: getBlogEntryUrl(post)
    };
  });

  return rss({
    title: siteConfig.site.title,
    description: siteConfig.site.description,
    site: context.site ?? siteConfig.site.hostname,
    items,
    customData: `<language>${siteConfig.site.lang}</language>`
  });
}

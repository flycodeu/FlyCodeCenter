import siteConfig from "@/site.config";

export async function GET(context: any) {
  if (!siteConfig.seo.robots.enable) {
    return new Response("User-agent: *\nAllow: /\n", {
      headers: {
        "Content-Type": "text/plain; charset=utf-8"
      }
    });
  }

  const lines = ["User-agent: *"];
  if (siteConfig.seo.robots.disallow.length > 0) {
    for (const item of siteConfig.seo.robots.disallow) {
      lines.push(`Disallow: ${item}`);
    }
  } else {
    lines.push("Allow: /");
  }

  if (siteConfig.seo.sitemap.enable) {
    const sitemapUrl = new URL("sitemap-index.xml", context.site ?? siteConfig.site.hostname).toString();
    lines.push(`Sitemap: ${sitemapUrl}`);
  }

  return new Response(`${lines.join("\n")}\n`, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8"
    }
  });
}

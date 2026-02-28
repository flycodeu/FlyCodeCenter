export type SearchProvider = "off" | "pagefind" | "minisearch" | "algolia";
export type CommentProvider = "off" | "giscus" | "waline" | "twikoo";
export type AiProvider = "off" | "openaiCompatible" | "externalWidget";
export type ThemeId = "plume" | "night" | "ocean" | "sunset";
export type PaginationMode = "page" | "loadMore";
export type CoverMode = "right" | "left" | "none";
export type CardStyle = "rounded" | "square" | "glass";
export type MascotProvider = "off" | "live2d";
export type AiConnectionMode = "proxyOnly" | "hybrid";

const PUBLIC_ENV =
  ((import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {}) as Record<
    string,
    string | undefined
  >;

const siteConfig = {
  site: {
    base: "/",
    lang: "zh-CN",
    title: "飞云的编程宝典",
    description: "一份静态优先、性能导向、可插拔的 Astro 博客工程。",
    hostname: "https://flycodecenter.vercel.app",
    icon: "/favicon.svg",
    head: {
      meta: [
        { name: "theme-color", content: "#f6f8ff" },
        { name: "apple-mobile-web-app-capable", content: "yes" }
      ]
    }
  },
  shouldPrefetch: false,
  articlePrefix: "/article",
  blog: {
    include: ["**/*"],
    sorting: {
      pinFirst: true,
      pinScope: "home+blog",
      defaultOrder: "dateDesc"
    },
    pagination: {
      mode: "page" as PaginationMode,
      pageSize: 6,
      maxPageNumbers: 7
    },
    listCard: {
      defaultCoverMode: "right" as CoverMode,
      coverWidth: 232,
      coverHeight: 136,
      coverRatio: "16 / 9",
      cardStyle: "rounded" as CardStyle,
      fallbackWhenNoCover: "none" as "none" | "gradient" | "pattern"
    },
    pageCardOverrides: {
      blog: {
        coverMode: "right" as CoverMode
      },
      tutorial: {
        coverMode: "right" as CoverMode
      },
      tags: {
        coverMode: "none" as CoverMode
      }
    }
  },
  notes: [
    { key: "datastruct", title: "数据结构" },
    { key: "linux", title: "Linux" },
    { key: "rust", title: "Rust" },
    { key: "algorithm", title: "算法" }
  ],
  taxonomy: {
    enableTypeOverview: true,
    mode: "tagStats" as "tagStats",
    sources: ["blog", "tutorial"] as const,
    showTopN: 30
  },
  home: {
    hero: {
      enable: true,
      title: "飞云的编程宝典",
      tagline: "持续探索前端与架构设计",
      description: "在这里分享技术、生活与思考。致力于构建高性能、优美体验的现代 Web 应用。",
      actions: [
        { text: "浏览博客", link: "/blog", type: "primary" },
        { text: "查看教程", link: "/tutorials", type: "secondary" },
        { text: "关于我", link: "/about", type: "secondary" }
      ],
      image: {
        enable: true,
        src: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=2400&q=80",
        alt: "Hero Image"
      }
    }
  },
  theme: {
    defaultTheme: "plume" as ThemeId,
    themes: ["plume", "night", "ocean", "sunset"] as ThemeId[],
    appearance: true,
    logo: {
      text: "FlyCodeCenter",
      mark: "FC"
    },
    social: {
      github: "https://github.com/flycodecenter",
      wechat: "https://mp.weixin.qq.com"
    },
    footer: {
      message: "Built with Astro. Static First.",
      copyright: "Copyright © 2026 飞云"
    },
    profile: {
      avatar: "https://avatars.githubusercontent.com/u/1?v=4",
      shape: "rectangle" as "circle" | "rectangle",
      name: "飞云",
      desc: "资深前端 / Astro 架构实践",
      location: "Shenzhen, China",
      quote: "Stay hungry, stay foolish.",
      socials: [
        { name: "GitHub", icon: "github", link: "https://github.com/flycodecenter" },
        { name: "WeChat", icon: "wechat", link: "#" },
        { name: "Discord", icon: "discord", link: "#" }
      ]
    },
    toc: {
      enable: true,
      minDepth: 2,
      maxDepth: 3
    },
    navbar: [
      { text: "首页", link: "/" },
      { text: "博客", link: "/blog" },
      { text: "教程", link: "/tutorials" },
      { text: "聚合", link: "/sites" },
      { text: "摄影", link: "/gallery" },
      { text: "收藏", link: "/reading" },
      { text: "项目", link: "/projects" },
      { text: "关于", link: "/about" }
    ],
    transitions: {
      page: true,
      list: true,
      theme: true
    }
  },
  bulletin: {
    enable: true,
    id: "2026-spring-update",
    contentType: "markdown" as const,
    title: "站点公告",
    content:
      "欢迎来到 **飞云的编程宝典**。\n\n- 首页升级为置顶 + 时间流\n- 新增类型总览 / 聚合站点 / 收藏夹\n- 搜索支持 Ctrl + K 与模糊匹配"
  },
  copyright: {
    enable: true,
    author: "飞云",
    license: "CC-BY-4.0",
    showLink: true
  },
  prevNext: {
    enable: true
  },
  seo: {
    canonical: true,
    defaultOgImage: "/og-default.svg",
    twitterCard: "summary_large_image",
    sitemap: {
      enable: true
    },
    robots: {
      enable: true,
      disallow: ["/encrypted/"]
    },
    rss: {
      enable: true,
      limit: 50
    }
  },
  readingTime: {
    enable: true,
    wordsPerMinute: 260
  },
  markdown: {
    include: {
      enable: true
    },
    math: {
      enable: true
    },
    image: {
      figure: true,
      lazyload: true,
      size: true,
      mark: true
    },
    mermaid: {
      enable: true
    },
    chart: {
      enable: true
    }
  },
  features: {
    diagram: {
      mermaid: true,
      drawio: true,
      echarts: true
    },
    assistant: {
      aiPanel: true,
      mascot: true
    }
  },
  diagram: {
    mermaid: {
      bundleUrl: "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs",
      theme: "default"
    },
    drawio: {
      viewerBase: "https://viewer.diagrams.net"
    },
    echarts: {
      bundleUrl: "https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.esm.min.js",
      defaultHeight: 360
    }
  },
  codeHighlight: {
    provider: "shiki",
    theme: "vitesse-light",
    languages: ["ts", "js", "bash", "json", "md", "yaml", "rust", "cpp", "mermaid"],
    lineNumbers: true,
    showWhitespace: false,
    twoslash: false
  },
  search: {
    provider: "minisearch" as SearchProvider,
    topK: 8,
    fuzzy: 0.22,
    ui: {
      useNativeDialog: true,
      closeOnEsc: true,
      openShortcut: "/"
    },
    fallback: {
      enableInlinePanel: true
    },
    pagefind: {
      bundlePath: "/pagefind/pagefind.js"
    },
    minisearch: {
      indexPath: "/search/minisearch.json",
      fields: ["title", "description", "content", "tags", "headings", "code"],
      storeFields: ["title", "url", "description", "headings", "content", "code"],
      boost: {
        title: 5,
        code: 4,
        tags: 2.5,
        headings: 1.8
      }
    },
    algolia: {
      appId: PUBLIC_ENV.PUBLIC_ALGOLIA_APP_ID ?? "",
      apiKey: PUBLIC_ENV.PUBLIC_ALGOLIA_API_KEY ?? "",
      indexName: PUBLIC_ENV.PUBLIC_ALGOLIA_INDEX_NAME ?? ""
    }
  },
  watermark: {
    enable: true,
    text: "FlyCodeCenter",
    opacity: 0.05,
    rotate: -20,
    gap: 200
  },
  comment: {
    provider: "giscus" as CommentProvider,
    giscus: {
      repo: PUBLIC_ENV.PUBLIC_GISCUS_REPO ?? "owner/repo",
      repoId: PUBLIC_ENV.PUBLIC_GISCUS_REPO_ID ?? "",
      category: PUBLIC_ENV.PUBLIC_GISCUS_CATEGORY ?? "General",
      categoryId: PUBLIC_ENV.PUBLIC_GISCUS_CATEGORY_ID ?? "",
      mapping: "pathname",
      reactionsEnabled: "1",
      emitMetadata: "0",
      inputPosition: "top",
      lang: "zh-CN"
    },
    waline: {
      serverUrl: PUBLIC_ENV.PUBLIC_WALINE_SERVER ?? ""
    },
    twikoo: {
      envId: PUBLIC_ENV.PUBLIC_TWIKOO_ENV_ID ?? ""
    }
  },
  encrypt: {
    enable: false,
    outputDir: "public/encrypted",
    algorithm: "AES-GCM",
    manifestFile: "public/encrypted/manifest.json"
  },
  ai: {
    provider: "off" as AiProvider,
    triggerShortcut: "k",
    connectionMode: "proxyOnly" as AiConnectionMode,
    openaiCompatible: {
      apiBaseUrl: PUBLIC_ENV.PUBLIC_AI_API_BASE_URL ?? "",
      model: PUBLIC_ENV.PUBLIC_AI_MODEL ?? "gpt-4o-mini",
      allowClientOverride: true,
      headers: {
        "X-Client-Name": "flycodecenter"
      }
    },
    externalWidget: {
      scriptSrc: PUBLIC_ENV.PUBLIC_AI_WIDGET_SRC ?? "",
      iframeSrc: PUBLIC_ENV.PUBLIC_AI_WIDGET_IFRAME ?? ""
    }
  },
  mascot: {
    provider: "off" as MascotProvider,
    modelUrl: "",
    sprite: "/mascot.png",
    position: "right" as "left" | "right",
    draggable: true,
    mobileHidden: true,
    speed: 24
  },
  pages: {
    types: {
      enable: true,
      title: "标签总览"
    },
    sites: {
      enable: true,
      title: "聚合网站",
      grid: {
        columns: {
          xl: 4,
          lg: 3,
          md: 2
        },
        gap: 14
      },
      filter: {
        enable: true,
        defaultCategory: "all"
      }
    },
    reading: {
      enable: true,
      title: "优秀文章收集"
    },
    projects: {
      enable: true,
      title: "项目实践",
      showFeaturedFirst: true
    },
    archives: {
      enable: true,
      title: "归档"
    }
  }
} as const;

export type SiteConfig = typeof siteConfig;
export default siteConfig;

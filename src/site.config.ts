export type SearchProvider = "off" | "pagefind" | "minisearch" | "algolia";
export type CommentProvider = "off" | "giscus" | "waline" | "twikoo";
export type AiProvider = "off" | "openaiCompatible" | "externalWidget";
export type ThemeId = "plume" | "night" | "ocean" | "sunset" | "tech";
export type PaginationMode = "page" | "loadMore";
export type CoverMode = "right" | "left" | "none";
export type CardStyle = "rounded" | "square" | "glass";
export type MascotProvider = "off" | "live2d";
export type AiConnectionMode = "proxyOnly" | "hybrid";
import { defineSiteConfig } from "./config/define-site-config";
import articleMetaConfig from "./config/article-meta.config";

const PUBLIC_ENV =
  ((import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {}) as Record<
    string,
    string | undefined
  >;

const siteConfig = defineSiteConfig({
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
  ui: {
    date: {
      format: "YYYY-MM-DD",
      icon: "calendar"
    },
    list: {
      showPageHero: false
    }
  },
  articlePrefix: "/article",
  article: {
    ui: {
      showCodeBadge: false,
      density: "compact" as "comfortable" | "compact",
      readingProgress: {
        enable: true,
        minScrollableHeight: 40,
        sideOffset: 18
      },
      spacing: {
        topBarBottom: "0.8rem",
        heroBottom: "0.9rem",
        headPaddingTop: "1.15rem",
        headPaddingBottom: "0.95rem",
        headGap: "0.65rem",
        headBottom: "1.05rem",
        articleBottom: "1rem",
        summarySize: "1rem",
        paragraphMargin: "0.78em",
        h2Top: "1.9rem",
        h2Bottom: "0.85rem",
        h3Top: "1.2rem",
        h3Bottom: "0.6rem"
      }
    }
  },
  articleMeta: articleMetaConfig,
  blog: {
    include: ["**/*"],
    sorting: {
      pinFirst: true,
      pinScope: "home+blog",
      defaultOrder: "dateDesc"
    },
    pagination: {
      mode: "page" as PaginationMode,
      pageSize: 10,
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
    themes: ["plume", "tech", "night", "ocean", "sunset"] as ThemeId[],
    switchableThemes: ["plume", "night"] as ThemeId[],
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
      { text: "收藏", link: "/sites" },
      { text: "摄影", link: "/gallery" },
      { text: "优秀文章", link: "/reading" },
      { text: "项目", link: "/projects" },
      { text: "标签", link: "/tags" },
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
      "欢迎来到 **飞云的编程宝典**。\n\n- 首页升级为置顶 + 时间流\n- 新增标签中心 / 收藏 / 优秀文章\n- 搜索支持高亮与模糊匹配"
  },
  themeConfig: {
    nav: [
      { text: "首页", link: "/" },
      { text: "博客", link: "/blog" },
      { text: "教程", link: "/tutorials" },
      { text: "收藏", link: "/sites" },
      { text: "摄影", link: "/gallery" },
      { text: "优秀文章", link: "/reading" },
      { text: "项目", link: "/projects" },
      { text: "标签", link: "/tags" },
      { text: "关于", link: "/about" }
    ]
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
      disallow: ["/encrypted/", "/gallery/"]
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
    gfm: {
      enable: true
    },
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
    },
    copy: {
      code: true,
      math: true,
      mermaid: true
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
    languages: ["ts", "js", "javascript", "java", "sql", "bash", "json", "md", "yaml", "rust", "cpp", "mermaid", "txt"],
    lineNumbers: true,
    showWhitespace: false,
    twoslash: false
  },
  search: {
    provider: "pagefind" as SearchProvider,
    topK: 8,
    fuzzy: 0.22,
    ui: {
      useNativeDialog: true,
      closeOnEsc: true,
      openShortcut: "/",
      groupByDomain: true
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
    gap: 200,
    fontSize: "clamp(1.8rem, 4vw, 3.1rem)",
    keepCenterReadable: true
  },
  gallery: {
    pageSize: 12,
    lazyBatchSize: 8,
    antiCrawl: true
  },
  stats: {
    enable: true,
    endpoint: "/api/views"
  },
  comment: {
    provider: "waline" as CommentProvider,
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
    provider: "openaiCompatible" as AiProvider,
    triggerShortcut: "k",
    connectionMode: "hybrid" as AiConnectionMode,
    defaultModel: "gpt-4o-mini",
    models: [
      { id: "gpt-4o-mini", label: "GPT-4o mini", provider: "openai", apiBaseUrl: "https://api.openai.com/v1" },
      { id: "gpt-4o", label: "GPT-4o", provider: "openai", apiBaseUrl: "https://api.openai.com/v1" },
      { id: "deepseek-chat", label: "DeepSeek Chat", provider: "openai-compatible", apiBaseUrl: "https://api.deepseek.com/v1" },
      { id: "qwen-plus", label: "Qwen Plus", provider: "openai-compatible", apiBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1" }
    ],
    promptTemplates: [
      { id: "assistant-default", name: "通用助手", content: "你是站点 AI 助手，回答准确、结构清晰、简洁。必要时给出步骤。" },
      { id: "frontend-review", name: "前端评审", content: "你是高级前端代码评审专家。先给问题与风险，再给修复建议和示例代码。" },
      { id: "article-summary", name: "文章总结", content: "请先输出 3-5 条核心结论，再给关键证据点和可执行建议。" },
      { id: "learning-coach", name: "学习教练", content: "你是学习教练。根据用户目标给出短周期计划、练习清单和检查点。" }
    ],
    openaiCompatible: {
      apiBaseUrl: PUBLIC_ENV.PUBLIC_AI_API_BASE_URL ?? "https://api.openai.com/v1",
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
      title: "标签中心"
    },
    sites: {
      enable: true,
      title: "收藏",
      description: "按主题维护高质量站点卡片，支持分类筛选与自定义排序。",
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
      },
      navLabel: "收藏",
      cardStyle: "compact" as "compact" | "comfortable"
    },
    reading: {
      enable: true,
      title: "优秀文章"
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
} as const);

export type SiteConfig = typeof siteConfig;
export default siteConfig;

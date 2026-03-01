export type SearchProvider = "off" | "pagefind" | "minisearch" | "algolia";
export type CommentProvider = "off" | "giscus" | "waline" | "twikoo";
export type ThemeId = "plume" | "night" | "ocean" | "sunset" | "tech";
export type PaginationMode = "page" | "loadMore";
export type CoverMode = "right" | "left" | "none";
export type CardStyle = "rounded" | "square" | "glass";
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
    themes: ["plume", "ocean", "sunset", "night", "tech"] as ThemeId[],
    switchableThemes: ["plume", "ocean", "sunset", "night", "tech"] as ThemeId[],
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
      copyright: "Copyright (c) 2026 飞云"
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
      minDepth: 1,
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
      { text: "Jarvis", link: "/jarvis" },
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
      { text: "Jarvis", link: "/jarvis" },
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
    theme: {
      light: "vitesse-light",
      dark: "vitesse-dark"
    },
    languages: [
      "ts",
      "tsx",
      "js",
      "jsx",
      "javascript",
      "typescript",
      "java",
      "kotlin",
      "kt",
      "kts",
      "groovy",
      "sql",
      "bash",
      "sh",
      "shell",
      "powershell",
      "ps1",
      "cmd",
      "bat",
      "python",
      "py",
      "go",
      "c",
      "cpp",
      "csharp",
      "cs",
      "rust",
      "json",
      "json5",
      "jsonc",
      "md",
      "markdown",
      "yaml",
      "yml",
      "toml",
      "ini",
      "properties",
      "dotenv",
      "html",
      "xml",
      "vue",
      "docker",
      "dockerfile",
      "nginx",
      "makefile",
      "diff",
      "http",
      "log",
      "mermaid",
      "txt",
      "plaintext"
    ],
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
  jarvis: {
    enable: true,
    route: "/jarvis",
    floatingOrb: {
      enable: true,
      label: "JARVIS"
    },
    defaultModels: [
      { id: "gpt-4o-mini", name: "GPT-4o mini", apiBase: "https://api.openai.com/v1" },
      { id: "gpt-4o", name: "GPT-4o", apiBase: "https://api.openai.com/v1" },
      { id: "deepseek-chat", name: "DeepSeek Chat", apiBase: "https://api.deepseek.com/v1" },
      { id: "qwen-plus", name: "Qwen Plus", apiBase: "https://dashscope.aliyuncs.com/compatible-mode/v1" }
    ]
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










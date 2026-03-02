export type SearchProvider = "off" | "pagefind" | "minisearch" | "algolia";
export type CommentProvider = "off" | "giscus" | "waline" | "twikoo";
export type ThemeId = "aurora-light" | "aurora-dark";
export type PaginationMode = "page" | "loadMore";
export type CoverMode = "right" | "left" | "top" | "none";
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
    },
    antiCrawl: {
      enable: true,
      lockOnSuspicious: true,
      maxCopyActions: 8,
      timeWindowMs: 20000
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
      coverInlineSize: 224,
      coverTopMaxHeight: 154,
      coverAspectRatio: "16 / 9",
      mobileCollapseToTop: true,
      coverWidth: 224,
      coverHeight: 154,
      coverRatio: "16 / 9",
      cardStyle: "rounded" as CardStyle,
      titleLines: 2,
      outlineLines: 2,
      summaryLines: 3,
      tagsMax: 3,
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
        coverMode: "right" as CoverMode
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
    showTopN: 30,
    tagGraph: {
      enable: true,
      minFontSize: 0.88,
      maxFontSize: 1.48,
      minWeight: 430,
      maxWeight: 680,
      alphaMin: 0.58,
      alphaMax: 0.96,
      layout: "cloud" as "cloud"
    }
  },
  home: {
    feed: {
      mode: "page" as "page" | "infinite",
      pageSize: 10,
      mixCollections: ["blog", "tutorial"] as const
    },
    featured: {
      enable: true,
      source: "pinnedFirst" as "pinnedFirst",
      fallbackToLatest: true,
      maxRecent: 6
    },
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
    defaultTheme: "aurora-light" as ThemeId,
    themes: ["aurora-light", "aurora-dark"] as ThemeId[],
    switchableThemes: ["aurora-light", "aurora-dark"] as ThemeId[],
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
      { text: "归档", link: "/archives" },
      { text: "收藏", link: "/sites" },
      { text: "摄影", link: "/gallery" },
      { text: "推荐", link: "/reading" },
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
      "欢迎来到 **飞云的编程宝典**。\n\n- 首页升级为置顶 + 时间流\n- 新增标签中心 / 收藏 / 推荐\n- 搜索支持高亮与模糊匹配"
  },
  themeConfig: {
    nav: [
      { text: "首页", link: "/" },
      { text: "博客", link: "/blog" },
      { text: "教程", link: "/tutorials" },
      { text: "归档", link: "/archives" },
      { text: "收藏", link: "/sites" },
      { text: "摄影", link: "/gallery" },
      { text: "推荐", link: "/reading" },
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
    provider: "prism",
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
    lineNumbers: false,
    showWhitespace: false,
    twoslash: false
  },
  codeTheme: {
    defaultTheme:
      "mac-light" as "mac-light" | "mac-dark" | "github-light" | "github-dark" | "idea-dark" | "one-light" | "one-dark",
    themes: [
      "mac-light",
      "mac-dark",
      "github-light",
      "github-dark",
      "idea-dark",
      "one-light",
      "one-dark"
    ] as const,
    storageKey: "flycode-code-theme",
    panelColors: {
      "mac-light": { panel: "#f7f9fd", border: "#d7dfec", header: "#eef3fb" },
      "mac-dark": { panel: "#242c3a", border: "#3a475c", header: "#2e3748" },
      "github-light": { panel: "#f6f8fa", border: "#d0d7de", header: "#eef2f7" },
      "github-dark": { panel: "#1b2230", border: "#324056", header: "#242d3d" },
      "idea-dark": { panel: "#2f333b", border: "#444b57", header: "#3a404d" },
      "one-light": { panel: "#f8fafc", border: "#d9e1ee", header: "#eef2fb" },
      "one-dark": { panel: "#2a303b", border: "#404958", header: "#353d4c" }
    } as const
  },
  search: {
    provider: "pagefind" as SearchProvider,
    runtimeFallback: "minisearch" as "off" | "minisearch",
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
      bundlePath: "/pagefind/pagefind.js",
      enableInDev: false
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
    scope: "hero" as "hero" | "global",
    opacity: 0.04,
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
    interaction: {
      eventNamespace: "jarvis",
      defaultState: "idle" as "idle" | "active",
      clickState: "active" as "idle" | "active",
      hoverState: "active" as "idle" | "active"
    },
    floatingOrb: {
      enable: true,
      label: "JARVIS",
      position: "left" as "left" | "right",
      offsetX: 16,
      offsetY: 16,
      defaultState: "idle" as "idle" | "active",
      clickState: "active" as "idle" | "active",
      defaultText: "已待命",
      activeText: "连接中",
      modelPresetKey: "gpt-4o-mini",
      actionId: "open-settings"
    },
    personaPresets: [
      {
        id: "jarvis-classic",
        name: "Jarvis 经典",
        avatarType: "orb" as "orb" | "live2d" | "custom",
        defaultText: "已待命",
        activeText: "连接中",
        greeting: "系统已上线。请先在左下角设置模型，然后开始对话。",
        actions: ["open-settings", "toggle-voice"]
      },
      {
        id: "virtual-host",
        name: "虚拟主持人",
        avatarType: "custom" as "orb" | "live2d" | "custom",
        defaultText: "准备互动",
        activeText: "正在回应",
        greeting: "虚拟角色已激活，可在设置面板继续配置形象与动作。",
        actions: ["open-settings", "wave", "greet"]
      }
    ],
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
      title: "推荐"
    },
    projects: {
      enable: true,
      title: "项目实践",
      showFeaturedFirst: true
    },
    tutorials: {
      enable: true,
      title: "教程总览",
      seriesLabels: {
        rust: "Rust 教程",
        godot: "Godot 教程",
        redis: "Redis 教程",
        datastruct: "数据结构教程",
        uncategorized: "未分类教程"
      }
    },
    archives: {
      enable: true,
      title: "归档",
      timeline: {
        layoutMode: "both" as "both" | "left" | "right",
        showMonthCount: true,
        stickyYearLabel: false,
        itemMaxWidth: 420,
        lineWidth: 2,
        dotSize: 10
      },
      showCover: true,
      coverAspectRatio: "16 / 9",
      cardMinHeight: 252,
      card: {
        thumbWidth: 132,
        thumbAspectRatio: "16 / 9",
        titleLines: 2,
        tagsMax: 3
      },
      antiCrawl: {
        enable: true,
        lockOnSuspicious: true,
        maxActions: 10,
        timeWindowMs: 20000
      }
    },
    tags: {
      enable: true,
      title: "标签中心",
      list: {
        mode: "page" as "page" | "infinite",
        pageSize: 10
      },
      antiCrawl: {
        enable: true,
        lockOnSuspicious: true,
        maxActions: 10,
        timeWindowMs: 20000
      }
    }
  }
} as const);

export type SiteConfig = typeof siteConfig;
export default siteConfig;










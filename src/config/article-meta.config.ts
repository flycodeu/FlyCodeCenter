export interface ArticleMetaDefaults {
  summary: string;
  description: string;
  tags: string[];
  createTime: string;
  updatedTime: string;
  cover: string;
  showCover: boolean;
  permalink: string;
  draft: boolean;
  encrypted: boolean;
  encryptedFile: string;
  passwordHint: string;
  pinned: boolean;
  series: string;
  order: number;
  projectType: string;
  repoUrl: string;
  docUrl: string;
  demoUrl: string;
  featured: boolean;
  weight: number;
}

export type ArticleMetaOverride = Partial<ArticleMetaDefaults>;

const defaults: ArticleMetaDefaults = {
  summary: "",
  description: "",
  tags: [],
  createTime: "2026/01/01 00:00:00",
  updatedTime: "",
  cover: "",
  showCover: false,
  permalink: "",
  draft: false,
  encrypted: false,
  encryptedFile: "",
  passwordHint: "",
  pinned: false,
  series: "uncategorized",
  order: 1,
  projectType: "general",
  repoUrl: "",
  docUrl: "",
  demoUrl: "",
  featured: false,
  weight: 0
};

const articleMetaConfig = {
  defaults,
  overridesByCode: {
    "r57x3pt2": {
      pinned: true
    },
    "r6q2m9ad": {
      pinned: true
    },
    "r2a1d7kq": {
      series: "datastruct",
      order: 1
    },
    "r3h9p5zw": {
      series: "datastruct",
      order: 2
    },
    "astro-mod-blog": {
      projectType: "blog-platform",
      repoUrl: "https://github.com/flycodecenter/astro-modular-blog",
      docUrl: "https://flycodecenter.vercel.app/projects/astro-modular-blog",
      demoUrl: "https://flycodecenter.vercel.app",
      featured: true,
      weight: 100
    },
    "deploy-toolkit": {
      projectType: "deployment",
      repoUrl: "https://github.com/flycodecenter/deploy-toolkit",
      docUrl: "https://flycodecenter.vercel.app/projects/deploy-toolkit",
      featured: false,
      weight: 80
    }
  } as Record<string, ArticleMetaOverride>
};

export type ArticleMetaConfig = typeof articleMetaConfig;
export default articleMetaConfig;

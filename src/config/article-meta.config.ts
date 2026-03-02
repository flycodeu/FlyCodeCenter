export type ProjectStage = "completed" | "in-progress" | "planned";

export interface ArticleMetaDefaults {
  summary: string;
  outline: string;
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
  projectStage: ProjectStage;
  priority: number;
}

export type ArticleMetaOverride = Partial<ArticleMetaDefaults>;

const defaults: ArticleMetaDefaults = {
  summary: "",
  outline: "",
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
  weight: 0,
  projectStage: "completed",
  priority: 0
};

const articleMetaConfig = {
  defaults,
  projectCoverFallbackByStage: {
    completed: "/covers/project-completed.svg",
    "in-progress": "/covers/project-in-progress.svg",
    planned: "/covers/project-planned.svg"
  } as Record<ProjectStage, string>,
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
    voidtab: {
      projectType: "browser-extension",
      repoUrl: "https://github.com/flycodeu/VoidTab",
      showCover: true,
      featured: true,
      weight: 100,
      projectStage: "completed",
      priority: 95
    },
    flycodecenter: {
      projectType: "personal-blog",
      repoUrl: "https://github.com/flycodeu/FlyCodeCenter",
      demoUrl: "https://www.flycode.icu/",
      showCover: true,
      featured: true,
      weight: 96,
      projectStage: "completed",
      priority: 90
    },
    "novel-local": {
      projectType: "desktop-ai-app",
      repoUrl: "https://github.com/flycodeu/novel-local",
      showCover: true,
      featured: true,
      weight: 94,
      projectStage: "completed",
      priority: 88
    },
    "video-ai-monitor": {
      projectType: "business-ai-monitor",
      featured: true,
      weight: 120,
      projectStage: "planned",
      priority: 100
    },
    "smart-clipboard": {
      projectType: "productivity-tool",
      featured: false,
      weight: 86,
      projectStage: "planned",
      priority: 85
    },
    "tools-platform": {
      projectType: "tools-platform",
      featured: false,
      weight: 84,
      projectStage: "planned",
      priority: 80
    },
    "medication-tracker": {
      projectType: "healthcare-tool",
      featured: false,
      weight: 82,
      projectStage: "planned",
      priority: 76
    },
    "wuxia-schedule-roguelite": {
      projectType: "indie-game",
      featured: false,
      weight: 80,
      projectStage: "planned",
      priority: 72
    },
    "pixel-character-generator": {
      projectType: "ai-creative-tool",
      featured: false,
      weight: 78,
      projectStage: "planned",
      priority: 70
    }
  } as Record<string, ArticleMetaOverride>
};

export type ArticleMetaConfig = typeof articleMetaConfig;
export default articleMetaConfig;

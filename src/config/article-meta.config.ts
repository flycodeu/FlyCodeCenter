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
  overridesBySourcePath: {
    "blog/个人学习计划.md": {
      pinned: true
    },
    "projects/voidtab/README.md": {
      projectType: "browser-extension",
      repoUrl: "https://github.com/flycodeu/VoidTab",
      showCover: true,
      featured: true,
      weight: 100,
      projectStage: "completed",
      priority: 95
    },
    "projects/flycodecenter/README.md": {
      projectType: "personal-blog",
      repoUrl: "https://github.com/flycodeu/FlyCodeCenter",
      demoUrl: "https://www.flycode.icu/",
      showCover: true,
      featured: true,
      weight: 96,
      projectStage: "completed",
      priority: 90
    },
    "projects/novel-local/README.md": {
      projectType: "desktop-ai-app",
      repoUrl: "https://github.com/flycodeu/novel-local",
      showCover: true,
      featured: true,
      weight: 94,
      projectStage: "completed",
      priority: 88
    },
    "projects/video-ai-monitor/README.md": {
      projectType: "business-ai-monitor",
      featured: true,
      weight: 120,
      projectStage: "planned",
      priority: 100
    },
    "projects/smart-clipboard/README.md": {
      projectType: "productivity-tool",
      featured: false,
      weight: 86,
      projectStage: "planned",
      priority: 85
    },
    "projects/tools-platform/README.md": {
      projectType: "tools-platform",
      featured: false,
      weight: 84,
      projectStage: "planned",
      priority: 80
    },
    "projects/medication-tracker/README.md": {
      projectType: "healthcare-tool",
      featured: false,
      weight: 82,
      projectStage: "planned",
      priority: 76
    },
    "projects/wuxia-schedule-roguelite/README.md": {
      projectType: "indie-game",
      featured: false,
      weight: 80,
      projectStage: "planned",
      priority: 72
    },
    "projects/pixel-character-generator/README.md": {
      projectType: "ai-creative-tool",
      featured: false,
      weight: 78,
      projectStage: "planned",
      priority: 70
    }
  } as Record<string, ArticleMetaOverride>,
  overridesByCode: {
    // Backward-compatible hook for rare custom slugs/codes if needed later.
  } as Record<string, ArticleMetaOverride>
};

export type ArticleMetaConfig = typeof articleMetaConfig;
export default articleMetaConfig;

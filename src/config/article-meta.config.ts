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
      cover: "/covers/projects/video-ai-monitor.svg",
      projectType: "business-ai-monitor",
      featured: true,
      weight: 120,
      projectStage: "planned",
      priority: 100
    },
    "projects/smart-clipboard/README.md": {
      cover: "/covers/projects/smart-clipboard.svg",
      projectType: "productivity-tool",
      featured: false,
      weight: 86,
      projectStage: "planned",
      priority: 85
    },
    "projects/tools-platform/README.md": {
      cover: "/covers/projects/tools-platform.svg",
      projectType: "tools-platform",
      featured: false,
      weight: 84,
      projectStage: "planned",
      priority: 80
    },
    "projects/medication-tracker/README.md": {
      cover: "/covers/projects/medication-tracker.svg",
      projectType: "healthcare-tool",
      featured: false,
      weight: 82,
      projectStage: "planned",
      priority: 76
    },
    "projects/wuxia-schedule-roguelite/README.md": {
      cover: "/covers/projects/wuxia-schedule-roguelite.svg",
      projectType: "indie-game",
      featured: false,
      weight: 80,
      projectStage: "planned",
      priority: 72
    },
    "projects/pixel-character-generator/README.md": {
      cover: "/covers/projects/pixel-character-generator.svg",
      projectType: "ai-creative-tool",
      featured: false,
      weight: 78,
      projectStage: "planned",
      priority: 70
    }
  } as Record<string, ArticleMetaOverride>,
  overridesByCode: {
    // USB 单路继电器入门：用 Python 分别控制开和关 (车 / 超跑)
    b2kz8iy4i: {
      cover: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80",
      showCover: true
    },
    // ZLMediaKit 入门：接入视频流、播放与转码 (风景 / 自然山水)
    "zlmediakit-start": {
      cover: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80",
      showCover: true
    },
    // 登录加密从原理到代码：AES-GCM、RSA-OAEP 与 ECDH (美女 / 艺术人像)
    "login-encryption-ecdh-aes-gcm": {
      cover: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1200&q=80",
      showCover: true
    },
    // VPS 部署与迁移：3x-ui 与 Mihomo (游戏 / 霓虹电竞)
    b24f7gc42: {
      cover: "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=80",
      showCover: true,
      summary: "整理 Debian VPS 上 3x-ui（Xray Reality）、Nginx 反代与 Mihomo 订阅的部署、备份、跨机迁移与常见网络排障实战。",
      tags: ["VPS", "Linux", "运维", "网络"]
    },
    // 基于 SeaweedFS 打造高性能本地海量图片存储服务 (科技 / 存储)
    b1z0uwq81: {
      cover: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80",
      showCover: true,
      title: "告别 MinIO：基于 SeaweedFS 打造高性能本地海量图片存储服务",
      summary: "规避 MinIO 开源归档与协议风险，采用专为海量小文件而生的 SeaweedFS，从架构原理、三端部署到 Spring Boot 实战落地。",
      tags: ["SeaweedFS", "对象存储", "Java", "SpringBoot"]
    }
  } as Record<string, ArticleMetaOverride>
};

export type ArticleMetaConfig = typeof articleMetaConfig;
export default articleMetaConfig;

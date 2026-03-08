import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const articleSchema = z.object({
  title: z.string().optional(),
  createTime: z
    .string()
    .regex(/^\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}:\d{2}$/, "createTime must be YYYY/MM/DD HH:mm:ss")
    .optional(),
  code: z.string().optional(),
  permalink: z.string().optional(),
  summary: z.string().optional(),
  description: z.string().optional(),
  outline: z.string().optional(),
  series: z.string().optional(),
  order: z.number().int().optional(),
  tags: z.array(z.string()).optional(),
  cover: z.string().optional(),
  category: z.string().optional(),
  icon: z.string().optional(),
  showOnHome: z.boolean().optional(),
  coverMode: z.enum(["left", "right", "top", "none"]).optional(),
  coverPosition: z.enum(["left", "right", "top", "none"]).optional()
});

const blog = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/blog" }),
  schema: articleSchema
});

const tutorial = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/tutorial" }),
  schema: articleSchema
});

const projects = defineCollection({
  loader: glob({ pattern: "**/README.{md,mdx}", base: "./src/content/projects" }),
  schema: articleSchema
});

const pages = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/pages" }),
  schema: z.object({
    code: z.string(),
    title: z.string(),
    description: z.string().default(""),
    draft: z.boolean().default(false),
    about: z
      .object({
        hero: z
          .object({
            badge: z.string().default(""),
            title: z.string().default(""),
            subtitle: z.string().default(""),
            chips: z.array(z.string()).default([]),
            statLabels: z
              .object({
                completed: z.string().default("已完成项目"),
                planned: z.string().default("规划中项目"),
                topPriority: z.string().default("当前主战场")
              })
              .default({
                completed: "已完成项目",
                planned: "规划中项目",
                topPriority: "当前主战场"
              })
          })
          .default({
            badge: "",
            title: "",
            subtitle: "",
            chips: [],
            statLabels: {
              completed: "已完成项目",
              planned: "规划中项目",
              topPriority: "当前主战场"
            }
          }),
        showcase: z
          .object({
            title: z.string().default(""),
            description: z.string().default(""),
            projectCodes: z.array(z.string()).default([]),
            emptyText: z.string().default(""),
            labels: z
              .object({
                repo: z.string().default("仓库"),
                doc: z.string().default("文档"),
                demo: z.string().default("演示"),
                detail: z.string().default("详情"),
                noDescription: z.string().default("")
              })
              .default({
                repo: "仓库",
                doc: "文档",
                demo: "演示",
                detail: "详情",
                noDescription: ""
              })
          })
          .default({
            title: "",
            description: "",
            projectCodes: [],
            emptyText: "",
            labels: {
              repo: "仓库",
              doc: "文档",
              demo: "演示",
              detail: "详情",
              noDescription: ""
            }
          }),
        gaming: z
          .object({
            title: z.string().default(""),
            description: z.string().default(""),
            groups: z
              .array(
                z.object({
                  name: z.string(),
                  games: z.array(z.string()).default([])
                })
              )
              .default([])
          })
          .default({
            title: "",
            description: "",
            groups: []
          })
      })
      .optional(),
    projects: z
      .object({
        sectionOrder: z.array(z.enum(["completed", "in-progress", "planned"])).default(["completed", "in-progress", "planned"]),
        coverFallback: z
          .object({
            completed: z.string().default(""),
            "in-progress": z.string().default(""),
            planned: z.string().default("")
          })
          .default({
            completed: "",
            "in-progress": "",
            planned: ""
          }),
        highlights: z
          .object({
            title: z.string().default(""),
            subtitle: z.string().default(""),
            topPriorityLabel: z.string().default("")
          })
          .default({
            title: "",
            subtitle: "",
            topPriorityLabel: ""
          }),
        sections: z
          .object({
            completed: z.object({
              title: z.string().default("已完成"),
              description: z.string().default("")
            }),
            "in-progress": z.object({
              title: z.string().default("进行中"),
              description: z.string().default("")
            }),
            planned: z.object({
              title: z.string().default("规划中"),
              description: z.string().default("")
            })
          })
          .default({
            completed: { title: "已完成", description: "" },
            "in-progress": { title: "进行中", description: "" },
            planned: { title: "规划中", description: "" }
          }),
        stats: z
          .object({
            total: z.string().default("项目总数"),
            completed: z.string().default("已完成"),
            planned: z.string().default("规划中")
          })
          .default({
            total: "项目总数",
            completed: "已完成",
            planned: "规划中"
          }),
        labels: z
          .object({
            sectionCountSuffix: z.string().default("项"),
            empty: z.string().default("暂无项目，后续补充。"),
            featured: z.string().default("重点"),
            priorityPrefix: z.string().default("P"),
            publishDate: z.string().default("发布时间"),
            tags: z.string().default("标签"),
            unsetTags: z.string().default("未设置"),
            noDescription: z.string().default(""),
            detail: z.string().default("查看详情"),
            repo: z.string().default("仓库"),
            doc: z.string().default("文档"),
            demo: z.string().default("演示")
          })
          .default({
            sectionCountSuffix: "项",
            empty: "暂无项目，后续补充。",
            featured: "重点",
            priorityPrefix: "P",
            publishDate: "发布时间",
            tags: "标签",
            unsetTags: "未设置",
            noDescription: "",
            detail: "查看详情",
            repo: "仓库",
            doc: "文档",
            demo: "演示"
          })
      })
      .optional()
  })
});

const sites = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/sites" }),
  schema: z.object({
    title: z.string(),
    slug: z.string().optional(),
    description: z.string().default(""),
    url: z.string().url().optional(),
    pubDate: z.coerce.date().default(() => new Date()),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    cover: z.string().default(""),
    featured: z.boolean().default(false),
    weight: z.number().int().default(0),
    order: z.number().int().default(999),
    category: z.string().default("general"),
    type: z.string().default("site"),
    layout: z.enum(["compact", "cards", "plain"]).default("compact"),
    logo: z.string().optional(),
    status: z.enum(["active", "beta", "archived"]).default("active"),
    cards: z
      .array(
        z.object({
          title: z.string(),
          url: z.string().url(),
          desc: z.string().default(""),
          tags: z.array(z.string()).default([]),
          badge: z.string().default(""),
          cover: z.string().default(""),
          icon: z.string().default(""),
          iconFetch: z.boolean().default(true),
          category: z.string().default(""),
          order: z.number().int().default(999),
          pinned: z.boolean().default(false)
        })
      )
      .default([]),
    draft: z.boolean().default(false)
  })
});

const gallery = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/gallery" }),
  schema: z.object({
    title: z.string(),
    description: z.string().default(""),
    pubDate: z.coerce.date().default(() => new Date()),
    photos: z
      .array(
        z.object({
          title: z.string(),
          desc: z.string().default(""),
          src: z.string().url(),
          location: z.string().default(""),
          order: z.number().int().default(999),
          featured: z.boolean().default(false),
          width: z.number().int().positive().optional(),
          height: z.number().int().positive().optional(),
          position: z.string().default("center")
        })
      )
      .default([]),
    draft: z.boolean().default(false)
  })
});

const reading = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/reading" }),
  schema: z.object({
    title: z.string(),
    description: z.string().default(""),
    url: z.string().url().optional(),
    source: z.string().default(""),
    pubDate: z.coerce.date().default(() => new Date()),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    featured: z.boolean().default(false),
    rating: z.number().min(0).max(5).default(0),
    cover: z.string().default(""),
    draft: z.boolean().default(false)
  })
});

export const collections = {
  blog,
  tutorial,
  pages,
  projects,
  sites,
  reading,
  gallery
};

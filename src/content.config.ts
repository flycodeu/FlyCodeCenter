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
  outline: z.string().optional(),
  series: z.string().optional(),
  order: z.number().int().optional(),
  tags: z.array(z.string()).optional(),
  cover: z.string().optional(),
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
  projects,
  sites,
  reading,
  gallery
};

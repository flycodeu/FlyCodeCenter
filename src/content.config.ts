import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const baseSchema = z.object({
  code: z.string().optional(),
  title: z.string(),
  description: z.string().default(""),
  summary: z.string().default(""),
  pubDate: z.coerce.date().default(() => new Date()),
  updatedDate: z.coerce.date().optional(),
  tags: z.array(z.string()).default([]),
  cover: z.string().default(""),
  showCover: z.boolean().default(false),
  draft: z.boolean().default(false),
  encrypted: z.boolean().default(false),
  encryptedFile: z.string().optional(),
  passwordHint: z.string().optional()
});

const blog = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/blog" }),
  schema: baseSchema.extend({
    pinned: z.boolean().default(false),
    pinOrder: z.number().int().nonnegative().default(999)
  })
});

const tutorial = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/tutorial" }),
  schema: baseSchema.extend({
    series: z.string().default("未分类"),
    order: z.number().int().default(1)
  })
});

const projects = defineCollection({
  loader: glob({ pattern: "**/README.{md,mdx}", base: "./src/content/projects" }),
  schema: baseSchema.extend({
    projectType: z.string().default("general"),
    repoUrl: z.string().url().optional(),
    docUrl: z.string().url().optional(),
    demoUrl: z.string().url().optional(),
    featured: z.boolean().default(false),
    weight: z.number().int().default(0)
  })
});

const sites = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/sites" }),
  schema: z.object({
    title: z.string(),
    description: z.string().default(""),
    url: z.string().url().optional(),
    pubDate: z.coerce.date().default(() => new Date()),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    cover: z.string().default(""),
    featured: z.boolean().default(false),
    weight: z.number().int().default(0),
    status: z.enum(["active", "beta", "archived"]).default("active"),
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
  reading
};

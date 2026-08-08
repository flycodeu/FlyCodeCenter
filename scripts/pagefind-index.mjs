import fs from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";

const projectRoot = process.cwd();
const distDir = path.join(projectRoot, "dist");
const distClientDir = path.join(distDir, "client");
const vercelStaticDir = path.join(projectRoot, ".vercel", "output", "static");
const pagefindTempDir = path.join(projectRoot, ".tmp-pagefind-site");

async function exists(dir) {
  try {
    await fs.access(dir);
    return true;
  } catch {
    return false;
  }
}

async function findSiteDir() {
  const candidates = [distClientDir, vercelStaticDir, distDir];
  for (const dir of candidates) {
    if (!(await exists(dir))) continue;
    if (await exists(path.join(dir, "index.html"))) return dir;
  }
  return null;
}

async function collectHtmlFiles(dir, relativeDir = "") {
  const entries = await fs.readdir(path.join(dir, relativeDir), { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectHtmlFiles(dir, relativePath)));
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith(".html")) continue;

    const content = await fs.readFile(path.join(dir, relativePath), "utf8");
    if (/<html(?:\s|>)/i.test(content)) {
      files.push({ relativePath, content });
    }
  }

  return files;
}

async function createPagefindInput(siteDir) {
  const files = await collectHtmlFiles(siteDir);
  await fs.rm(pagefindTempDir, { recursive: true, force: true });
  await fs.mkdir(pagefindTempDir, { recursive: true });

  await Promise.all(
    files.map(async ({ relativePath, content }) => {
      const target = path.join(pagefindTempDir, relativePath);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, content, "utf8");
    })
  );

  return files.length;
}

async function buildPagefind() {
  const siteDir = await findSiteDir();
  if (!siteDir) {
    console.log("[pagefind] site output missing, skip indexing.");
    return;
  }

  try {
    const pageCount = await createPagefindInput(siteDir);
    if (!pageCount) {
      console.log("[pagefind] no complete HTML pages found, skip indexing.");
      return;
    }

    execSync(`npx pagefind --site "${pagefindTempDir}" --output-subdir pagefind`, {
      stdio: "inherit",
      shell: true
    });

    const pagefindOutputDir = path.join(pagefindTempDir, "pagefind");
    if (!(await exists(pagefindOutputDir))) {
      console.log("[pagefind] output index missing, skip copy.");
      return;
    }

    const pagefindClientDir = path.join(distClientDir, "pagefind");
    await fs.rm(pagefindClientDir, { recursive: true, force: true });
    await fs.mkdir(path.dirname(pagefindClientDir), { recursive: true });
    await fs.cp(pagefindOutputDir, pagefindClientDir, { recursive: true });
    console.log(`[pagefind] indexed ${pageCount} complete HTML pages`);
  } finally {
    await fs.rm(pagefindTempDir, { recursive: true, force: true });
  }
}

buildPagefind().catch((error) => {
  console.error(error);
  process.exit(1);
});

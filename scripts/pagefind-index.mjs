import fs from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";

const projectRoot = process.cwd();
const distDir = path.join(projectRoot, "dist");
const distClientDir = path.join(distDir, "client");
const vercelStaticDir = path.join(projectRoot, ".vercel", "output", "static");

async function exists(dir) {
  try {
    await fs.access(dir);
    return true;
  } catch {
    return false;
  }
}

async function findSiteDir() {
  const candidates = [vercelStaticDir, distClientDir, distDir];
  for (const dir of candidates) {
    if (!(await exists(dir))) continue;
    if (await exists(path.join(dir, "index.html"))) return dir;
  }
  return null;
}

async function buildPagefind() {
  const siteDir = await findSiteDir();
  if (!siteDir) {
    console.log("[pagefind] site output missing, skip indexing.");
    return;
  }

  execSync(`npx pagefind --site "${siteDir}" --output-subdir pagefind`, {
    stdio: "inherit",
    shell: true
  });

  const pagefindOutputDir = path.join(siteDir, "pagefind");
  if (!(await exists(pagefindOutputDir))) {
    console.log("[pagefind] output index missing, skip copy.");
    return;
  }

  if (siteDir !== distClientDir && (await exists(distClientDir))) {
    const pagefindClientDir = path.join(distClientDir, "pagefind");
    await fs.rm(pagefindClientDir, { recursive: true, force: true });
    await fs.mkdir(path.dirname(pagefindClientDir), { recursive: true });
    await fs.cp(pagefindOutputDir, pagefindClientDir, { recursive: true });
    console.log("[pagefind] copied index to dist/client/pagefind");
  }
}

buildPagefind().catch((error) => {
  console.error(error);
  process.exit(1);
});

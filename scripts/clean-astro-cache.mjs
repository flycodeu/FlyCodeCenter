import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const devCacheDir = path.join(rootDir, ".astro");
const buildCacheDir = path.join(rootDir, "node_modules", ".astro");
const devViteCacheDir = path.join(rootDir, "node_modules", ".vite-dev");
const buildViteCacheDir = path.join(rootDir, "node_modules", ".vite-build");
const scope = process.argv.includes("--all") ? "all" : process.argv.includes("--dev") ? "dev" : "build";
const cacheDirs =
  scope === "all"
    ? [devCacheDir, buildCacheDir, devViteCacheDir, buildViteCacheDir]
    : scope === "dev"
      ? [devCacheDir, devViteCacheDir]
      : [buildCacheDir];

async function main() {
  await Promise.all(cacheDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })));
  console.log(`[astro:cache] cleaned ${scope} cache`);
}

main().catch((error) => {
  console.error("[astro:cache] failed:", error);
  process.exit(1);
});

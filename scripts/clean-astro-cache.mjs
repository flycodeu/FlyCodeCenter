import fs from "node:fs/promises";
import path from "node:path";

const cacheDirs = [path.join(process.cwd(), ".astro"), path.join(process.cwd(), "node_modules", ".astro")];

async function main() {
  await Promise.all(cacheDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })));
  console.log("[prebuild] cleaned Astro caches");
}

main().catch((error) => {
  console.error("[prebuild] failed:", error);
  process.exit(1);
});

import fs from "node:fs/promises";
import path from "node:path";

const cacheDir = path.join(process.cwd(), ".astro");

async function main() {
  await fs.rm(cacheDir, { recursive: true, force: true });
  console.log("[prebuild] cleaned .astro cache");
}

main().catch((error) => {
  console.error("[prebuild] failed:", error);
  process.exit(1);
});

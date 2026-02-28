import fs from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";

const distDir = path.join(process.cwd(), "dist");

async function exists(dir) {
  try {
    await fs.access(dir);
    return true;
  } catch {
    return false;
  }
}

async function buildPagefind() {
  if (!(await exists(distDir))) {
    console.log("[pagefind] dist directory missing, skip indexing.");
    return;
  }

  execSync("npx pagefind --site dist --output-subdir pagefind", {
    stdio: "inherit",
    shell: true
  });
}

buildPagefind().catch((error) => {
  console.error(error);
  process.exit(1);
});

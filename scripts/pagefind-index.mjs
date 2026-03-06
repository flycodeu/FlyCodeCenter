import fs from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";

const distDir = path.join(process.cwd(), "dist");
const pagefindSourceDir = path.join(distDir, "pagefind");
const pagefindClientDir = path.join(distDir, "client", "pagefind");

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

  if (!(await exists(pagefindSourceDir))) {
    console.log("[pagefind] source index missing, skip copy.");
    return;
  }

  await fs.rm(pagefindClientDir, { recursive: true, force: true });
  await fs.mkdir(path.dirname(pagefindClientDir), { recursive: true });
  await fs.cp(pagefindSourceDir, pagefindClientDir, { recursive: true });
  console.log("[pagefind] copied index to dist/client/pagefind");
}

buildPagefind().catch((error) => {
  console.error(error);
  process.exit(1);
});

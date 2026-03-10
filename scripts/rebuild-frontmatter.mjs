import { runFrontmatterSync } from "./frontmatter-maintenance.mjs";

runFrontmatterSync()
  .then(({ total, changed }) => {
    console.log(`[rebuild:frontmatter] scanned ${total} file(s), updated ${changed} file(s).`);
  })
  .catch((error) => {
    console.error("[rebuild:frontmatter] failed:", error);
    process.exit(1);
  });

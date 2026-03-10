import { runFrontmatterSync } from "./frontmatter-maintenance.mjs";

runFrontmatterSync()
  .then(({ changed }) => {
    console.log(`[sync:articles] updated ${changed} file(s)`);
  })
  .catch((error) => {
    console.error("[sync:articles] failed:", error);
    process.exit(1);
  });

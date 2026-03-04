import fs from "node:fs";
import path from "node:path";
import { fromMarkdown } from "mdast-util-from-markdown";
import { visit } from "unist-util-visit";

interface Options {
  enabled?: boolean;
  root?: string;
}

/**
 * Use fenced code block to include markdown:
 * ```include
 * includes/part.md
 * ```
 */
export function remarkMarkdownInclude(options: Options = {}) {
  const enabled = options.enabled ?? true;
  const root = options.root ?? "./src/content";

  return (tree: any, file: any) => {
    if (!enabled) return;
    visit(tree, "code", (node: any, index: number, parent: any) => {
      if (!parent || node.lang !== "include") return;
      const relativeFile = String(node.value || "").trim();
      if (!relativeFile) return;
      const baseDir = file?.path ? path.dirname(file.path) : process.cwd();
      const resolved = path.resolve(baseDir, relativeFile);
      const fallback = path.resolve(root, relativeFile);
      const includeFile = fs.existsSync(resolved) ? resolved : fallback;
      if (!fs.existsSync(includeFile)) return;

      const raw = fs.readFileSync(includeFile, "utf8");
      const parsed = fromMarkdown(raw);
      parent.children.splice(index, 1, ...parsed.children);
    });
  };
}

import { visit } from "unist-util-visit";

function normalizeClassList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }
  if (typeof raw === "string") {
    return raw
      .split(/\s+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function hasClass(node: any, className: string): boolean {
  if (!node || node.type !== "element") return false;
  return normalizeClassList(node.properties?.className).includes(className);
}

export function rehypeTableEnhance() {
  return (tree: any) => {
    visit(tree, "element", (node: any, index: number, parent: any) => {
      if (!parent || typeof index !== "number") return;
      if (node.tagName !== "table") return;
      if (parent.tagName === "div" && hasClass(parent, "article-table-scroll")) return;

      parent.children.splice(index, 1, {
        type: "element",
        tagName: "div",
        properties: {
          className: ["article-table-scroll"]
        },
        children: [node]
      });
    });
  };
}

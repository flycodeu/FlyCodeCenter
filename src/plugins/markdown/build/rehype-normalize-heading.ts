import { visit } from "unist-util-visit";

interface ElementNode {
  type: "element";
  tagName: string;
}

/**
 * Reader layouts already render the document title as the single page-level H1.
 * Normalize author-supplied Markdown H1 nodes so legacy content cannot create
 * duplicate page headings or an invalid document outline.
 */
export function rehypeNormalizeHeading() {
  return (tree: unknown) => {
    visit(tree as any, "element", (node: ElementNode) => {
      if (node.tagName === "h1") node.tagName = "h2";
    });
  };
}

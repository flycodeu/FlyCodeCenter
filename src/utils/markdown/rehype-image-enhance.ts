import { visit } from "unist-util-visit";

interface ImageOptions {
  enableFigure?: boolean;
  lazyload?: boolean;
  enableMark?: boolean;
  enableSize?: boolean;
}

function toClassList(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String);
  return [String(value)];
}

export function rehypeImageEnhance(options: ImageOptions = {}) {
  const {
    enableFigure = true,
    lazyload = true,
    enableMark = true,
    enableSize = true
  } = options;

  return (tree: any) => {
    visit(tree, "element", (node: any, index: number, parent: any) => {
      if (!parent || typeof index !== "number") return;
      if (node.tagName !== "img") return;

      node.properties ??= {};
      if (lazyload) {
        node.properties.loading = "lazy";
        node.properties.decoding = "async";
      }

      const rawAlt = String(node.properties.alt ?? "");
      const chunks = rawAlt.split("|").map((item) => item.trim()).filter(Boolean);
      const caption = chunks[0] ?? "";
      const args = chunks.slice(1);

      for (const token of args) {
        const [key, value] = token.split("=").map((item) => item.trim());
        if (!value) continue;
        if (enableSize && (key === "w" || key === "width")) node.properties.width = value;
        if (enableSize && (key === "h" || key === "height")) node.properties.height = value;
        if (enableMark && key === "mark") {
          const cls = toClassList(node.properties.className);
          cls.push(`img-mark-${value}`);
          node.properties.className = cls;
        }
      }

      node.properties.alt = caption;
      if (!enableFigure || parent.tagName === "figure") return;

      const figure: any = {
        type: "element",
        tagName: "figure",
        properties: { className: ["md-figure"] },
        children: [node]
      };
      if (caption) {
        figure.children.push({
          type: "element",
          tagName: "figcaption",
          properties: {},
          children: [{ type: "text", value: caption }]
        });
      }
      parent.children.splice(index, 1, figure);
    });
  };
}

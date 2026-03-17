const IGNORED_TAGS = new Set(["code", "pre", "script", "style", "textarea"]);
const LOOSE_INLINE_MARKDOWN = /(\*\*|__|~~)([^\n]+?)\1/g;

type HastNode = {
  type?: string;
  tagName?: string;
  value?: string;
  children?: HastNode[];
};

function isNode(value: unknown): value is HastNode {
  return Boolean(value && typeof value === "object");
}

function createText(value: string): HastNode {
  return { type: "text", value };
}

function createElement(tagName: string, children: HastNode[]): HastNode {
  return {
    type: "element",
    tagName,
    properties: {},
    children
  } as HastNode;
}

function getTrailingDelimiter(value: string): { delimiter: "**" | "__" | "~~"; prefix: string } | null {
  for (const delimiter of ["**", "__", "~~"] as const) {
    if (!value.endsWith(delimiter)) continue;
    return {
      delimiter,
      prefix: value.slice(0, -delimiter.length)
    };
  }
  return null;
}

function repairLooseInlineMarkdown(value: string, depth = 0): HastNode[] | null {
  if (!value || depth > 4 || !/(\*\*|__|~~)/.test(value)) return null;

  const result: HastNode[] = [];
  let lastIndex = 0;
  let changed = false;
  LOOSE_INLINE_MARKDOWN.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = LOOSE_INLINE_MARKDOWN.exec(value)) !== null) {
    const [rawToken, delimiter, innerRaw] = match;
    const start = match.index;
    if (!rawToken || !delimiter || !innerRaw) continue;
    if (start > 0 && value[start - 1] === "\\") continue;

    const delimiterChar = delimiter[0] || "";
    if ((delimiterChar && innerRaw.startsWith(delimiterChar)) || (delimiterChar && innerRaw.endsWith(delimiterChar))) continue;
    if (!innerRaw.trim()) continue;

    if (start > lastIndex) {
      result.push(createText(value.slice(lastIndex, start)));
    }

    const children = repairLooseInlineMarkdown(innerRaw, depth + 1) ?? [createText(innerRaw)];
    result.push(createElement(delimiter === "~~" ? "del" : "strong", children));

    lastIndex = start + rawToken.length;
    changed = true;
  }

  if (!changed) return null;
  if (lastIndex < value.length) {
    result.push(createText(value.slice(lastIndex)));
  }
  return result;
}

function repairDelimitedRuns(parent: HastNode) {
  if (!Array.isArray(parent.children)) return;

  for (let i = 0; i < parent.children.length; i += 1) {
    const start = parent.children[i];
    if (!isNode(start) || start.type !== "text" || typeof start.value !== "string") continue;

    const open = getTrailingDelimiter(start.value);
    if (!open) continue;

    for (let cursor = i + 1; cursor < parent.children.length; cursor += 1) {
      const current = parent.children[cursor];
      if (!isNode(current)) continue;

      if (current.type === "element" && IGNORED_TAGS.has(String(current.tagName || "").toLowerCase())) break;
      if (current.type !== "text" || typeof current.value !== "string") continue;
      if (!current.value.startsWith(open.delimiter)) continue;

      const wrappedChildren = parent.children.slice(i + 1, cursor);
      if (!wrappedChildren.length) break;

      const replacement: HastNode[] = [];
      if (open.prefix) replacement.push(createText(open.prefix));

      const wrapper = createElement(open.delimiter === "~~" ? "del" : "strong", wrappedChildren);
      transformInlineTextNodes(wrapper, false);
      replacement.push(wrapper);

      const suffix = current.value.slice(open.delimiter.length);
      if (suffix) replacement.push(createText(suffix));

      parent.children.splice(i, cursor - i + 1, ...replacement);
      i += replacement.length - 1;
      break;
    }
  }
}

function transformInlineTextNodes(parent: HastNode, ignored = false) {
  if (!Array.isArray(parent.children) || ignored) return;

  for (let i = 0; i < parent.children.length; i += 1) {
    const node = parent.children[i];
    if (!isNode(node)) continue;

    if (node.type === "text" && typeof node.value === "string") {
      const replacement = repairLooseInlineMarkdown(node.value);
      if (replacement) {
        parent.children.splice(i, 1, ...replacement);
        i += replacement.length - 1;
      }
      continue;
    }

    if (node.type !== "element") continue;
    if (IGNORED_TAGS.has(String(node.tagName || "").toLowerCase())) continue;
    transformInlineTextNodes(node, false);
  }

  repairDelimitedRuns(parent);
}

export function rehypeInlineMarkdownRepair() {
  return (tree: unknown) => {
    if (!isNode(tree)) return;
    transformInlineTextNodes(tree, false);
  };
}

interface ExtendedBuildOptions {
  enableChartJs?: boolean;
  enableTabs?: boolean;
  enableSteps?: boolean;
  enableMark?: boolean;
  enableIcon?: boolean;
  chartHeight?: number;
}

const START_CHART = /^:::\s*chartjs(?:\s+(.+))?\s*$/i;
const START_CHART_LOOSE = /^:::\s*chartjs\b/i;
const START_TABS = /^:::\s*tabs\s*$/i;
const START_TABS_LOOSE = /^:::\s*tabs\b/i;
const END_TRIPLE = /^:::\s*$/i;
const START_STEPS = /^::::\s*steps\s*$/i;
const START_STEPS_LOOSE = /^::::\s*steps\b/i;
const END_QUAD = /^::::\s*$/i;
const TAB_LABEL = /^@tab\s+(.+)$/i;
const INLINE_TOKEN = /==([^=\n][\s\S]*?)==\{\.(tip|warning|danger|important)\}|:\[([^\]]+)\]:/g;

type MdNode = {
  type?: string;
  children?: unknown[];
  value?: string;
  data?: Record<string, unknown>;
};

function isNode(value: unknown): value is MdNode {
  return Boolean(value && typeof value === "object");
}

function normalizeLine(input: string): string {
  return String(input || "")
    .replace(/\u00a0/g, " ")
    .replace(/[\u200b\u200c\u200d\ufeff]/g, "")
    .trim();
}

function getParagraphText(node: unknown): string {
  if (!isNode(node) || node.type !== "paragraph" || !Array.isArray(node.children)) return "";
  return node.children
    .map((child) => {
      if (!isNode(child)) return "";
      if (child.type === "break") return "\n";
      if (typeof child.value === "string" && (child.type === "text" || child.type === "inlineCode")) return child.value;
      return "";
    })
    .join("");
}

function getParagraphLines(node: unknown): string[] {
  const raw = getParagraphText(node);
  if (!raw) return [];
  return raw.split(/\r?\n/).map(normalizeLine);
}

function findLineIndex(lines: string[], tester: RegExp): number {
  for (let i = 0; i < lines.length; i += 1) {
    if (tester.test(lines[i] || "")) return i;
  }
  return -1;
}

function createParagraph(value: string) {
  return {
    type: "paragraph",
    children: [createText(value)]
  };
}

function sanitizeProps(input: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  Object.entries(input).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value) && value.length === 0) return;
    next[key] = value;
  });
  return next;
}

function createElement(tag: string, props: Record<string, unknown> = {}, children: unknown[] = []) {
  return {
    type: "extendedElement",
    data: {
      hName: tag,
      hProperties: sanitizeProps(props)
    },
    children
  };
}

function createText(value: string) {
  return { type: "text", value };
}

function addClass(node: { data?: Record<string, unknown> }, className: string) {
  node.data ||= {};
  const rawProps = (node.data.hProperties as Record<string, unknown> | undefined) ?? {};
  const rawClass = rawProps.className;
  const list = Array.isArray(rawClass)
    ? rawClass.filter((item) => typeof item === "string")
    : typeof rawClass === "string"
      ? [rawClass]
      : [];
  if (!list.includes(className)) list.push(className);
  node.data.hProperties = { ...rawProps, className: list };
}

function stripTrailingFenceFromList(listNode: { children?: unknown[] }) {
  if (!Array.isArray(listNode.children) || listNode.children.length === 0) return;
  const lastItem = listNode.children[listNode.children.length - 1];
  if (!isNode(lastItem) || !Array.isArray(lastItem.children)) return;

  for (let i = lastItem.children.length - 1; i >= 0; i -= 1) {
    const child = lastItem.children[i];
    if (!isNode(child) || child.type !== "paragraph") continue;
    const raw = getParagraphText(child);
    if (!raw) continue;

    const stripped = raw.replace(/(?:\r?\n)?\s*:{4}\s*$/m, "").trimEnd();
    if (stripped === raw.trimEnd()) continue;

    if (!stripped.trim()) {
      lastItem.children.splice(i, 1);
    } else {
      child.children = [createText(stripped)];
    }
    break;
  }
}

function parseIconSpec(rawInput: string) {
  const raw = String(rawInput || "").trim();
  if (!raw) return null;
  const [iconName, ...restParts] = raw.split(/\s+/);
  if (!/^[a-z0-9-]+:[a-z0-9-]+$/i.test(iconName)) return null;

  const rest = restParts.join(" ").trim();
  let size = "";
  let color = "";

  if (rest) {
    if (rest.includes("/")) {
      const [sizePart, colorPart] = rest.split("/");
      size = String(sizePart || "").trim();
      color = String(colorPart || "").trim();
    } else if (rest.startsWith("/")) {
      color = rest.slice(1).trim();
    } else {
      size = rest;
    }
  }

  if (size && !/^\d{1,3}px$/i.test(size)) size = "";
  if (color && !/^#([0-9a-f]{3,8})$/i.test(color) && !/^[a-z]{3,20}$/i.test(color)) color = "";

  return { iconName, size, color };
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function transformInlineText(value: string, options: ExtendedBuildOptions): Array<{ type: string; value: string }> | null {
  if (!value || (!options.enableMark && !options.enableIcon)) return null;
  let match: RegExpExecArray | null;
  let last = 0;
  let changed = false;
  const result: Array<{ type: string; value: string }> = [];
  INLINE_TOKEN.lastIndex = 0;

  while ((match = INLINE_TOKEN.exec(value)) !== null) {
    if (match.index > last) {
      result.push({ type: "text", value: value.slice(last, match.index) });
    }

    const rawToken = match[0];
    if (match[1]) {
      if (options.enableMark) {
        const markType = match[2];
        result.push({
          type: "html",
          value: `<mark class="md-mark md-mark-${markType}">${escapeHtml(match[1])}</mark>`
        });
        changed = true;
      } else {
        result.push({ type: "text", value: rawToken });
      }
    } else if (match[3]) {
      const icon = parseIconSpec(match[3]);
      if (icon && options.enableIcon) {
        const styleParts: string[] = [];
        if (icon.size) styleParts.push(`font-size:${icon.size}`);
        if (icon.color) styleParts.push(`color:${icon.color}`);
        const styleAttr = styleParts.length ? ` style="${escapeHtml(styleParts.join(";"))}"` : "";
        result.push({
          type: "html",
          value: `<iconify-icon class="md-inline-icon" icon="${escapeHtml(icon.iconName)}"${styleAttr}></iconify-icon>`
        });
        changed = true;
      } else {
        result.push({ type: "text", value: rawToken });
      }
    } else {
      result.push({ type: "text", value: rawToken });
    }

    last = match.index + rawToken.length;
  }

  if (!changed) return null;
  if (last < value.length) {
    result.push({ type: "text", value: value.slice(last) });
  }
  return result;
}

function transformInlineNodes(parent: { children?: unknown[] }, options: ExtendedBuildOptions) {
  if (!Array.isArray(parent.children)) return;
  for (let i = 0; i < parent.children.length; i += 1) {
    const node = parent.children[i];
    if (!isNode(node)) continue;
    if (node.type === "text" && typeof node.value === "string") {
      const replacement = transformInlineText(node.value, options);
      if (replacement) {
        parent.children.splice(i, 1, ...replacement);
        i += replacement.length - 1;
        continue;
      }
    }
    if (node.type === "code" || node.type === "inlineCode" || node.type === "html") continue;
    if (Array.isArray(node.children)) {
      transformInlineNodes(node as { children?: unknown[] }, options);
    }
  }
}

function processContainerBlocks(parent: { children?: unknown[] }, options: ExtendedBuildOptions, state: { tabSeed: number }) {
  if (!Array.isArray(parent.children)) return;
  const children = parent.children;
  const enableSteps = options.enableSteps !== false;
  const enableTabs = options.enableTabs !== false;
  const enableChartJs = options.enableChartJs !== false;

  for (let i = 0; i < children.length; i += 1) {
    const current = children[i];
    if (!isNode(current)) continue;
    const lines = getParagraphLines(current).filter(Boolean);
    const firstLine = lines[0] ?? "";

    if (enableSteps && (START_STEPS.test(firstLine) || START_STEPS_LOOSE.test(firstLine))) {
      const listNode = children[i + 1];
      if (isNode(listNode) && listNode.type === "list") {
        addClass(listNode, "md-steps");
        if (Array.isArray(listNode.children)) {
          listNode.children.forEach((item) => {
            if (isNode(item) && item.type === "listItem") addClass(item, "md-step-item");
          });
        }
        stripTrailingFenceFromList(listNode as { children?: unknown[] });

        let closeIndex = -1;
        for (let cursor = i + 2; cursor < children.length; cursor += 1) {
          const closeLines = getParagraphLines(children[cursor]);
          if (closeLines.some((line) => END_QUAD.test(line))) {
            closeIndex = cursor;
            break;
          }
        }

        if (closeIndex >= 0) {
          children.splice(closeIndex, 1);
        }
        children.splice(i, 1);
        i -= 1;
        continue;
      }
    }

    if (enableChartJs) {
      const chartStartIndex = findLineIndex(lines, START_CHART_LOOSE);
      if (chartStartIndex >= 0) {
        const startLine = lines[chartStartIndex] || "";
        const chartMatch = startLine.match(START_CHART);

        let closeIndex = -1;
        for (let cursor = i + 1; cursor < children.length; cursor += 1) {
          const closeLines = getParagraphLines(children[cursor]);
          if (closeLines.some((line) => END_TRIPLE.test(line))) {
            closeIndex = cursor;
            break;
          }
        }

        if (closeIndex > i + 1) {
          const leadingNodes = lines
            .slice(chartStartIndex + 1)
            .filter(Boolean)
            .map((line) => createParagraph(line));
          const between = [...leadingNodes, ...children.slice(i + 1, closeIndex)];
          const codeIndex = between.findIndex((node) => isNode(node) && node.type === "code");
          if (codeIndex >= 0) {
            const codeNode = between[codeIndex] as { value?: string };
            const chartConfig = String(codeNode.value || "").trim();
            if (chartConfig) {
              const notes = between.filter((_, idx) => idx !== codeIndex);
              const sectionChildren: unknown[] = [];
              const title = (chartMatch?.[1] || "").trim();
              if (title) {
                sectionChildren.push(createElement("header", { className: ["md-chartjs-head"] }, [createText(title)]));
              }
              sectionChildren.push(
                createElement("div", { className: ["md-chartjs-host"] }, [
                  createElement("canvas", { className: ["md-chartjs-canvas"], height: Number(options.chartHeight || 320) }, [])
                ])
              );
              if (notes.length) {
                sectionChildren.push(createElement("div", { className: ["md-chartjs-note"] }, notes));
              }
              const chartNode = createElement(
                "section",
                { className: ["md-chartjs"], "data-chartjs-config": chartConfig },
                sectionChildren
              );
              children.splice(i, closeIndex - i + 1, chartNode);
              i -= 1;
              continue;
            }
          }
        }
      }
    }

    if (enableTabs) {
      const tabsStartIndex = findLineIndex(lines, START_TABS_LOOSE);
      if (tabsStartIndex >= 0 && (START_TABS.test(lines[tabsStartIndex] || "") || START_TABS_LOOSE.test(lines[tabsStartIndex] || ""))) {
        let closeIndex = -1;
        for (let cursor = i + 1; cursor < children.length; cursor += 1) {
          const closeLines = getParagraphLines(children[cursor]);
          if (closeLines.some((line) => END_TRIPLE.test(line))) {
            closeIndex = cursor;
            break;
          }
        }

        if (closeIndex > i + 1) {
          const leadingNodes = lines
            .slice(tabsStartIndex + 1)
            .filter(Boolean)
            .map((line) => createParagraph(line));
          const between = [...leadingNodes, ...children.slice(i + 1, closeIndex)];
          const groups: Array<{ label: string; nodes: unknown[] }> = [];
          let currentGroup: { label: string; nodes: unknown[] } | null = null;

          const startTabGroup = (label: string) => {
            currentGroup = { label: label.trim(), nodes: [] };
            groups.push(currentGroup);
          };

          const appendTabNode = (node: unknown) => {
            if (!currentGroup) return;
            currentGroup.nodes.push(node);
          };

          between.forEach((node) => {
            if (isNode(node) && node.type === "paragraph") {
              const paraLines = getParagraphLines(node).filter(Boolean);
              if (!paraLines.length) return;
              if (paraLines.length === 1) {
                const labelMatch = paraLines[0]?.match(TAB_LABEL);
                if (labelMatch) {
                  startTabGroup(labelMatch[1]);
                  return;
                }
                appendTabNode(node);
                return;
              }
              paraLines.forEach((line) => {
                const labelMatch = line.match(TAB_LABEL);
                if (labelMatch) {
                  startTabGroup(labelMatch[1]);
                  return;
                }
                appendTabNode(createParagraph(line));
              });
              return;
            }
            appendTabNode(node);
          });

          if (groups.length > 0) {
            state.tabSeed += 1;
            const groupSeed = state.tabSeed;
            const navChildren: unknown[] = [];
            const panelChildren: unknown[] = [];

            groups.forEach((group, idx) => {
              const isActive = idx === 0;
              const tabId = `md-tab-${groupSeed}-${idx + 1}`;
              const panelId = `${tabId}-panel`;
              navChildren.push(
                createElement(
                  "button",
                  {
                    type: "button",
                    className: ["md-tabs-tab"],
                    id: tabId,
                    role: "tab",
                    "data-tab-id": tabId,
                    "data-active": isActive ? "1" : "0",
                    "aria-controls": panelId,
                    "aria-selected": isActive ? "true" : "false"
                  },
                  [createText(group.label)]
                )
              );

              panelChildren.push(
                createElement(
                  "section",
                  {
                    className: ["md-tabs-panel"],
                    id: panelId,
                    role: "tabpanel",
                    "aria-labelledby": tabId,
                    "data-active": isActive ? "1" : "0",
                    hidden: isActive ? undefined : true
                  },
                  group.nodes
                )
              );
            });

            const tabsNode = createElement("section", { className: ["md-tabs"] }, [
              createElement("div", { className: ["md-tabs-nav"], role: "tablist" }, navChildren),
              createElement("div", { className: ["md-tabs-panels"] }, panelChildren)
            ]);
            children.splice(i, closeIndex - i + 1, tabsNode);
            i -= 1;
            continue;
          }
        }
      }
    }

    if (Array.isArray(current.children)) {
      processContainerBlocks(current as { children?: unknown[] }, options, state);
    }
  }
}

export function remarkExtendedBuild(options: ExtendedBuildOptions = {}) {
  return (tree: unknown) => {
    if (!isNode(tree)) return;
    const state = { tabSeed: 0 };
    processContainerBlocks(tree as { children?: unknown[] }, options, state);
    transformInlineNodes(tree as { children?: unknown[] }, options);
  };
}
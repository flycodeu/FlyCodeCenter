import { visit } from "unist-util-visit";

const LANG_ALIASES: Record<string, string> = {
  javascript: "javascript",
  js: "javascript",
  typescript: "ts",
  tsx: "tsx",
  jsx: "jsx",
  c: "c",
  "c++": "cpp",
  cpp: "cpp",
  cxx: "cpp",
  "c#": "csharp",
  cs: "csharp",
  csharp: "csharp",
  java: "java",
  kotlin: "kotlin",
  kt: "kotlin",
  kts: "kotlin",
  groovy: "groovy",
  python: "python",
  py: "python",
  golang: "go",
  sql: "sql",
  json: "json",
  json5: "json5",
  jsonc: "jsonc",
  yml: "yaml",
  ym: "yaml",
  yaml: "yaml",
  toml: "toml",
  ini: "ini",
  properties: "properties",
  env: "dotenv",
  dotenv: "dotenv",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  bashrc: "bash",
  fish: "bash",
  powershell: "powershell",
  ps1: "powershell",
  ps: "powershell",
  pwsh: "powershell",
  bat: "powershell",
  cmd: "powershell",
  curl: "bash",
  console: "bash",
  http: "http",
  diff: "diff",
  docker: "dockerfile",
  dockerfile: "dockerfile",
  nginx: "nginx",
  make: "makefile",
  makefile: "makefile",
  mk: "makefile",
  htm: "html",
  md: "markdown",
  markdown: "markdown",
  mermaid: "mermaid",
  chart: "chart",
  echarts: "chart",
  drawio: "drawio",
  vue: "html",
  vue3: "html",
  gitignore: "txt",
  conf: "txt",
  config: "txt",
  mf: "txt",
  ja: "java",
  code: "txt",
  snippet: "txt",
  plain: "txt",
  plaintext: "txt",
  text: "txt"
};

const SUPPORTED_LANGS = new Set([
  "ts",
  "tsx",
  "jsx",
  "javascript",
  "c",
  "cpp",
  "csharp",
  "java",
  "kotlin",
  "groovy",
  "python",
  "go",
  "sql",
  "json",
  "json5",
  "jsonc",
  "yaml",
  "toml",
  "ini",
  "properties",
  "dotenv",
  "bash",
  "powershell",
  "http",
  "diff",
  "dockerfile",
  "nginx",
  "makefile",
  "html",
  "xml",
  "markdown",
  "mermaid",
  "chart",
  "drawio",
  "txt",
  "plaintext",
  "log"
]);

function normalizeLang(rawLang: string): string {
  const token = rawLang.trim().split(/\s+/)[0] ?? "";
  const primary = token
    .toLowerCase()
    .replace(/^[`"'([{<]+/, "")
    .replace(/[;:,.`"')\]}>]+$/, "")
    .trim();
  if (!primary) return "txt";
  const normalized = LANG_ALIASES[primary] ?? primary;
  if (SUPPORTED_LANGS.has(normalized)) return normalized;
  return "txt";
}

export function remarkNormalizeCodeLang() {
  return (tree: unknown) => {
    visit(tree, "code", (node: { lang?: string }) => {
      if (!node.lang || !node.lang.trim()) {
        node.lang = "txt";
        return;
      }
      node.lang = normalizeLang(node.lang);
    });
  };
}

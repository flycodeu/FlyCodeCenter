import { visit } from "unist-util-visit";

const LANG_ALIASES: Record<string, string> = {
  javascript: "javascript",
  js: "javascript",
  typescript: "ts",
  tsx: "tsx",
  jsx: "jsx",
  java: "java",
  sql: "sql",
  yml: "yaml",
  ym: "yaml",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  powershell: "bash",
  ps1: "bash",
  curl: "bash",
  htm: "html",
  gitignore: "txt",
  conf: "txt",
  mf: "txt",
  ja: "java",
  code: "txt",
  snippet: "txt",
  plaintext: "txt",
  text: "txt"
};

function normalizeLang(rawLang: string): string {
  const token = rawLang.trim().split(/\s+/)[0] ?? "";
  const primary = token
    .toLowerCase()
    .replace(/^[`"'([{<]+/, "")
    .replace(/[;:,.`"')\]}>]+$/, "")
    .trim();
  if (!primary) return "txt";
  return LANG_ALIASES[primary] ?? primary;
}

export function remarkNormalizeCodeLang() {
  return (tree: unknown) => {
    visit(tree, "code", (node: { lang?: string }) => {
      if (!node.lang) return;
      node.lang = normalizeLang(node.lang);
    });
  };
}

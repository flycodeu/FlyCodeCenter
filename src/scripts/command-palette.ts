import { createSearchEngine } from "../providers/search/index";
import type { SearchEngine } from "../providers/search/types";

declare global {
  interface Window {
    __flyCommandPaletteCleanup?: () => void;
  }
}

interface PaletteItem {
  id: string;
  group: string;
  title: string;
  description: string;
  href?: string;
  action?: () => void;
}

const RECENT_KEY = "flycode-recent-pages";
const THEME_KEY = "flycode-theme";
const THEME_EXPLICIT_KEY = "flycode-theme-explicit";

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalize(text: string): string {
  return String(text || "").trim().toLowerCase();
}

function stripMarkup(input: string): string {
  return input.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function isTypingContext(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return true;
  if (target.isContentEditable) return true;
  return Boolean(target.closest("[contenteditable='true'], input, textarea"));
}

function readRecentPages(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => typeof item === "string" && item.startsWith("/")).slice(0, 10);
  } catch {
    return [];
  }
}

function writeRecentPages(items: string[]) {
  localStorage.setItem(RECENT_KEY, JSON.stringify(items.slice(0, 10)));
}

function recordCurrentPage() {
  const current = `${window.location.pathname}${window.location.search}`;
  if (!current.startsWith("/")) return;
  const next = [current, ...readRecentPages().filter((item) => item !== current)];
  writeRecentPages(next);
}

function setupCommandPalette() {
  const root = document.getElementById("command-root");
  const dialog = document.getElementById("command-palette");
  const input = document.getElementById("command-input");
  const resultList = document.getElementById("command-results");

  if (!(root instanceof HTMLElement)) return () => {};
  if (!(dialog instanceof HTMLDialogElement)) return () => {};
  if (!(input instanceof HTMLInputElement)) return () => {};
  if (!(resultList instanceof HTMLElement)) return () => {};

  const controller = new AbortController();
  const { signal } = controller;
  const themes = JSON.parse(root.dataset.themes || "[]") as string[];
  const allowedThemes = Array.isArray(themes)
    ? themes.filter((item) => typeof item === "string" && item.trim())
    : [];
  const fallbackTheme = document.documentElement.dataset.defaultTheme || allowedThemes[0] || "plume";
  const normalizeTheme = (value: unknown) => {
    const theme = String(value || "").trim();
    if (allowedThemes.includes(theme)) return theme;
    if (allowedThemes.includes(fallbackTheme)) return fallbackTheme;
    return allowedThemes[0] || "plume";
  };

  recordCurrentPage();

  let searchEngine: SearchEngine | null = null;
  let focusedIndex = -1;
  let visibleItems: PaletteItem[] = [];
  let sequence = 0;
  let debounceTimer = 0;

  const setTheme = (theme: string) => {
    const name = normalizeTheme(theme);
    document.documentElement.dataset.theme = name;
    localStorage.setItem(THEME_KEY, name);
    localStorage.setItem(THEME_EXPLICIT_KEY, "1");
    window.dispatchEvent(new CustomEvent("site:theme-change", { detail: name }));
  };

  const ensureSearchEngine = async () => {
    if (!searchEngine) {
      searchEngine = await createSearchEngine();
    }
    return searchEngine;
  };

  const getBaseItems = (): PaletteItem[] => {
    const pages: PaletteItem[] = [
      { id: "go-home", group: "快速跳转", title: "首页", description: "回到站点首页", href: "/" },
      { id: "go-blog", group: "快速跳转", title: "博客", description: "浏览博客文章列表", href: "/blog" },
      { id: "go-tutorials", group: "快速跳转", title: "教程", description: "查看教程总览", href: "/tutorials" },
      { id: "go-sites", group: "快速跳转", title: "收藏", description: "按分类查看网站卡片", href: "/sites" },
      { id: "go-reading", group: "快速跳转", title: "优秀文章", description: "筛选高质量外部文章", href: "/reading" },
      { id: "go-tags", group: "快速跳转", title: "标签中心", description: "按标签筛选文章", href: "/tags" }
    ];

    const actions: PaletteItem[] = [
      {
        id: "open-search",
        group: "常用命令",
        title: "打开搜索面板",
        description: "调用站内全文搜索",
        action: () => window.dispatchEvent(new CustomEvent("site:open-search"))
      },
      {
        id: "open-ai",
        group: "常用命令",
        title: "打开 AI 助手",
        description: "进入 AI 聊天与摘要面板",
        action: () => window.dispatchEvent(new CustomEvent("site:open-ai"))
      }
    ];

    const themeItems: PaletteItem[] = allowedThemes.map((theme) => ({
      id: `theme-${theme}`,
      group: "主题切换",
      title: `切换为 ${theme} 主题`,
      description: "应用并保存当前主题",
      action: () => setTheme(theme)
    }));

    const recentItems = readRecentPages()
      .filter((href) => href !== window.location.pathname)
      .slice(0, 5)
      .map((href, index) => ({
        id: `recent-${index}`,
        group: "最近访问",
        title: href === "/" ? "首页" : href,
        description: "最近访问页面",
        href
      }));

    return [...actions, ...pages, ...themeItems, ...recentItems];
  };

  const renderItems = (items: PaletteItem[], emptyText: string) => {
    visibleItems = items;
    if (!items.length) {
      resultList.innerHTML = `<li class="command-empty">${escapeHtml(emptyText)}</li>`;
      focusedIndex = -1;
      return;
    }

    if (focusedIndex >= items.length) {
      focusedIndex = items.length - 1;
    }
    if (focusedIndex < 0) {
      focusedIndex = 0;
    }

    let lastGroup = "";
    const html: string[] = [];
    items.forEach((item, index) => {
      if (item.group !== lastGroup) {
        lastGroup = item.group;
        html.push(`<li class="command-group">${escapeHtml(item.group)}</li>`);
      }
      const activeClass = index === focusedIndex ? "command-item active" : "command-item";
      html.push(`
        <li class="${activeClass}" data-index="${index}">
          <button type="button">
            <h4>${escapeHtml(item.title)}</h4>
            <p>${escapeHtml(item.description)}</p>
          </button>
        </li>
      `);
    });
    resultList.innerHTML = html.join("");
  };

  const runQuery = async () => {
    const rawQuery = input.value.trim();
    const query = normalize(rawQuery);
    const baseItems = getBaseItems();

    if (!query) {
      renderItems(baseItems, "暂无可执行命令");
      return;
    }

    const localItems = baseItems.filter((item) => {
      const bag = normalize(`${item.title} ${item.description}`);
      return bag.includes(query);
    });

    const runId = ++sequence;
    let searchItems: PaletteItem[] = [];
    try {
      const engine = await ensureSearchEngine();
      const results = await engine.search(rawQuery);
      if (runId !== sequence) return;
      searchItems = results.slice(0, 6).map((result, index) => ({
        id: `search-${index}`,
        group: "站内搜索",
        title: result.title,
        description: stripMarkup(result.snippet) || "打开搜索结果",
        href: result.url
      }));
    } catch {
      searchItems = [];
    }

    const dedup = new Set<string>();
    const merged = [...localItems, ...searchItems].filter((item) => {
      const key = item.href ? `${item.title}|${item.href}` : item.title;
      if (dedup.has(key)) return false;
      dedup.add(key);
      return true;
    });

    renderItems(merged, "没有匹配到命令或搜索结果");
  };

  const open = () => {
    if (!dialog.open) {
      try {
        dialog.showModal();
      } catch {
        return;
      }
    }
    focusedIndex = -1;
    input.value = "";
    runQuery().catch(console.error);
    window.requestAnimationFrame(() => input.focus());
  };

  const close = () => {
    if (dialog.open) dialog.close();
  };

  const executeItem = (item: PaletteItem | undefined) => {
    if (!item) return;
    close();
    if (item.action) {
      item.action();
      return;
    }
    if (item.href) {
      window.location.href = item.href;
    }
  };

  input.addEventListener(
    "input",
    () => {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        runQuery().catch(console.error);
      }, 90);
    },
    { signal }
  );

  dialog.addEventListener(
    "click",
    (event) => {
      if (event.target === dialog) close();
    },
    { signal }
  );

  resultList.addEventListener(
    "mousemove",
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const item = target.closest<HTMLLIElement>(".command-item");
      if (!(item instanceof HTMLElement)) return;
      focusedIndex = Number(item.dataset.index ?? -1);
      renderItems(visibleItems, "");
    },
    { signal }
  );

  resultList.addEventListener(
    "click",
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const item = target.closest<HTMLLIElement>(".command-item");
      if (!(item instanceof HTMLElement)) return;
      const index = Number(item.dataset.index ?? -1);
      executeItem(visibleItems[index]);
    },
    { signal }
  );

  document.addEventListener(
    "click",
    (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const trigger = target.closest('[data-action="open-command"]');
      if (!(trigger instanceof HTMLElement)) return;
      event.preventDefault();
      open();
    },
    { signal }
  );

  window.addEventListener(
    "site:open-command",
    () => {
      open();
    },
    { signal }
  );

  window.addEventListener(
    "keydown",
    (event) => {
      const key = event.key.toLowerCase();

      if ((event.ctrlKey || event.metaKey) && key === "k" && !isTypingContext(event.target)) {
        event.preventDefault();
        open();
        return;
      }

      if (!dialog.open) return;

      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (!visibleItems.length) return;
        focusedIndex = (focusedIndex + 1 + visibleItems.length) % visibleItems.length;
        renderItems(visibleItems, "");
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        if (!visibleItems.length) return;
        focusedIndex = (focusedIndex - 1 + visibleItems.length) % visibleItems.length;
        renderItems(visibleItems, "");
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        executeItem(visibleItems[focusedIndex]);
      }
    },
    { signal }
  );

  runQuery().catch(console.error);

  return () => {
    window.clearTimeout(debounceTimer);
    controller.abort();
    close();
  };
}

export function bootCommandPalette() {
  if (window.__flyCommandPaletteCleanup) {
    window.__flyCommandPaletteCleanup();
  }
  window.__flyCommandPaletteCleanup = setupCommandPalette();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootCommandPalette, { once: true });
} else {
  bootCommandPalette();
}

document.addEventListener("astro:page-load", bootCommandPalette);

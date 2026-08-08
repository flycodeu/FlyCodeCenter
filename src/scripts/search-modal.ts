import { createSearchEngine } from "../providers/search/index";
import type { SearchEngine, SearchResult } from "../providers/search/types";

declare global {
  interface Window {
    __flySearchCleanup?: () => void;
  }
}

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderSnippet(input: string): string {
  return escapeHtml(input)
    .replaceAll("&lt;mark&gt;", "<mark>")
    .replaceAll("&lt;/mark&gt;", "</mark>");
}

function normalizeUrl(url: string): string {
  if (!url) return "/";
  if (url.startsWith("/") || url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return "/";
}

function inferDomainLabel(url: string): string {
  const value = normalizeUrl(url);
  if (value.startsWith("/blog")) return "博客";
  if (value.startsWith("/tutorials")) return "教程";
  if (value.startsWith("/interview")) return "面试";
  if (value.startsWith("/projects")) return "项目";
  if (value.startsWith("/sites")) return "收藏";
  if (value.startsWith("/reading")) return "推荐";
  if (value.startsWith("/tags")) return "标签";
  return "页面";
}

function toReadablePath(url: string): string {
  const normalized = normalizeUrl(url);
  if (normalized.startsWith("http://") || normalized.startsWith("https://")) return normalized;
  return normalized.replace(/\/{2,}/g, "/");
}

function isTypingContext(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return true;
  if (target.isContentEditable) return true;
  return Boolean(target.closest("[contenteditable='true'], input, textarea"));
}

function setupSearchModal() {
  const root = document.getElementById("search-root");
  if (!(root instanceof HTMLElement)) return () => {};

  const nativePreferred = root.getAttribute("data-native") === "1";
  const shortcut = (root.getAttribute("data-shortcut") || "k").toLowerCase();
  const dialog = document.getElementById("search-modal");
  const fallback = document.getElementById("search-fallback");
  const controller = new AbortController();
  const { signal } = controller;

  const useDialog =
    nativePreferred &&
    dialog instanceof HTMLDialogElement &&
    typeof dialog.showModal === "function";

  const nativeInput = document.getElementById("search-input");
  const nativeResults = document.getElementById("search-results");
  const fallbackInput = document.getElementById("search-input-fallback");
  const fallbackResults = document.getElementById("search-results-fallback");

  if (
    !(nativeInput instanceof HTMLInputElement) ||
    !(nativeResults instanceof HTMLElement) ||
    !(fallbackInput instanceof HTMLInputElement) ||
    !(fallbackResults instanceof HTMLElement)
  ) {
    return () => {};
  }

  let engine: SearchEngine | null = null;
  let enginePromise: Promise<SearchEngine> | null = null;
  let focusedIndex = -1;
  let currentResults: SearchResult[] = [];
  let sequence = 0;
  let debounceTimer = 0;
  let destroyed = false;
  let dialogActive = useDialog;
  let input = dialogActive ? nativeInput : fallbackInput;
  let resultsEl = dialogActive ? nativeResults : fallbackResults;

  const setActiveSurface = (native: boolean) => {
    dialogActive = native && useDialog;
    input = dialogActive ? nativeInput : fallbackInput;
    resultsEl = dialogActive ? nativeResults : fallbackResults;
  };

  const mountFallback = () => {
    if (!(fallback instanceof HTMLElement)) return;
    fallback.hidden = false;
    fallback.classList.add("open");
    document.body.classList.add("has-overlay");
  };

  const unmountFallback = () => {
    if (!(fallback instanceof HTMLElement)) return;
    fallback.classList.remove("open");
    fallback.hidden = true;
    document.body.classList.remove("has-overlay");
  };

  const ensureEngine = async () => {
    if (engine) return engine;
    enginePromise ??= createSearchEngine();
    engine = await enginePromise;
    return engine;
  };

  const updateResultCount = (count: number) => {
    const countId = dialogActive ? "search-count" : "search-count-fallback";
    const countEl = document.getElementById(countId);
    if (countEl instanceof HTMLElement) {
      countEl.textContent = `${count} 条结果`;
    }
  };

  const setError = (message: string) => {
    resultsEl.innerHTML = `<li class='result-empty'>${escapeHtml(message)}</li>`;
    updateResultCount(0);
  };

  const renderResults = (query: string) => {
    if (!query) {
      resultsEl.innerHTML = "<li class='result-empty'>输入关键词开始搜索</li>";
      focusedIndex = -1;
      updateResultCount(0);
      return;
    }

    if (!currentResults.length) {
      resultsEl.innerHTML = "<li class='result-empty'>没有命中结果</li>";
      focusedIndex = -1;
      updateResultCount(0);
      return;
    }

    updateResultCount(currentResults.length);
    resultsEl.innerHTML = currentResults
      .map((item, idx) => {
        const cls = idx === focusedIndex ? "result-item active" : "result-item";
        const safeUrl = normalizeUrl(String(item.url || "/"));
        const domain = inferDomainLabel(safeUrl);
        const pathText = toReadablePath(safeUrl);
        const escapedUrl = escapeHtml(safeUrl);
        return `<li class="${cls}" data-url="${escapedUrl}" data-index="${idx}">
            <a href="${escapedUrl}">
              <div class="result-title-row">
                <h4>${escapeHtml(String(item.title || "Untitled"))}</h4>
              </div>
              <div class="result-meta">
                <span class="result-domain">${escapeHtml(domain)}</span>
                <span class="result-path">${escapeHtml(pathText)}</span>
              </div>
              <p class="result-snippet">${renderSnippet(String(item.snippet || "暂无摘要"))}</p>
            </a>
          </li>`;
      })
      .join("");
  };

  const updateFocusedResult = (nextIndex: number) => {
    if (nextIndex === focusedIndex || nextIndex < 0 || nextIndex >= currentResults.length) return;
    const current = resultsEl.querySelector(".result-item.active");
    current?.classList.remove("active");
    const next = resultsEl.querySelector(`[data-index="${nextIndex}"]`);
    next?.classList.add("active");
    focusedIndex = nextIndex;
  };

  const runSearch = async () => {
    const query = input.value.trim();
    if (!query) {
      currentResults = [];
      renderResults("");
      return;
    }

    const runId = ++sequence;
    try {
      const searchEngine = await ensureEngine();
      const nextResults = await searchEngine.search(query);
      if (runId !== sequence) return;
      currentResults = nextResults;
      focusedIndex = currentResults.length ? 0 : -1;
      renderResults(query);
    } catch (error) {
      console.error(error);
      setError("搜索初始化失败，请刷新页面后重试。");
    }
  };

  const openSearch = async () => {
    if (destroyed) return;

    const canUseDialog =
      useDialog &&
      dialog instanceof HTMLDialogElement &&
      dialog.isConnected &&
      typeof dialog.showModal === "function";

    if (canUseDialog) {
      setActiveSurface(true);
      try {
        if (!dialog.open) dialog.showModal();
      } catch (error) {
        console.warn("search modal showModal failed, fallback to panel", error);
        if (dialog.open) dialog.close();
        setActiveSurface(false);
        mountFallback();
      }
    } else {
      setActiveSurface(false);
      mountFallback();
    }

    renderResults("");

    try {
      await ensureEngine();
    } catch (error) {
      console.error(error);
      setError("搜索引擎加载失败，请稍后再试。");
    }

    if (destroyed) return;
    window.requestAnimationFrame(() => {
      input.focus();
    });
  };

  const closeSearch = () => {
    if (
      dialogActive &&
      dialog instanceof HTMLDialogElement &&
      dialog.isConnected &&
      dialog.open
    ) {
      dialog.close();
    }
    unmountFallback();
  };

  const handleInput = () => {
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
      runSearch().catch(console.error);
    }, 100);
  };

  nativeInput.addEventListener("input", handleInput, { signal });
  fallbackInput.addEventListener("input", handleInput, { signal });

  if (dialog instanceof HTMLDialogElement) {
    dialog.addEventListener(
      "click",
      (event) => {
        if (event.target === dialog) {
          closeSearch();
        }
      },
      { signal }
    );
  }

  fallback?.addEventListener(
    "click",
    (event) => {
      if (event.target === fallback) {
        closeSearch();
      }
    },
    { signal }
  );

  [nativeResults, fallbackResults].forEach((results) => {
    results.addEventListener(
      "mouseover",
      (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const item = target.closest(".result-item");
        if (!(item instanceof HTMLElement)) return;
        const nextIndex = Number(item.dataset.index ?? -1);
        const related = event.relatedTarget;
        if (related instanceof Node && item.contains(related)) return;
        updateFocusedResult(nextIndex);
      },
      { signal }
    );

    results.addEventListener(
      "click",
      (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const item = target.closest(".result-item");
        if (!(item instanceof HTMLElement)) return;
        const url = item.dataset.url;
        if (!url) return;
        event.preventDefault();
        closeSearch();
        window.location.href = normalizeUrl(url);
      },
      { signal }
    );
  });

  document.addEventListener(
    "click",
    (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const trigger = target.closest('[data-action="open-search"]');
      if (!(trigger instanceof HTMLElement)) return;
      event.preventDefault();
      openSearch().catch(console.error);
    },
    { signal }
  );

  window.addEventListener(
    "site:open-search",
    () => {
      openSearch().catch(console.error);
    },
    { signal }
  );

  window.addEventListener(
    "site:close-search",
    () => {
      closeSearch();
    },
    { signal }
  );

  window.addEventListener(
    "keydown",
    (event) => {
      const key = event.key.toLowerCase();
      const slashShortcut = shortcut === "/" && key === "/";
      const customShortcut = shortcut !== "/" && (event.ctrlKey || event.metaKey) && key === shortcut;
      if ((slashShortcut || customShortcut) && !isTypingContext(event.target)) {
        event.preventDefault();
        openSearch().catch(console.error);
        return;
      }

      const opened = dialogActive
        ? dialog instanceof HTMLDialogElement && dialog.isConnected && dialog.open
        : fallback instanceof HTMLElement && fallback.classList.contains("open");

      if (!opened) return;

      if (event.key === "Escape") {
        event.preventDefault();
        closeSearch();
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (!currentResults.length) return;
        updateFocusedResult((focusedIndex + 1 + currentResults.length) % currentResults.length);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        if (!currentResults.length) return;
        updateFocusedResult((focusedIndex - 1 + currentResults.length) % currentResults.length);
        return;
      }

      if (event.key === "Enter") {
        const result = currentResults[focusedIndex];
        if (!result) return;
        event.preventDefault();
        window.location.href = normalizeUrl(result.url);
      }
    },
    { signal }
  );

  renderResults("");

  return () => {
    destroyed = true;
    sequence += 1;
    closeSearch();
    window.clearTimeout(debounceTimer);
    engine?.destroy?.();
    controller.abort();
  };
}

export function bootSearchModal() {
  if (window.__flySearchCleanup) {
    window.__flySearchCleanup();
  }
  window.__flySearchCleanup = setupSearchModal();
}

import { createSearchEngine } from "../providers/search/index";
import type { SearchEngine, SearchResult } from "../providers/search/types";

declare global {
  interface Window {
    __flySearchInited?: boolean;
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

function normalizeUrl(url: string): string {
  if (!url) return "/";
  if (url.startsWith("/") || url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return "/";
}

function isTypingContext(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return true;
  if (target.isContentEditable) return true;
  return Boolean(target.closest("[contenteditable='true'], input, textarea"));
}

function initSearchModal() {
  if (window.__flySearchInited) return;
  window.__flySearchInited = true;

  const root = document.getElementById("search-root");
  if (!(root instanceof HTMLElement)) return;

  const nativePreferred = root.getAttribute("data-native") === "1";
  const shortcut = (root.getAttribute("data-shortcut") || "k").toLowerCase();
  const dialog = document.getElementById("search-modal");
  const fallback = document.getElementById("search-fallback");

  const useDialog =
    nativePreferred &&
    dialog instanceof HTMLDialogElement &&
    typeof dialog.showModal === "function";

  const input = document.getElementById(useDialog ? "search-input" : "search-input-fallback");
  const resultsEl = document.getElementById(useDialog ? "search-results" : "search-results-fallback");

  if (!(input instanceof HTMLInputElement) || !(resultsEl instanceof HTMLElement)) return;

  let engine: SearchEngine | null = null;
  let focusedIndex = -1;
  let currentResults: SearchResult[] = [];
  let sequence = 0;
  let debounceTimer = 0;

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
    if (!engine) {
      engine = await createSearchEngine();
    }
    return engine;
  };

  const setError = (message: string) => {
    resultsEl.innerHTML = `<li class='result-empty'>${escapeHtml(message)}</li>`;
  };

  const renderResults = (query: string) => {
    if (!query) {
      resultsEl.innerHTML = "<li class='result-empty'>输入关键词开始搜索</li>";
      focusedIndex = -1;
      return;
    }

    if (!currentResults.length) {
      resultsEl.innerHTML = "<li class='result-empty'>没有命中结果</li>";
      focusedIndex = -1;
      return;
    }

    resultsEl.innerHTML = currentResults
      .map((item, idx) => {
        const cls = idx === focusedIndex ? "result-item active" : "result-item";
        const safeUrl = normalizeUrl(String(item.url || "/"));
        return `<li class="${cls}" data-url="${safeUrl}" data-index="${idx}">
            <a href="${safeUrl}">
              <h4>${escapeHtml(String(item.title || "Untitled"))}</h4>
              <p>${item.snippet || ""}</p>
            </a>
          </li>`;
      })
      .join("");
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
    if (useDialog && dialog instanceof HTMLDialogElement) {
      if (!dialog.open) dialog.showModal();
    } else {
      mountFallback();
    }

    renderResults("");

    try {
      await ensureEngine();
    } catch (error) {
      console.error(error);
      setError("搜索引擎加载失败，请稍后再试。");
    }

    window.requestAnimationFrame(() => {
      input.focus();
    });
  };

  const closeSearch = () => {
    if (useDialog && dialog instanceof HTMLDialogElement && dialog.open) {
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

  input.addEventListener("input", handleInput);

  if (dialog instanceof HTMLDialogElement) {
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) {
        closeSearch();
      }
    });
  }

  fallback?.addEventListener("click", (event) => {
    if (event.target === fallback) {
      closeSearch();
    }
  });

  resultsEl.addEventListener("mousemove", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const item = target.closest(".result-item");
    if (!(item instanceof HTMLElement)) return;
    focusedIndex = Number(item.dataset.index ?? -1);
    renderResults(input.value.trim());
  });

  resultsEl.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const item = target.closest(".result-item");
    if (!(item instanceof HTMLElement)) return;
    const url = item.dataset.url;
    if (!url) return;
    event.preventDefault();
    closeSearch();
    window.location.href = normalizeUrl(url);
  });

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const trigger = target.closest('[data-action="open-search"]');
    if (!(trigger instanceof HTMLElement)) return;
    event.preventDefault();
    openSearch().catch(console.error);
  });

  window.addEventListener("site:open-search", () => {
    openSearch().catch(console.error);
  });

  window.addEventListener("site:close-search", () => {
    closeSearch();
  });

  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && key === "k") {
      event.preventDefault();
      openSearch().catch(console.error);
      return;
    }

    const slashShortcut = shortcut === "/" && key === "/";
    const customShortcut = shortcut !== "/" && (event.ctrlKey || event.metaKey) && key === shortcut;
    if ((slashShortcut || customShortcut) && !isTypingContext(event.target)) {
      event.preventDefault();
      openSearch().catch(console.error);
      return;
    }

    const opened = useDialog
      ? dialog instanceof HTMLDialogElement && dialog.open
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
      focusedIndex = (focusedIndex + 1 + currentResults.length) % currentResults.length;
      renderResults(input.value.trim());
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!currentResults.length) return;
      focusedIndex = (focusedIndex - 1 + currentResults.length) % currentResults.length;
      renderResults(input.value.trim());
      return;
    }

    if (event.key === "Enter") {
      const result = currentResults[focusedIndex];
      if (!result) return;
      event.preventDefault();
      window.location.href = normalizeUrl(result.url);
    }
  });

  renderResults("");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSearchModal, { once: true });
} else {
  initSearchModal();
}

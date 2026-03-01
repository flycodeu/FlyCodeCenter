(() => {
  const CLEANUP_KEY = "__flySearchCleanup";

  function escapeHtml(input) {
    return String(input)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function escapeRegExp(input) {
    return String(input).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function normalizeUrl(url) {
    if (!url) return "/";
    if (url.startsWith("/") || url.startsWith("http://") || url.startsWith("https://")) {
      return url;
    }
    return "/";
  }

  function isTypingContext(target) {
    if (!(target instanceof HTMLElement)) return false;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return true;
    if (target.isContentEditable) return true;
    return Boolean(target.closest("[contenteditable='true'], input, textarea"));
  }

  function tokenize(input) {
    const text = String(input || "").trim().toLowerCase();
    if (!text) return [];
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length > 1) return words;
    const single = words[0] || "";
    if (/^[\u4e00-\u9fff]+$/.test(single) && single.length > 2) {
      const grams = [];
      for (let i = 0; i < single.length - 1; i += 1) {
        grams.push(single.slice(i, i + 2));
      }
      grams.push(single);
      return [...new Set(grams)];
    }
    return [single];
  }

  function countIncludes(text, term) {
    if (!text || !term) return 0;
    let count = 0;
    let index = 0;
    while (true) {
      const hit = text.indexOf(term, index);
      if (hit === -1) break;
      count += 1;
      index = hit + Math.max(term.length, 1);
    }
    return count;
  }

  function highlightText(raw, terms) {
    let output = escapeHtml(raw || "");
    const sortedTerms = [...terms].sort((a, b) => b.length - a.length);
    for (const term of sortedTerms) {
      if (!term) continue;
      const safe = escapeRegExp(escapeHtml(term));
      output = output.replace(new RegExp(safe, "gi"), (match) => `<mark>${match}</mark>`);
    }
    return output;
  }

  function makeSnippet(text, terms) {
    const source = String(text || "").replace(/\s+/g, " ").trim();
    if (!source) return "";

    const lower = source.toLowerCase();
    let start = 0;
    for (const term of terms) {
      const idx = lower.indexOf(term);
      if (idx >= 0) {
        start = Math.max(0, idx - 34);
        break;
      }
    }

    const rawSnippet = source.slice(start, start + 144);
    const prefix = start > 0 ? "…" : "";
    const suffix = start + 144 < source.length ? "…" : "";
    return `${prefix}${highlightText(rawSnippet, terms)}${suffix}`;
  }

  function domainLabel(domain) {
    const key = String(domain || "").toLowerCase();
    if (key === "blog") return "博客";
    if (key === "tutorial") return "教程";
    if (key === "projects") return "项目";
    if (key === "sites") return "收藏";
    if (key === "reading") return "阅读";
    return "内容";
  }

  function createEngine(indexPath, topK) {
    let docsPromise = null;

    const loadDocs = async () => {
      if (!docsPromise) {
        docsPromise = fetch(indexPath, { cache: "force-cache" })
          .then((response) => {
            if (!response.ok) {
              throw new Error(`索引加载失败：${response.status}`);
            }
            return response.json();
          })
          .then((payload) => payload?.documents || []);
      }
      return docsPromise;
    };

    return {
      async search(query) {
        const terms = tokenize(query);
        if (!terms.length) return [];

        const docs = await loadDocs();
        const scored = [];

        for (const doc of docs) {
          const title = String(doc.title || "").toLowerCase();
          const description = String(doc.description || "").toLowerCase();
          const content = String(doc.content || "").toLowerCase();
          const headings = String(doc.headings || "").toLowerCase();
          const tags = String(doc.tags || "").toLowerCase();
          const code = String(doc.code || "").toLowerCase();

          let score = 0;
          for (const term of terms) {
            score += countIncludes(title, term) * 8;
            score += countIncludes(headings, term) * 5;
            score += countIncludes(tags, term) * 4;
            score += countIncludes(description, term) * 3;
            score += countIncludes(code, term) * 2;
            score += countIncludes(content, term);
          }

          if (score <= 0) continue;

          const rawSnippet = doc.description || doc.content || "";
          scored.push({
            title: String(doc.title || "Untitled"),
            url: normalizeUrl(String(doc.url || "/")),
            snippet: makeSnippet(rawSnippet, terms),
            score,
            domain: String(doc.domain || "content")
          });
        }

        scored.sort((a, b) => b.score - a.score);
        return scored.slice(0, topK);
      }
    };
  }

  function setupSearchModal() {
    const root = document.getElementById("search-root");
    if (!(root instanceof HTMLElement)) return () => {};

    const nativePreferred = root.getAttribute("data-native") === "1";
    const shortcut = (root.getAttribute("data-shortcut") || "k").toLowerCase();
    const indexPath = root.getAttribute("data-index-path") || "/search/minisearch.json";
    const topK = Number(root.getAttribute("data-top-k") || "8");
    const groupByDomain = root.getAttribute("data-group-by-domain") === "1";

    const dialog = document.getElementById("search-modal");
    const fallback = document.getElementById("search-fallback");

    const useDialog =
      nativePreferred &&
      dialog instanceof HTMLDialogElement &&
      typeof dialog.showModal === "function";

    const input = document.getElementById(useDialog ? "search-input" : "search-input-fallback");
    const resultsEl = document.getElementById(useDialog ? "search-results" : "search-results-fallback");
    const countEl = document.getElementById(useDialog ? "search-count" : "search-count-fallback");

    if (!(input instanceof HTMLInputElement) || !(resultsEl instanceof HTMLElement)) return () => {};

    const engine = createEngine(indexPath, topK);
    const controller = new AbortController();
    const { signal } = controller;

    let focusedIndex = -1;
    let currentResults = [];
    let activeTerms = [];
    let sequence = 0;
    let debounceTimer = 0;
    let destroyed = false;

    const setCount = (count) => {
      if (!(countEl instanceof HTMLElement)) return;
      countEl.textContent = `${count} 条结果`;
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

    const renderItem = (item, idx) => {
      const cls = idx === focusedIndex ? "result-item active" : "result-item";
      return `<li class="${cls}" data-url="${item.url}" data-index="${idx}">
        <a href="${item.url}">
          <span class="result-meta"><span class="result-domain">${domainLabel(item.domain)}</span></span>
          <h4>${highlightText(item.title, activeTerms)}</h4>
          <p>${item.snippet}</p>
        </a>
      </li>`;
    };

    const renderResults = (query) => {
      if (!query) {
        resultsEl.innerHTML = "<li class='result-empty'>输入关键词开始搜索</li>";
        focusedIndex = -1;
        setCount(0);
        return;
      }

      if (!currentResults.length) {
        resultsEl.innerHTML = "<li class='result-empty'>没有命中结果</li>";
        focusedIndex = -1;
        setCount(0);
        return;
      }

      if (!groupByDomain) {
        resultsEl.innerHTML = currentResults.map((item, idx) => renderItem(item, idx)).join("");
        setCount(currentResults.length);
        return;
      }

      const groups = new Map();
      for (const item of currentResults) {
        const key = String(item.domain || "content");
        const list = groups.get(key) || [];
        list.push(item);
        groups.set(key, list);
      }

      const order = ["blog", "tutorial", "projects", "sites", "reading"];
      const keys = [...groups.keys()].sort((a, b) => {
        const aIdx = order.indexOf(a);
        const bIdx = order.indexOf(b);
        if (aIdx === -1 && bIdx === -1) return a.localeCompare(b);
        if (aIdx === -1) return 1;
        if (bIdx === -1) return -1;
        return aIdx - bIdx;
      });

      const lines = [];
      keys.forEach((key) => {
        lines.push(`<li class="result-group-title">${domainLabel(key)}</li>`);
        const list = groups.get(key) || [];
        list.forEach((item) => {
          const idx = currentResults.indexOf(item);
          lines.push(renderItem(item, idx));
        });
      });

      resultsEl.innerHTML = lines.join("");
      setCount(currentResults.length);
    };

    const runSearch = async () => {
      const query = input.value.trim();
      if (!query) {
        currentResults = [];
        activeTerms = [];
        renderResults("");
        return;
      }

      const runId = ++sequence;
      try {
        activeTerms = tokenize(query);
        const nextResults = await engine.search(query);
        if (runId !== sequence) return;
        currentResults = nextResults;
        focusedIndex = currentResults.length ? 0 : -1;
        renderResults(query);
      } catch (error) {
        console.error(error);
        resultsEl.innerHTML = "<li class='result-empty'>搜索初始化失败，请刷新页面后重试。</li>";
        setCount(0);
      }
    };

    const openSearch = () => {
      if (destroyed) return;
      const canUseDialog =
        useDialog &&
        dialog instanceof HTMLDialogElement &&
        dialog.isConnected &&
        typeof dialog.showModal === "function";

      if (canUseDialog) {
        try {
          if (!dialog.open) dialog.showModal();
        } catch (error) {
          console.warn("search modal showModal failed", error);
          mountFallback();
        }
      } else {
        mountFallback();
      }

      renderResults("");
      window.requestAnimationFrame(() => input.focus());
    };

    const closeSearch = () => {
      if (useDialog && dialog instanceof HTMLDialogElement && dialog.isConnected && dialog.open) {
        dialog.close();
      }
      unmountFallback();
    };

    const handleInput = () => {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        runSearch().catch(console.error);
      }, 120);
    };

    input.addEventListener("input", handleInput, { signal });

    if (dialog instanceof HTMLDialogElement) {
      dialog.addEventListener("click", (event) => {
        if (event.target === dialog) closeSearch();
      }, { signal });
    }

    fallback?.addEventListener("click", (event) => {
      if (event.target === fallback) closeSearch();
    }, { signal });

    resultsEl.addEventListener("mousemove", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const item = target.closest(".result-item");
      if (!(item instanceof HTMLElement)) return;
      focusedIndex = Number(item.dataset.index ?? -1);
      renderResults(input.value.trim());
    }, { signal });

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
    }, { signal });

    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const trigger = target.closest('[data-action="open-search"]');
      if (!(trigger instanceof HTMLElement)) return;
      event.preventDefault();
      openSearch();
    }, { signal });

    window.addEventListener("site:open-search", openSearch, { signal });
    window.addEventListener("site:close-search", closeSearch, { signal });

    window.addEventListener("keydown", (event) => {
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === "k") {
        event.preventDefault();
        openSearch();
        return;
      }

      const slashShortcut = shortcut === "/" && key === "/";
      const customShortcut = shortcut !== "/" && (event.ctrlKey || event.metaKey) && key === shortcut;
      if ((slashShortcut || customShortcut) && !isTypingContext(event.target)) {
        event.preventDefault();
        openSearch();
        return;
      }

      const opened = useDialog
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
        closeSearch();
        window.location.href = normalizeUrl(result.url);
      }
    }, { signal });

    renderResults("");

    return () => {
      destroyed = true;
      closeSearch();
      window.clearTimeout(debounceTimer);
      controller.abort();
    };
  }

  function bootSearchModal() {
    if (typeof window[CLEANUP_KEY] === "function") {
      window[CLEANUP_KEY]();
    }
    window[CLEANUP_KEY] = setupSearchModal();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootSearchModal, { once: true });
  } else {
    bootSearchModal();
  }

  document.addEventListener("astro:page-load", bootSearchModal);
})();

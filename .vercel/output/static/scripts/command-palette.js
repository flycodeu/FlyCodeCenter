(() => {
  const CLEANUP_KEY = "__flyCommandPaletteCleanup";
  const RECENT_KEY = "flycode-recent-pages";
  const THEME_KEY = "flycode-theme";
  const THEME_EXPLICIT_KEY = "flycode-theme-explicit";

  function escapeHtml(input) {
    return String(input)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function normalize(input) {
    return String(input || "").trim().toLowerCase();
  }

  function isTypingContext(target) {
    if (!(target instanceof HTMLElement)) return false;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return true;
    if (target.isContentEditable) return true;
    return Boolean(target.closest("[contenteditable='true'], input, textarea"));
  }

  function readRecentPages() {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((item) => typeof item === "string" && item.startsWith("/")).slice(0, 8);
    } catch {
      return [];
    }
  }

  function writeRecentPages(items) {
    localStorage.setItem(RECENT_KEY, JSON.stringify(items.slice(0, 8)));
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
    const themes = JSON.parse(root.dataset.themes || "[]");

    recordCurrentPage();

    let focusedIndex = -1;
    let visibleItems = [];
    const allowedThemes = Array.isArray(themes)
      ? themes.filter((item) => typeof item === "string" && item.trim())
      : [];
    const fallbackTheme = document.documentElement.dataset.defaultTheme || allowedThemes[0] || "plume";
    const normalizeTheme = (value) => {
      const theme = String(value || "").trim();
      if (allowedThemes.includes(theme)) return theme;
      if (allowedThemes.includes(fallbackTheme)) return fallbackTheme;
      return allowedThemes[0] || "plume";
    };

    const setTheme = (theme) => {
      const next = normalizeTheme(theme);
      document.documentElement.dataset.theme = next;
      localStorage.setItem(THEME_KEY, next);
      localStorage.setItem(THEME_EXPLICIT_KEY, "1");
      window.dispatchEvent(new CustomEvent("site:theme-change", { detail: next }));
    };

    const getBaseItems = () => {
      const quick = [
        { id: "go-home", group: "快速跳转", title: "首页", desc: "返回站点首页", href: "/" },
        { id: "go-blog", group: "快速跳转", title: "博客", desc: "浏览博客文章", href: "/blog" },
        { id: "go-tutorials", group: "快速跳转", title: "教程", desc: "查看教程总览", href: "/tutorials" },
        { id: "go-sites", group: "快速跳转", title: "收藏", desc: "查看网站收藏卡片", href: "/sites" },
        { id: "go-reading", group: "快速跳转", title: "优秀文章", desc: "查看优质文章收藏", href: "/reading" },
        { id: "go-tags", group: "快速跳转", title: "标签", desc: "打开标签中心", href: "/tags" }
      ];

      const actions = [
        {
          id: "open-search",
          group: "常用命令",
          title: "打开搜索",
          desc: "打开站内搜索面板",
          action: () => window.dispatchEvent(new CustomEvent("site:open-search"))
        },
        {
          id: "open-ai",
          group: "常用命令",
          title: "打开 AI 聊天",
          desc: "打开 AI 对话窗口",
          action: () => window.dispatchEvent(new CustomEvent("site:open-ai"))
        }
      ];

      const themeItems = allowedThemes.map((theme) => ({
        id: `theme-${theme}`,
        group: "主题切换",
        title: `切换主题：${theme}`,
        desc: "仅在确认执行时切换",
        action: () => setTheme(theme)
      }));

      const recent = readRecentPages()
        .filter((href) => href !== window.location.pathname)
        .map((href, idx) => ({
          id: `recent-${idx}`,
          group: "最近访问",
          title: href === "/" ? "首页" : href,
          desc: "最近访问页面",
          href
        }));

      return [...actions, ...quick, ...themeItems, ...recent];
    };

    const renderItems = (items, emptyText) => {
      visibleItems = items;
      if (!items.length) {
        resultList.innerHTML = `<li class="command-empty">${escapeHtml(emptyText)}</li>`;
        focusedIndex = -1;
        return;
      }

      let lastGroup = "";
      const html = [];
      items.forEach((item, index) => {
        if (item.group !== lastGroup) {
          lastGroup = item.group;
          html.push(`<li class="command-group">${escapeHtml(item.group)}</li>`);
        }
        const active = index === focusedIndex ? "command-item active" : "command-item";
        html.push(`<li class="${active}" data-index="${index}"><button type="button"><h4>${escapeHtml(item.title)}</h4><p>${escapeHtml(item.desc)}</p></button></li>`);
      });
      resultList.innerHTML = html.join("");
    };

    const runQuery = () => {
      const query = normalize(input.value);
      const items = getBaseItems();
      if (!query) {
        renderItems(items, "暂无可执行命令");
        return;
      }
      const filtered = items.filter((item) => normalize(`${item.title} ${item.desc}`).includes(query));
      renderItems(filtered, "未找到匹配命令");
    };

    const executeItem = (item) => {
      if (!item) return;
      if (item.action) item.action();
      if (item.href) window.location.href = item.href;
      if (dialog.open) dialog.close();
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
      runQuery();
      window.requestAnimationFrame(() => input.focus());
    };

    const close = () => {
      if (dialog.open) dialog.close();
    };

    input.addEventListener("input", runQuery, { signal });

    resultList.addEventListener("mousemove", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const item = target.closest(".command-item");
      if (!(item instanceof HTMLElement)) return;
      focusedIndex = Number(item.dataset.index ?? -1);
      renderItems(visibleItems, "");
    }, { signal });

    resultList.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const item = target.closest(".command-item");
      if (!(item instanceof HTMLElement)) return;
      const index = Number(item.dataset.index ?? -1);
      executeItem(visibleItems[index]);
    }, { signal });

    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) close();
    }, { signal });

    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const trigger = target.closest('[data-action="open-command"]');
      if (!(trigger instanceof HTMLElement)) return;
      event.preventDefault();
      open();
    }, { signal });

    window.addEventListener("site:open-command", open, { signal });

    window.addEventListener("keydown", (event) => {
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
        if (focusedIndex < 0) return;
        event.preventDefault();
        executeItem(visibleItems[focusedIndex]);
      }
    }, { signal });

    runQuery();

    return () => {
      controller.abort();
      close();
    };
  }

  function bootCommandPalette() {
    if (typeof window[CLEANUP_KEY] === "function") {
      window[CLEANUP_KEY]();
    }
    window[CLEANUP_KEY] = setupCommandPalette();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootCommandPalette, { once: true });
  } else {
    bootCommandPalette();
  }

  document.addEventListener("astro:page-load", bootCommandPalette);
})();

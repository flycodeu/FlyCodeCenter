const root = document.documentElement;
const perfTier = root.dataset.perf || "high";
const isLowPerf = perfTier === "low";
const isCompactViewport = window.matchMedia("(max-width: 900px)").matches;
const prefetchEnabled = root.dataset.linkPrefetch === "1";

const runWhenIdle = (task, timeout = 1200) => {
  if (typeof task !== "function") return;
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(() => task(), { timeout });
    return;
  }
  window.setTimeout(task, 0);
};

const scheduleNonCritical = (task, timeout = isLowPerf || isCompactViewport ? 1800 : 900) => {
  runWhenIdle(task, timeout);
};

let searchModalModulePromise = null;
let jarvisOrbModulePromise = null;

const buildResponsiveImageUrl = (input, width) => {
  const raw = String(input || "").trim();
  if (!raw) return raw;
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    try {
      const url = new URL(raw);
      url.searchParams.set("w", String(width));
      return url.toString();
    } catch {
      return raw;
    }
  }
  const [path, query = ""] = raw.split("?");
  const params = new URLSearchParams(query);
  params.set("w", String(width));
  const nextQuery = params.toString();
  return nextQuery ? `${path}?${nextQuery}` : path;
};

const isTypingContext = (target) => {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return true;
  if (target.isContentEditable) return true;
  return Boolean(target.closest("[contenteditable='true'], input, textarea"));
};

const getSearchRoot = () => {
  const node = document.getElementById("search-root");
  return node instanceof HTMLElement ? node : null;
};

const getSearchShortcut = () => {
  return String(getSearchRoot()?.dataset.shortcut || "k").trim().toLowerCase();
};

const matchesSearchShortcut = (event, shortcut) => {
  const key = String(event.key || "").toLowerCase();
  if (!shortcut) return false;
  if (shortcut === "/") return key === "/";
  return (event.ctrlKey || event.metaKey) && key === shortcut;
};

const ensureSearchModal = async () => {
  const searchRoot = getSearchRoot();
  if (!(searchRoot instanceof HTMLElement)) return null;
  if (!searchModalModulePromise) {
    searchModalModulePromise = import("./search-modal.ts");
  }
  const module = await searchModalModulePromise;
  if (typeof module.bootSearchModal === "function") {
    module.bootSearchModal();
  }
  window.__flySearchModalReady = true;
  return module;
};

const openSearchModal = async () => {
  if (!(getSearchRoot() instanceof HTMLElement)) return;
  await ensureSearchModal();
  window.dispatchEvent(new CustomEvent("site:open-search"));
};

const bindSearchBootstrap = () => {
  if (window.__flySearchBootstrapBound) return;
  window.__flySearchBootstrapBound = true;

  const handleClick = (event) => {
    if (window.__flySearchModalReady) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const trigger = target.closest('[data-action="open-search"]');
    if (!(trigger instanceof HTMLElement)) return;
    event.preventDefault();
    openSearchModal().catch(console.error);
  };

  const handleKeydown = (event) => {
    if (window.__flySearchModalReady) return;
    const shortcut = getSearchShortcut();
    if (!matchesSearchShortcut(event, shortcut) || isTypingContext(event.target)) return;
    event.preventDefault();
    openSearchModal().catch(console.error);
  };

  const handleOpenRequest = () => {
    if (window.__flySearchModalReady) return;
    openSearchModal().catch(console.error);
  };

  document.addEventListener("click", handleClick, true);
  window.addEventListener("keydown", handleKeydown);
  window.addEventListener("site:open-search", handleOpenRequest);
};

const ensureJarvisOrb = async () => {
  const host = document.getElementById("jarvis-bot");
  if (!(host instanceof HTMLElement)) return null;
  if (!jarvisOrbModulePromise) {
    jarvisOrbModulePromise = import("./jarvis-orb-entry.js");
  }
  const module = await jarvisOrbModulePromise;
  if (typeof module.bootJarvisOrb === "function") {
    module.bootJarvisOrb();
  }
  return module;
};

const scheduleJarvisOrb = () => {
  const host = document.getElementById("jarvis-bot");
  if (!(host instanceof HTMLElement)) return;
  if (isLowPerf || isCompactViewport) {
    host.hidden = true;
    return;
  }
  scheduleNonCritical(() => {
    ensureJarvisOrb().catch(console.error);
  }, 1600);
};

const emitCopySuccessToast = (message = "复制成功") => {
  if (typeof window.__flyNotifyCopySuccess === "function") {
    window.__flyNotifyCopySuccess(message);
    return;
  }
  window.dispatchEvent(new CustomEvent("fly:copy-success", { detail: { message } }));
};

const initGlobalCopyToast = () => {
  const host = document.getElementById("global-copy-toast");
  const notify = (message = "复制成功") => {
    window.dispatchEvent(new CustomEvent("fly:copy-success", { detail: { message } }));
  };
  window.__flyNotifyCopySuccess = notify;

  if (!(host instanceof HTMLElement)) return;
  const durationMs = Math.max(1000, Number.parseInt(host.dataset.durationMs || "1800", 10) || 1800);
  if (window.__flyCopyToastHandler) {
    window.removeEventListener("fly:copy-success", window.__flyCopyToastHandler);
  }

  const hide = () => {
    host.classList.remove("is-visible");
    host.setAttribute("aria-hidden", "true");
  };

  const show = (message) => {
    const text = String(message || "复制成功").trim() || "复制成功";
    host.textContent = text;
    host.classList.add("is-visible");
    host.setAttribute("aria-hidden", "false");
    if (window.__flyCopyToastTimer) {
      window.clearTimeout(window.__flyCopyToastTimer);
    }
    window.__flyCopyToastTimer = window.setTimeout(hide, durationMs);
  };

  window.__flyCopyToastHandler = (event) => {
    show(event?.detail?.message);
  };
  window.addEventListener("fly:copy-success", window.__flyCopyToastHandler);
};

const initFloatingSafeArea = () => {
  const update = () => {
    const footer = document.querySelector(".site-footer");
    if (!(footer instanceof HTMLElement)) {
      root.style.setProperty("--floating-safe-bottom", "0px");
      return;
    }
    const safe = footer.offsetHeight + 14;
    root.style.setProperty("--floating-safe-bottom", `${safe}px`);
  };
  window.requestAnimationFrame(update);
};

const initWallpaperSystem = () => {
  const host = document.getElementById("site-bg-image");
  if (!(host instanceof HTMLElement)) return;
  if (host.dataset.enabled !== "1") return;

  const image = document.getElementById("site-bg-image-el");
  if (!(image instanceof HTMLImageElement)) return;

  const storageKey = String(host.dataset.wallpaperStorageKey || "flycode-wallpaper-id");
  const displayWidth = Math.max(
    960,
    Number.parseInt(host.dataset.displayWidth || (isCompactViewport ? "1280" : "1600"), 10) || (isCompactViewport ? 1280 : 1600)
  );
  let wallpapers = [];
  try {
    const parsed = JSON.parse(host.dataset.wallpapers || "[]");
    wallpapers = Array.isArray(parsed) ? parsed : [];
  } catch {
    wallpapers = [];
  }
  if (!wallpapers.length) return;

  const normalized = wallpapers
    .map((item, index) => {
      const id = String(item?.id || `wallpaper-${index + 1}`).trim();
      const name = String(item?.name || `壁纸 ${index + 1}`).trim();
      const url = String(item?.url || "").trim();
      if (!id || !url) return null;
      return { id, name, url };
    })
    .filter(Boolean);
  if (!normalized.length) return;

  const getIndexById = (id) => normalized.findIndex((item) => item.id === id);
  const fallbackId = String(host.dataset.defaultWallpaper || normalized[0].id).trim() || normalized[0].id;

  const applyWallpaper = (id, persist = true, source = "base-layout") => {
    const index = getIndexById(id);
    const target = normalized[index >= 0 ? index : 0];
    const nextUrl = buildResponsiveImageUrl(target.url, displayWidth);
    const currentUrl = String(image.dataset.activeUrl || image.getAttribute("src") || "").trim();
    if (currentUrl !== nextUrl) {
      image.classList.add("is-switching");
      if (window.__flyWallpaperSwitchTimer) {
        window.clearTimeout(window.__flyWallpaperSwitchTimer);
      }
      window.__flyWallpaperSwitchTimer = window.setTimeout(() => {
        image.classList.remove("is-switching");
      }, 320);
    }
    image.src = nextUrl;
    image.dataset.activeUrl = nextUrl;
    host.dataset.activeWallpaper = target.id;
    root.dataset.wallpaperId = target.id;
    if (persist) {
      try {
        localStorage.setItem(storageKey, target.id);
      } catch {}
    }
    window.dispatchEvent(
      new CustomEvent("jarvis:wallpaper-updated", {
        detail: { id: target.id, name: target.name, url: target.url, source }
      })
    );
  };

  const getCurrentId = () => String(host.dataset.activeWallpaper || fallbackId).trim() || fallbackId;
  const nextWallpaper = (source = "base-layout") => {
    const current = getCurrentId();
    const currentIndex = getIndexById(current);
    const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % normalized.length;
    applyWallpaper(normalized[nextIndex].id, true, source);
  };
  const setWallpaper = (id, source = "base-layout") => {
    if (!String(id || "").trim()) return;
    applyWallpaper(String(id).trim(), true, source);
  };

  if (window.__flyWallpaperNextHandler) {
    window.removeEventListener("jarvis:wallpaper-next", window.__flyWallpaperNextHandler);
  }
  if (window.__flyWallpaperSetHandler) {
    window.removeEventListener("jarvis:wallpaper-set", window.__flyWallpaperSetHandler);
  }

  window.__flyWallpaperNextHandler = (event) => {
    nextWallpaper(String(event?.detail?.source || "").trim() || "external");
  };
  window.__flyWallpaperSetHandler = (event) => {
    setWallpaper(event?.detail?.id, String(event?.detail?.source || "").trim() || "external");
  };
  window.addEventListener("jarvis:wallpaper-next", window.__flyWallpaperNextHandler);
  window.addEventListener("jarvis:wallpaper-set", window.__flyWallpaperSetHandler);

  let selectedId = fallbackId;
  try {
    const cached = localStorage.getItem(storageKey);
    if (cached && getIndexById(cached) >= 0) selectedId = cached;
  } catch {}
  applyWallpaper(selectedId, false, "init");
};

const initLayoutOffsets = () => {
  const header = document.querySelector(".site-header");
  const footer = document.querySelector(".site-footer");
  const headerHeight = header instanceof HTMLElement ? header.offsetHeight : 68;
  const footerHeight = footer instanceof HTMLElement ? footer.offsetHeight : 54;
  root.style.setProperty("--layout-header-height", `${headerHeight}px`);
  root.style.setProperty("--layout-footer-height", `${footerHeight}px`);
};

const initSiteRuntime = () => {
  const host = document.getElementById("site-runtime");
  if (!(host instanceof HTMLElement)) return;

  const raw = String(host.dataset.runtimeSince || "").trim();
  const start = Date.parse(raw);
  if (!Number.isFinite(start)) {
    host.textContent = "已运行 -- 天 --:--:--";
    return;
  }

  const pad = (value) => String(value).padStart(2, "0");
  const render = () => {
    const elapsed = Math.max(0, Date.now() - start);
    const totalSeconds = Math.floor(elapsed / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    host.textContent = `已运行 ${days} 天 ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  };
  const intervalMs = isLowPerf || isCompactViewport ? 10000 : 1000;
  const stop = () => {
    if (window.__flyRuntimeTicker) {
      window.clearInterval(window.__flyRuntimeTicker);
      window.__flyRuntimeTicker = 0;
    }
  };
  const startTicker = () => {
    stop();
    render();
    window.__flyRuntimeTicker = window.setInterval(render, intervalMs);
  };
  window.__flyRuntimeStart = startTicker;
  window.__flyRuntimeStop = stop;
  startTicker();

  if (!window.__flyRuntimeVisibilityBound) {
    window.__flyRuntimeVisibilityBound = true;
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        window.__flyRuntimeStop?.();
      } else {
        window.__flyRuntimeStart?.();
      }
    });
  }
};

const initGlobalCodeCopy = () => {
  const icon =
    '<svg viewBox="0 0 24 24" width="14" height="14"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 8H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-2m-8-4h8a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2z"/></svg>';
  const success =
    '<svg viewBox="0 0 24 24" width="14" height="14"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 6 9 17l-5-5"/></svg>';

  const normalizeLanguageLabel = (rawLanguage) => {
    const raw = String(rawLanguage || "").trim().toLowerCase();
    if (!raw) return "txt";
    const tokens = raw.split(/\s+/);
    const looksLikeClassList = raw.includes("language-") || tokens.length > 1;
    let lang = "";
    if (looksLikeClassList) {
      for (const token of tokens) {
        const match = token.match(/^language-([a-z0-9+_#-]+)$/i);
        if (match?.[1]) {
          lang = match[1];
          break;
        }
      }
    } else {
      lang = raw;
    }
    lang = lang.trim();
    if (!lang) return "txt";
    if (lang === "plaintext" || lang === "plain" || lang === "text") return "txt";
    return lang;
  };

  const ensureLangLabel = (headerTitle, label, owner) => {
    if (!(headerTitle instanceof HTMLElement)) return;
    const languageLabel = normalizeLanguageLabel(label);
    const existingLabels = [...headerTitle.querySelectorAll(".code-block-lang")];
    if (existingLabels.length === 1 && existingLabels[0].textContent === languageLabel) {
      existingLabels[0].setAttribute("data-lang-label", "1");
      if (owner instanceof HTMLElement) {
        owner.dataset.langLabel = languageLabel;
      }
      return;
    }
    existingLabels.forEach((node) => node.remove());
    const langSpan = document.createElement("span");
    langSpan.className = "code-block-lang";
    langSpan.setAttribute("data-lang-label", "1");
    langSpan.textContent = languageLabel;
    headerTitle.appendChild(langSpan);
    if (owner instanceof HTMLElement) {
      owner.dataset.langLabel = languageLabel;
    }
  };

  const resolveLanguageLabel = (pre, code) => {
    if (!(pre instanceof HTMLElement)) return "";
    const raw = pre.getAttribute("data-language") || code?.getAttribute("data-language") || pre.className || "";
    return normalizeLanguageLabel(raw);
  };

  const copy = async (button, text) => {
    try {
      await navigator.clipboard.writeText(text);
      button.innerHTML = success;
      button.classList.add("copied");
      emitCopySuccessToast("复制成功");
      window.setTimeout(() => {
        button.innerHTML = icon;
        button.classList.remove("copied");
      }, 1800);
    } catch (error) {
      console.error("global pre copy failed", error);
    }
  };

  const ensureCodeBlockMeta = (header) => {
    let meta = header.querySelector(":scope > .code-block-meta");
    if (!(meta instanceof HTMLElement)) {
      meta = document.createElement("div");
      meta.className = "code-block-meta";
      header.appendChild(meta);
    }
    return meta;
  };

  const ensureCodeBlockTitle = (header) => {
    let title = header.querySelector(":scope > .code-block-title");
    if (!(title instanceof HTMLElement)) {
      title = document.createElement("div");
      title.className = "code-block-title";
      header.insertBefore(title, header.firstChild);
    }
    return title;
  };

  const findDirectCopyWrap = (frame) => {
    for (const child of Array.from(frame.children)) {
      if (child instanceof HTMLElement && child.classList.contains("copy")) return child;
    }
    return null;
  };

  const getExpressiveCodeText = (pre) => {
    const codeNode = pre.querySelector("code");
    return (codeNode?.textContent || pre.textContent || "").trim();
  };

  const enhanceExpressiveCodeFrames = () => {
    const frames = [...document.querySelectorAll(".expressive-code figure.frame")].filter(
      (frame) => frame instanceof HTMLElement
    );
    for (const frame of frames) {
      if (!(frame instanceof HTMLElement)) continue;
      if (frame.closest(".article-body")) continue;

      const caption = frame.querySelector("figcaption.header");
      const pre = frame.querySelector("pre");
      if (!(caption instanceof HTMLElement) || !(pre instanceof HTMLElement)) continue;

      const headerMeta = ensureCodeBlockMeta(caption);
      const headerTitle = ensureCodeBlockTitle(caption);

      const preLang =
        pre.getAttribute("data-language") ||
        pre.dataset.language ||
        pre.className.match(/language-([a-z0-9+_#-]+)/i)?.[1] ||
        "";
      const languageLabel = normalizeLanguageLabel(preLang);

      headerMeta.querySelectorAll(":scope > .code-block-lang").forEach((node) => node.remove());
      ensureLangLabel(headerTitle, languageLabel, frame);
      frame.classList.add("has-title");

      let copyWrap =
        findDirectCopyWrap(frame) ||
        caption.querySelector(":scope .copy.code-block-copy-wrap, :scope .code-block-copy-wrap, :scope .copy");
      let copyReady = false;

      if (!(copyWrap instanceof HTMLElement)) {
        copyWrap = document.createElement("div");
        copyWrap.className = "copy code-block-copy-wrap";
        const live = document.createElement("div");
        live.setAttribute("aria-live", "polite");
        copyWrap.appendChild(live);

        const button = document.createElement("button");
        button.type = "button";
        button.className = "code-block-copy";
        button.title = "复制代码";
        button.setAttribute("aria-label", "复制代码");
        button.innerHTML = icon;
        button.addEventListener("click", () => {
          const text = getExpressiveCodeText(pre);
          if (!text) return;
          copy(button, text);
        });
        copyWrap.appendChild(button);
        copyReady = true;
      } else {
        copyReady = true;
        copyWrap.classList.add("code-block-copy-wrap", "copy");
        const copyButton = copyWrap.querySelector("button");
        if (copyButton instanceof HTMLButtonElement) {
          copyButton.classList.add("code-block-copy");
          copyButton.title = "复制代码";
          copyButton.setAttribute("aria-label", "复制代码");
        }
      }

      if (copyWrap instanceof HTMLElement && copyWrap.parentElement !== headerMeta) {
        headerMeta.appendChild(copyWrap);
      }
      if (headerTitle.childElementCount === 0) {
        headerTitle.remove();
      }

      frame.dataset.langLabelInitialized = copyReady ? "1" : "0";
    }
  };

  document.querySelectorAll("main pre").forEach((pre) => {
    if (!(pre instanceof HTMLElement)) return;
    if (pre.closest(".article-body")) return;
    if (pre.closest(".expressive-code")) return;
    if (pre.closest(".code-block-wrapper")) return;

    const code = pre.querySelector("code");
    const text = (code?.textContent || pre.textContent || "").trim();
    if (!text) return;

    const wrapper = document.createElement("div");
    wrapper.className = "code-block-wrapper";
    wrapper.dataset.window = "mac";
    wrapper.dataset.provider = String(root.dataset.codeHighlightProvider || "prism").toLowerCase();
    pre.parentNode?.insertBefore(wrapper, pre);
    wrapper.appendChild(pre);

    const header = document.createElement("div");
    header.className = "code-block-header";
    const headerTitle = document.createElement("div");
    headerTitle.className = "code-block-title";
    const headerMeta = document.createElement("div");
    headerMeta.className = "code-block-meta";

    const lang = resolveLanguageLabel(pre, code);
    ensureLangLabel(headerTitle, lang, wrapper);
    header.appendChild(headerTitle);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "code-block-copy";
    button.title = "复制代码";
    button.setAttribute("aria-label", "复制代码");
    button.innerHTML = icon;
    button.addEventListener("click", () => copy(button, text));
    headerMeta.appendChild(button);

    header.appendChild(headerMeta);
    wrapper.insertBefore(header, pre);
  });

  enhanceExpressiveCodeFrames();
};

const PREFETCHABLE_ROUTE_EXT = /\.(?:png|apng|gif|jpe?g|webp|avif|svg|ico|css|js|mjs|map|json|xml|txt|zip|rar|7z|pdf|mp4|webm|mp3|wav)$/i;
const prefetchedUrls = new Set();

const canPrefetchLink = (anchor) => {
  if (!prefetchEnabled || isLowPerf) return false;
  if (!(anchor instanceof HTMLAnchorElement)) return false;
  if (anchor.target === "_blank" || anchor.hasAttribute("download")) return false;
  if (anchor.dataset.noPrefetch === "1") return false;

  const rawHref = String(anchor.getAttribute("href") || "").trim();
  if (!rawHref) return false;
  if (
    rawHref.startsWith("#") ||
    rawHref.startsWith("mailto:") ||
    rawHref.startsWith("tel:") ||
    rawHref.startsWith("javascript:")
  ) {
    return false;
  }

  let url;
  try {
    url = new URL(anchor.href, window.location.href);
  } catch {
    return false;
  }
  if (url.origin !== window.location.origin) return false;
  if (url.pathname.startsWith("/api/")) return false;
  if (PREFETCHABLE_ROUTE_EXT.test(url.pathname)) return false;
  if (url.pathname === window.location.pathname && url.search === window.location.search) return false;

  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const saveData = Boolean(connection && connection.saveData);
  const effectiveType = String(connection?.effectiveType || "");
  if (saveData || effectiveType.includes("2g")) return false;

  return true;
};

const prefetchLink = (anchor) => {
  if (!canPrefetchLink(anchor)) return;

  const targetUrl = new URL(anchor.href, window.location.href);
  targetUrl.hash = "";
  const normalized = targetUrl.toString();
  if (prefetchedUrls.has(normalized)) return;
  prefetchedUrls.add(normalized);

  fetch(normalized, {
    method: "GET",
    credentials: "same-origin",
    mode: "same-origin"
  }).catch(() => {
    prefetchedUrls.delete(normalized);
  });
};

const bindLinkPrefetch = () => {
  if (!prefetchEnabled || isLowPerf) return;
  if (window.__flyLinkPrefetchBound) return;
  window.__flyLinkPrefetchBound = true;

  const resolveAnchor = (target) => {
    if (!(target instanceof Element)) return null;
    const anchor = target.closest("a[href]");
    return anchor instanceof HTMLAnchorElement ? anchor : null;
  };

  const handlePointerOver = (event) => {
    if (event.pointerType === "touch") return;
    const anchor = resolveAnchor(event.target);
    if (anchor) prefetchLink(anchor);
  };

  const handleTouchStart = (event) => {
    const touchTarget = event.targetTouches?.[0]?.target || event.target;
    const anchor = resolveAnchor(touchTarget);
    if (anchor) prefetchLink(anchor);
  };

  const handleFocusIn = (event) => {
    const anchor = resolveAnchor(event.target);
    if (anchor) prefetchLink(anchor);
  };

  window.__flyLinkPrefetchPointerOver = handlePointerOver;
  window.__flyLinkPrefetchTouchStart = handleTouchStart;
  window.__flyLinkPrefetchFocusIn = handleFocusIn;
  document.addEventListener("pointerover", handlePointerOver, { passive: true });
  document.addEventListener("touchstart", handleTouchStart, { passive: true });
  document.addEventListener("focusin", handleFocusIn, { passive: true });
};

const boot = () => {
  document.body.classList.remove("has-overlay");
  for (const dialog of document.querySelectorAll("dialog[open]")) {
    if (dialog instanceof HTMLDialogElement) {
      try {
        dialog.close();
      } catch {}
    }
  }

  initGlobalCopyToast();
  initLayoutOffsets();
  initFloatingSafeArea();
  bindLinkPrefetch();
  bindSearchBootstrap();
  scheduleNonCritical(initGlobalCodeCopy, 900);
  scheduleNonCritical(initWallpaperSystem, 1800);
  scheduleNonCritical(initSiteRuntime, 1200);
  scheduleJarvisOrb();
  if (window.__flySearchModalReady) {
    scheduleNonCritical(() => {
      ensureSearchModal().catch(console.error);
    }, 600);
  }
};

document.addEventListener("astro:page-load", boot);
if (!window.__flyLayoutOffsetBound) {
  window.__flyLayoutOffsetBound = true;
  let resizeTicking = false;
  const handleResize = () => {
    if (resizeTicking) return;
    resizeTicking = true;
    window.requestAnimationFrame(() => {
      resizeTicking = false;
      initLayoutOffsets();
      initFloatingSafeArea();
    });
  };
  window.addEventListener("resize", handleResize, { passive: true });
  window.visualViewport?.addEventListener("resize", handleResize, { passive: true });
}
boot();

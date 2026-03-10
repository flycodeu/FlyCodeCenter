export function initArticleRuntime(config = {}) {
  const {
    isEncrypted = false,
    enableMermaid = false,
    enableDrawio = false,
    enableEcharts = false,
    mermaidSource = "cdn",
    mermaidBundle = "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs",
    mermaidLocalBundle = "/vendor/diagram/mermaid.esm.min.mjs",
    mermaidTheme = "default",
    drawioViewerBase = "https://viewer.diagrams.net",
    echartsSource = "cdn",
    echartsBundle = "https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.esm.min.js",
    echartsLocalBundle = "/vendor/diagram/echarts.esm.min.js",
    diagramFallbackToCdn = true,
    chartHeight = 360,
    enableEchartsThemeSync = false,
    enableCodeCopy = true,
    enableMathCopy = true,
    enableMermaidCopy = true,
    enableExtendedMarkdown = false,
    enableChartJs = false,
    chartJsBundle = "https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js",
    enableChartJsThemeSync = false,
    enableInlineIcon = false,
    iconifyBundle = "https://code.iconify.design/iconify-icon/2.1.0/iconify-icon.min.js",
    enableCodeFold = false,
    codeFoldDefaultLines = 18,
    enableCodeGroup = false,
    enableAnchorCopy = false,
    enableDiffEnhance = false,
    enableDiagramDiagnostics = true,
    codeHighlightProvider = "prism",
    enableCodeLineNumbers = true,
    codeWindowTitleMode = "lang",
    articleTitle = "",
    articleTags = [],
    viewStatsEnabled = false,
    viewStatsEndpoint = "/api/views",
    antiCrawlEnabled = false,
    antiCrawlLockOnSuspicious = true,
    antiCrawlMaxCopyActions = 8,
    antiCrawlTimeWindowMs = 20000
  } = config;
  const root = document.documentElement;
  root.dataset.encryptedLocked = isEncrypted ? "1" : "0";
  root.dataset.antiCrawlLocked = "0";
  const activeHighlightProvider = String(
    codeHighlightProvider || root.dataset.codeHighlightProvider || "prism"
  ).toLowerCase();
  const isExpressiveProvider = activeHighlightProvider === "expressive";
  const isLowPerf = root.dataset.perf === "low";
  const isCompactViewport = window.matchMedia("(max-width: 1024px)").matches;

    const BOT_UA_PATTERN = /(bot|crawler|spider|headless|puppeteer|playwright|selenium|phantom|scrapy|curl|wget)/i;
    const antiCrawlEvents = [];
    let antiCrawlLocked = false;

    const lockByAntiCrawl = (reason) => {
      if (!antiCrawlEnabled || antiCrawlLocked) return;
      antiCrawlLocked = true;
      root.dataset.antiCrawlLocked = "1";
      document.body.classList.add("anti-crawl-locked");

      const article = document.querySelector(".article-body");
      if (article instanceof HTMLElement) {
        article.innerHTML = `
          <section class="anti-crawl-lock" role="alert">
            <h2>访问已受限</h2>
            <p>检测到异常抓取行为，本文已临时禁止访问。</p>
            <p class="anti-crawl-reason">原因: ${reason}</p>
          </section>
        `;
      }
    };

    const markAntiCrawlAction = (name) => {
      if (!antiCrawlEnabled || !antiCrawlLockOnSuspicious || antiCrawlLocked) return;
      const now = Date.now();
      antiCrawlEvents.push(now);
      while (antiCrawlEvents.length && now - antiCrawlEvents[0] > antiCrawlTimeWindowMs) {
        antiCrawlEvents.shift();
      }
      if (antiCrawlEvents.length >= antiCrawlMaxCopyActions) {
        lockByAntiCrawl(`high-frequency-${name}`);
      }
    };

    if (antiCrawlEnabled) {
      const ua = navigator.userAgent || "";
      const isWebdriver = Boolean(navigator.webdriver);
      const isSuspiciousUa = BOT_UA_PATTERN.test(ua);

      if (antiCrawlLockOnSuspicious && (isWebdriver || isSuspiciousUa)) {
        lockByAntiCrawl(isWebdriver ? "webdriver" : "suspicious-ua");
      }

      const trackSensitiveAction = (event, action) => {
        if (antiCrawlLocked) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        markAntiCrawlAction(action);
      };

      document.addEventListener("copy", (event) => trackSensitiveAction(event, "copy"), { capture: true });
      document.addEventListener("cut", (event) => trackSensitiveAction(event, "cut"), { capture: true });
      document.addEventListener("contextmenu", (event) => trackSensitiveAction(event, "contextmenu"), { capture: true });
      document.addEventListener("selectstart", (event) => trackSensitiveAction(event, "selectstart"), { capture: true });

      document.addEventListener(
        "keydown",
        (event) => {
          if (antiCrawlLocked) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          if (!event.ctrlKey && !event.metaKey) return;
          const hotkey = event.key.toLowerCase();
          if (hotkey === "c" || hotkey === "s" || hotkey === "u" || hotkey === "p") {
            markAntiCrawlAction(`hotkey-${hotkey}`);
          }
        },
        { capture: true }
      );
    }

    if (isEncrypted) {
      window.addEventListener("site:decrypted", () => {
        root.dataset.encryptedLocked = "0";
        initArticleEnhancements().catch(console.error);
      });
    }

    const copyIcon = '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 8H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-2m-8-4h8a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2z"/></svg>';
    const successIcon = '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 6 9 17l-5-5"/></svg>';
    const emitCopySuccessToast = (message = "复制成功") => {
      if (typeof window.__flyNotifyCopySuccess === "function") {
        window.__flyNotifyCopySuccess(message);
        return;
      }
      window.dispatchEvent(new CustomEvent("fly:copy-success", { detail: { message } }));
    };

    const copyWithFeedback = async (btn, text) => {
      try {
        await navigator.clipboard.writeText(text);
        btn.classList.add("copied");
        btn.innerHTML = successIcon;
        emitCopySuccessToast("复制成功");
        setTimeout(() => {
          btn.classList.remove("copied");
          btn.innerHTML = copyIcon;
        }, 1800);
      } catch (error) {
        console.error("copy failed", error);
      }
    };

    const createCopyBtn = (className, title, contentProvider) => {
      const btn = document.createElement("button");
      btn.className = className;
      btn.type = "button";
      btn.title = title;
      btn.innerHTML = copyIcon;
      btn.addEventListener("click", () => {
        copyWithFeedback(btn, contentProvider());
      });
      return btn;
    };

    const scheduleIdle = (task) => {
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(task, { timeout: 500 });
      } else {
        window.setTimeout(() => task({ timeRemaining: () => 8 }), 20);
      }
    };

    const getLanguage = (code) => {
      const pre = code.closest("pre");
      const raw =
        pre?.getAttribute("data-language") ||
        code.getAttribute("data-language") ||
        code.className ||
        "";
      const match = raw.match(/language-([a-z0-9+_#-]+)/i);
      return (match?.[1] || raw).toLowerCase();
    };
    const isInsideDemoSource = (code) => code instanceof HTMLElement && Boolean(code.closest(".md-demo-source"));
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
    const removeLangLabel = (headerTitle, owner) => {
      if (!(headerTitle instanceof HTMLElement)) return;
      headerTitle.querySelectorAll(".code-block-lang").forEach((node) => node.remove());
      if (owner instanceof HTMLElement) {
        delete owner.dataset.langLabel;
      }
      if (headerTitle.childElementCount === 0) {
        headerTitle.remove();
      }
    };
    const decodeHtmlEntities = (raw) => {
      const text = String(raw || "");
      if (!text.includes("&")) return text;
      const parser = document.createElement("textarea");
      parser.innerHTML = text;
      return parser.value;
    };
    const normalizeCodeRaw = (raw) =>
      String(raw || "")
        .replace(/\u007f/g, "\n")
        .replace(/\u00a0/g, " ")
        .replace(/\r\n?/g, "\n")
        .trim();
    const stripFencedCode = (raw) => {
      const text = normalizeCodeRaw(raw);
      if (!text.startsWith("```")) return text;
      const lines = text.split("\n");
      if (!lines.length) return text;
      if (!String(lines[0] || "").trim().startsWith("```")) return text;
      lines.shift();
      if (lines.length && String(lines[lines.length - 1] || "").trim() === "```") {
        lines.pop();
      }
      return normalizeCodeRaw(lines.join("\n"));
    };
    const extractCodeRaw = (code) => {
      if (!(code instanceof HTMLElement)) return "";

      // expressive-code stores the original source in button[data-code]
      const frame = code.closest(".expressive-code .frame");
      if (frame instanceof HTMLElement) {
        const copyButton = frame.querySelector("button[data-code]");
        if (copyButton instanceof HTMLButtonElement) {
          const fromData = stripFencedCode(
            decodeHtmlEntities(copyButton.dataset.code || copyButton.getAttribute("data-code") || "")
          );
          if (fromData) return fromData;
        }

        // fallback: reconstruct from rendered lines
        const expressiveLines = [...frame.querySelectorAll(".ec-line .code")]
          .map((line) => line.textContent || "")
          .join("\n");
        const reconstructed = stripFencedCode(expressiveLines);
        if (reconstructed) return reconstructed;
      }

      return stripFencedCode(code.textContent || "");
    };
    const parseChartOption = (raw) => {
      const text = stripFencedCode(decodeHtmlEntities(raw));
      if (!text || !text.startsWith("{")) return null;
      try {
        const parsed = JSON.parse(text);
        if (!parsed || typeof parsed !== "object") return null;
        const hasSeries = Array.isArray(parsed.series) || Object.prototype.hasOwnProperty.call(parsed, "series");
        const hasAxes = Object.prototype.hasOwnProperty.call(parsed, "xAxis") || Object.prototype.hasOwnProperty.call(parsed, "yAxis");
        if (!hasSeries && !hasAxes) return null;
        return parsed;
      } catch {
        return null;
      }
    };
    const normalizeSmartQuotes = (input) =>
      String(input || "")
        .replace(/[\u201c\u201d\u2033\uff02]/g, "\"")
        .replace(/[\u2018\u2019\u2032\uff07]/g, "'");
    const DEMO_OPEN_LINE = /^\[demo\b([^\]]*)\]\s*$/i;
    const DEMO_CLOSE_LINE = /^\[\/demo\]\s*$/i;
    const SHORTCODE_ATTR = /([a-z][\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=]+))/gi;
    const parseShortcodeAttributes = (rawAttrs) => {
      const attrs = {};
      const normalizedAttrs = normalizeSmartQuotes(rawAttrs);
      SHORTCODE_ATTR.lastIndex = 0;
      let match;
      while ((match = SHORTCODE_ATTR.exec(normalizedAttrs)) !== null) {
        const key = String(match[1] || "").trim().toLowerCase();
        if (!key) continue;
        attrs[key] = String(match[2] ?? match[3] ?? match[4] ?? "").trim();
      }
      return attrs;
    };
    const extractNodeTextWithBreaks = (node) => {
      if (!(node instanceof HTMLElement)) return "";
      const clone = node.cloneNode(true);
      if (!(clone instanceof HTMLElement)) return "";
      clone.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
      return normalizeSmartQuotes((clone.textContent || "").replace(/\u00a0/g, " ").replace(/\r\n?/g, "\n")).trim();
    };
    const splitParagraphLines = (node) => {
      const text = extractNodeTextWithBreaks(node);
      if (!text) return [];
      return text.split("\n");
    };
    const parseDemoOpenNode = (node) => {
      if (!(node instanceof HTMLParagraphElement)) return null;
      const lines = splitParagraphLines(node);
      for (let idx = 0; idx < lines.length; idx += 1) {
        const line = String(lines[idx] || "").trim();
        const match = line.match(DEMO_OPEN_LINE);
        if (!match) continue;
        const leading = lines.slice(0, idx).join("\n").trim();
        const trailing = lines.slice(idx + 1).join("\n").trim();
        const note = [leading, trailing].filter(Boolean).join("\n\n").trim();
        return { attrsRaw: String(match[1] || ""), note };
      }
      return null;
    };
    const parseDemoCloseNode = (node) => {
      if (!(node instanceof HTMLParagraphElement)) return null;
      const lines = splitParagraphLines(node);
      for (let idx = 0; idx < lines.length; idx += 1) {
        const line = String(lines[idx] || "").trim();
        if (!DEMO_CLOSE_LINE.test(line)) continue;
        return {
          before: lines.slice(0, idx).join("\n").trim(),
          after: lines.slice(idx + 1).join("\n").trim()
        };
      }
      return null;
    };
    const findDemoCodeBlock = (node) => {
      if (!(node instanceof HTMLElement)) return null;
      if (node.matches(".expressive-code, .code-block-wrapper, pre")) return node;
      const nested = node.querySelector(".expressive-code, .code-block-wrapper, pre");
      return nested instanceof HTMLElement ? nested : null;
    };
    const inferCodeLanguageFromBlock = (block) => {
      if (!(block instanceof HTMLElement)) return "text";
      const pre = block.matches("pre") ? block : block.querySelector("pre");
      if (!(pre instanceof HTMLElement)) return "text";
      const raw = String(pre.getAttribute("data-language") || "").trim();
      if (raw) return normalizeLanguageLabel(raw);
      const code = pre.querySelector("code");
      if (code instanceof HTMLElement) {
        const match = String(code.className || "").match(/language-([a-z0-9+_#-]+)/i);
        if (match?.[1]) return normalizeLanguageLabel(match[1]);
      }
      return "text";
    };
    const appendDemoNote = (container, noteText) => {
      const normalized = String(noteText || "").trim();
      if (!normalized) return;
      const noteWrap = document.createElement("div");
      noteWrap.className = "md-demo-note";
      normalized
        .split(/\n{2,}/)
        .map((block) => block.trim())
        .filter(Boolean)
        .forEach((block) => {
          const p = document.createElement("p");
          p.textContent = block;
          noteWrap.appendChild(p);
        });
      if (noteWrap.childElementCount) {
        container.appendChild(noteWrap);
      }
    };
    const transformDemoShortcodes = (article) => {
      if (!enableExtendedMarkdown) return;
      if (!(article instanceof HTMLElement)) return;
      if (article.dataset.demoShortcodeEnhanced === "1") return;
      article.dataset.demoShortcodeEnhanced = "1";

      let node = article.firstElementChild;
      while (node) {
        const next = node.nextElementSibling;
        const demoOpen = parseDemoOpenNode(node);
        if (!demoOpen) {
          node = next;
          continue;
        }

        const consumed = [node];
        const noteParts = [];
        if (demoOpen.note) noteParts.push(demoOpen.note);
        let sourceBlock = null;
        let closeNode = null;
        let cursor = node.nextElementSibling;

        while (cursor) {
          consumed.push(cursor);
          if (!sourceBlock) {
            sourceBlock = findDemoCodeBlock(cursor);
          }
          const close = parseDemoCloseNode(cursor);
          if (close) {
            if (close.before) noteParts.push(close.before);
            closeNode = cursor;
            break;
          }
          if (!findDemoCodeBlock(cursor)) {
            const text = extractNodeTextWithBreaks(cursor);
            if (text) noteParts.push(text);
          }
          cursor = cursor.nextElementSibling;
        }

        if (!(closeNode instanceof HTMLElement) || !(sourceBlock instanceof HTMLElement)) {
          node = next;
          continue;
        }

        const attrs = parseShortcodeAttributes(demoOpen.attrsRaw);
        const mode = String(attrs.mode || "").trim().toLowerCase() === "stack" ? "stack" : "split";
        const result = String(attrs.result || "").trim().toLowerCase() === "force" ? "force" : "auto";
        const title = String(attrs.title || "").trim();
        const lang = normalizeLanguageLabel(attrs.lang || inferCodeLanguageFromBlock(sourceBlock) || "text");

        const demo = document.createElement("section");
        demo.className = "md-demo";
        demo.dataset.mode = mode;
        demo.dataset.result = result;
        demo.dataset.demoLang = lang;

        if (title) {
          const head = document.createElement("header");
          head.className = "md-demo-head";
          head.textContent = title;
          demo.appendChild(head);
        }

        const body = document.createElement("div");
        body.className = "md-demo-body";
        const source = document.createElement("section");
        source.className = "md-demo-source";
        const sourceLabel = document.createElement("div");
        sourceLabel.className = "md-demo-label";
        sourceLabel.textContent = "语法写法";
        source.appendChild(sourceLabel);
        source.appendChild(sourceBlock.cloneNode(true));

        const preview = document.createElement("section");
        preview.className = "md-demo-preview";
        preview.dataset.result = result;
        const previewLabel = document.createElement("div");
        previewLabel.className = "md-demo-label";
        previewLabel.textContent = "效果展示";
        preview.appendChild(previewLabel);
        preview.appendChild(sourceBlock.cloneNode(true));
        appendDemoNote(preview, noteParts.join("\n\n"));

        body.appendChild(source);
        body.appendChild(preview);
        demo.appendChild(body);

        node.before(demo);
        consumed.forEach((item) => item.remove());
        node = demo.nextElementSibling;
      }
    };

    const isMermaidBlock = (code) => {
      const language = getLanguage(code);
      if (language.includes("mermaid")) return true;
      const raw = extractCodeRaw(code);
      return /^(flowchart|graph|sequencediagram|classdiagram|statediagram|erdiagram|gantt|journey|gitgraph|pie|mindmap|timeline|quadrantchart|requirementdiagram|c4context|c4container|c4component|c4dynamic|c4deployment)\b/i.test(
        raw
      );
    };

    const isDrawioBlock = (code) => {
      const raw = extractCodeRaw(code);
      const language = getLanguage(code);
      if (language.includes("drawio")) return true;
      return /^https?:\/\/\S+\.drawio(\?.*)?$/i.test(raw);
    };

    const isChartBlock = (code) => {
      const raw = extractCodeRaw(code);
      const language = getLanguage(code);
      if (language.includes("chart") || language.includes("echarts")) return true;
      const maybeJsonLike = ["json", "plain", "plaintext", "txt", "text"].some((token) => language.includes(token));
      if (!maybeJsonLike) return false;
      return Boolean(parseChartOption(raw));
    };

    const normalizeSourceMode = (value) => {
      const mode = String(value || "cdn").trim().toLowerCase();
      return mode === "local" ? "local" : "cdn";
    };
    const mermaidSourceMode = normalizeSourceMode(mermaidSource);
    const echartsSourceMode = normalizeSourceMode(echartsSource);
    const loadModuleBySource = async ({
      localMode = false,
      localUrl = "",
      cdnUrl = "",
      allowFallback = true,
      label = "module"
    }) => {
      const loadFrom = (url) => import(/* @vite-ignore */ url).then((mod) => mod.default ?? mod);
      if (localMode) {
        if (localUrl) {
          try {
            return await loadFrom(localUrl);
          } catch (localError) {
            if (!allowFallback || !cdnUrl) throw localError;
            try {
              return await loadFrom(cdnUrl);
            } catch (cdnError) {
              const merged = new Error(
                `${label} local+cdn load failed: ${String(localError?.message || localError)} | ${String(
                  cdnError?.message || cdnError
                )}`
              );
              throw merged;
            }
          }
        }
        if (!cdnUrl) {
          throw new Error(`${label} local source enabled but local bundle is empty`);
        }
      }
      if (!cdnUrl) {
        throw new Error(`${label} cdn bundle is empty`);
      }
      return loadFrom(cdnUrl);
    };

    let mermaidRenderIndex = 0;
    let mermaidApiPromise = null;
    const getMermaidApi = async () => {
      if (!mermaidApiPromise) {
        mermaidApiPromise = loadModuleBySource({
          localMode: mermaidSourceMode === "local",
          localUrl: mermaidLocalBundle,
          cdnUrl: mermaidBundle,
          allowFallback: Boolean(diagramFallbackToCdn),
          label: "mermaid"
        }).then((mermaid) => {
          mermaid.initialize({ startOnLoad: false, theme: mermaidTheme });
          return mermaid;
        });
      }
      return mermaidApiPromise;
    };

    let echartsApiPromise = null;
    const echartsRecords = [];
    let chartResizeBound = false;
    let chartJsApiPromise = null;
    const chartJsInstances = [];
    const chartJsThemeApplied = new WeakSet();
    const getEchartsApi = async () => {
      if (!echartsApiPromise) {
        echartsApiPromise = loadModuleBySource({
          localMode: echartsSourceMode === "local",
          localUrl: echartsLocalBundle,
          cdnUrl: echartsBundle,
          allowFallback: Boolean(diagramFallbackToCdn),
          label: "echarts"
        });
      }
      return echartsApiPromise;
    };

    const getChartJsApi = async () => {
      if (chartJsApiPromise) return chartJsApiPromise;
      chartJsApiPromise = new Promise((resolve, reject) => {
        if (window.Chart) {
          resolve(window.Chart);
          return;
        }
        const script = document.createElement("script");
        script.src = chartJsBundle;
        script.async = true;
        script.onload = () => {
          if (window.Chart) resolve(window.Chart);
          else reject(new Error("Chart.js global missing"));
        };
        script.onerror = () => reject(new Error("Chart.js load failed"));
        document.head.appendChild(script);
      });
      return chartJsApiPromise;
    };
    const getThemeMode = () => {
      const current = String(root.dataset.theme || "").toLowerCase();
      return current.includes("dark") ? "dark" : "light";
    };
    const getEchartsTheme = () => {
      if (!enableEchartsThemeSync) return undefined;
      return getThemeMode() === "dark" ? "dark" : undefined;
    };
    const getChartPalette = () => {
      const dark = getThemeMode() === "dark";
      return {
        text: dark ? "#dbe5f4" : "#334155",
        grid: dark ? "rgba(148, 163, 184, 0.22)" : "rgba(100, 116, 139, 0.2)",
        ticks: dark ? "#cbd5e1" : "#475569"
      };
    };
    const applyChartJsThemeDefaults = (config, force = false) => {
      if (!enableChartJsThemeSync || !config || typeof config !== "object") return;
      const palette = getChartPalette();
      config.options = config.options || {};
      config.options.plugins = config.options.plugins || {};
      config.options.plugins.legend = config.options.plugins.legend || {};
      config.options.plugins.legend.labels = config.options.plugins.legend.labels || {};
      if (force || typeof config.options.plugins.legend.labels.color === "undefined") {
        config.options.plugins.legend.labels.color = palette.text;
      }
      config.options.scales = config.options.scales || {};
      Object.keys(config.options.scales).forEach((key) => {
        const axis = config.options.scales[key] || {};
        axis.ticks = axis.ticks || {};
        axis.grid = axis.grid || {};
        if (force || typeof axis.ticks.color === "undefined") axis.ticks.color = palette.ticks;
        if (force || typeof axis.grid.color === "undefined") axis.grid.color = palette.grid;
        config.options.scales[key] = axis;
      });
    };
    const refreshEchartsTheme = async () => {
      if (!enableEchartsThemeSync || !echartsRecords.length) return;
      const echarts = await getEchartsApi();
      const theme = getEchartsTheme();
      echartsRecords.forEach((record) => {
        try {
          record.chart?.dispose?.();
          const next = echarts.init(record.host, theme);
          next.setOption(record.option, true);
          record.chart = next;
        } catch (error) {
          console.error("echarts theme refresh failed", error);
        }
      });
    };
    const refreshChartJsTheme = () => {
      if (!enableChartJsThemeSync || !chartJsInstances.length) return;
      chartJsInstances.forEach((chart) => {
        if (!chartJsThemeApplied.has(chart)) return;
        try {
          const options = chart.options || {};
          applyChartJsThemeDefaults({ options }, true);
          chart.update("none");
        } catch (error) {
          console.error("chartjs theme refresh failed", error);
        }
      });
    };

    const bindChartResize = () => {
      if (chartResizeBound) return;
      chartResizeBound = true;
      window.addEventListener("resize", () => {
        echartsRecords.forEach((record) => {
          try {
            record.chart?.resize?.();
          } catch {
            // no-op
          }
        });
        chartJsInstances.forEach((chart) => {
          try {
            chart.resize();
          } catch {
            // no-op
          }
        });
      });
    };
    const getErrorMessage = (error, fallback) => {
      if (error instanceof Error && error.message) return error.message;
      return fallback;
    };
    const renderDiagramDiagnostic = (host, { title, detail, raw, hints = [] }) => {
      if (!(host instanceof HTMLElement)) return;
      if (!enableDiagramDiagnostics) {
        host.textContent = title;
        return;
      }
      host.innerHTML = "";
      host.classList.add("diagram-diagnostic-host");

      const panel = document.createElement("section");
      panel.className = "diagram-diagnostic";

      const heading = document.createElement("h4");
      heading.className = "diagram-diagnostic-title";
      heading.textContent = title;
      panel.appendChild(heading);

      if (detail) {
        const detailNode = document.createElement("p");
        detailNode.className = "diagram-diagnostic-detail";
        detailNode.textContent = `详情: ${detail}`;
        panel.appendChild(detailNode);
      }

      if (Array.isArray(hints) && hints.length) {
        const list = document.createElement("ul");
        list.className = "diagram-diagnostic-hints";
        hints.forEach((hint) => {
          const item = document.createElement("li");
          item.textContent = hint;
          list.appendChild(item);
        });
        panel.appendChild(list);
      }

      if (raw) {
        const source = document.createElement("pre");
        source.className = "diagram-diagnostic-source";
        source.textContent = raw;
        panel.appendChild(source);
      }

      host.appendChild(panel);
    };

    const renderMermaidBlock = async (code) => {
      const pre = code.closest("pre");
      if (!pre || pre.dataset.diagramEnhanced === "1") return;
      pre.dataset.diagramEnhanced = "1";
      const raw = extractCodeRaw(code);

      const wrapper = document.createElement("div");
      wrapper.className = "diagram-wrapper";

      wrapper.appendChild(createCopyBtn("diagram-copy-btn", "复制 Mermaid 源码", () => raw));

      const host = document.createElement("div");
      host.className = "diagram-host mermaid-host";
      wrapper.appendChild(host);
      pre.replaceWith(wrapper);

      try {
        const mermaid = await getMermaidApi();
        const result = await mermaid.render(`mermaid-${mermaidRenderIndex++}`, raw);
        host.innerHTML = result.svg;
      } catch (error) {
        renderDiagramDiagnostic(host, {
          title: "Mermaid 渲染失败，请检查语法。",
          detail: getErrorMessage(error, "unknown mermaid error"),
          raw,
          hints: [
            "确认代码块语言为 mermaid。",
            "检查流程图语法和缩进。",
            "若使用 local source，请确认 mermaid localBundle 路径可访问。",
            "若仍失败，请检查 Mermaid 资源加载。"
          ]
        });
        console.error(error);
      }
    };

    const addMathCopy = (article) => {
      if (!enableMathCopy) return;
      const displays = article.querySelectorAll(".katex-display");
      displays.forEach((display) => {
        if (display.querySelector(".math-copy-btn")) return;
        const annotation = display.querySelector("annotation[encoding='application/x-tex']");
        if (!annotation) return;
        const raw = annotation.textContent || "";
        display.classList.add("math-wrapper");
        display.appendChild(createCopyBtn("math-copy-btn", "复制公式源码", () => raw));
      });
    };

    const renderDrawioBlock = async (code) => {
      const pre = code.closest("pre");
      if (!pre || pre.dataset.diagramEnhanced === "1") return;
      pre.dataset.diagramEnhanced = "1";
      const src = extractCodeRaw(code);
      const wrapper = document.createElement("div");
      wrapper.className = "diagram-wrapper";
      const host = document.createElement("figure");
      host.className = "diagram-host drawio-host";
      wrapper.appendChild(createCopyBtn("diagram-copy-btn", "复制 Draw.io 源码", () => src));

      if (!src) {
        renderDiagramDiagnostic(host, {
          title: "Draw.io 代码块需要填写文件 URL。",
          detail: "empty drawio source",
          raw: "",
          hints: ["请在 drawio 代码块内填写可访问的 .drawio 链接。"]
        });
        wrapper.appendChild(host);
        pre.replaceWith(wrapper);
        return;
      }

      const iframe = document.createElement("iframe");
      const encoded = btoa(unescape(encodeURIComponent(src)));
      iframe.src = `${drawioViewerBase}?lightbox=1&nav=1&edit=_blank#U${encoded}`;
      iframe.loading = "lazy";
      iframe.referrerPolicy = "no-referrer";
      iframe.title = "drawio diagram";
      iframe.style.width = "100%";
      iframe.style.height = "460px";
      iframe.style.border = "1px solid var(--line)";
      iframe.style.borderRadius = "12px";
      host.appendChild(iframe);

      const note = document.createElement("figcaption");
      note.innerHTML = `<a href="${src}" target="_blank" rel="noreferrer">打开原始 Draw.io 文件</a>`;
      host.appendChild(note);
      wrapper.appendChild(host);
      pre.replaceWith(wrapper);
    };

    const renderChartBlock = async (code) => {
      const pre = code.closest("pre");
      if (!pre || pre.dataset.diagramEnhanced === "1") return;
      pre.dataset.diagramEnhanced = "1";
      const raw = extractCodeRaw(code) || "{}";
      const wrapper = document.createElement("div");
      wrapper.className = "diagram-wrapper";
      const host = document.createElement("div");
      host.className = "diagram-host chart-host";
      host.style.height = `${chartHeight}px`;
      wrapper.appendChild(createCopyBtn("diagram-copy-btn", "复制图表 JSON", () => raw));
      wrapper.appendChild(host);
      pre.replaceWith(wrapper);

      try {
        const echarts = await getEchartsApi();
        const option = parseChartOption(raw);
        if (!option) {
          throw new Error("invalid chart option: expected JSON object with series or axis fields");
        }
        const chart = echarts.init(host, getEchartsTheme());
        echartsRecords.push({ chart, host, option });
        bindChartResize();
        chart.setOption(option);
      } catch (error) {
        renderDiagramDiagnostic(host, {
          title: "ECharts 渲染失败。",
          detail: getErrorMessage(error, "invalid chart config"),
          raw,
          hints: [
            "确认代码块语言为 chart（或可解析的 JSON）。",
            "确认 JSON 有效，且包含 series / xAxis / yAxis 结构。",
            "若使用 local source，请确认 echarts localBundle 路径可访问。",
            "若网络受限，请检查 ECharts bundle 是否加载成功。"
          ]
        });
        console.error(error);
      }
    };

    const toCodeLines = (codeNode) => {
      if (!(codeNode instanceof HTMLElement)) return [];
      if (codeNode.dataset.linesWrapped === "1") return [];
      const raw = (codeNode.innerHTML || "").replace(/\n$/, "");
      const lines = raw.split("\n");
      if (!lines.length) return [];
      codeNode.innerHTML = lines.map((line) => `<span class="code-line">${line || " "}</span>`).join("\n");
      codeNode.dataset.linesWrapped = "1";
      return lines;
    };

    const isExpressiveCodeBlock = (pre) =>
      pre instanceof HTMLElement && (Boolean(pre.closest(".expressive-code")) || pre.classList.contains("ec-line"));

    const enhanceCodeBlock = (pre) => {
      if (!(pre instanceof HTMLElement)) return;
      if (pre.dataset.codeEnhanced === "1" || pre.closest(".code-block-wrapper")) return;
      if (isExpressiveCodeBlock(pre)) {
        pre.dataset.codeEnhanced = "1";
        return;
      }
      const codeNode = pre.querySelector("code");
      if (!(codeNode instanceof HTMLElement)) return;
      const rawLanguage =
        pre.getAttribute("data-language") ||
        codeNode?.getAttribute("data-language") ||
        pre.className.match(/language-([a-z0-9+_#-]+)/i)?.[1] ||
        "";
      const language = normalizeLanguageLabel(rawLanguage);
      if (["mermaid", "drawio", "chart"].some((name) => language.includes(name))) return;

      const wrapper = document.createElement("div");
      wrapper.className = "code-block-wrapper";
      wrapper.dataset.window = "mac";
      wrapper.dataset.provider = String(codeHighlightProvider || "prism").toLowerCase();
      pre.parentNode?.insertBefore(wrapper, pre);
      wrapper.appendChild(pre);

      const header = document.createElement("div");
      header.className = "code-block-header";
      const headerTitle = document.createElement("div");
      headerTitle.className = "code-block-title";
      const headerMeta = document.createElement("div");
      headerMeta.className = "code-block-meta";

      if (codeWindowTitleMode !== "none") {
        ensureLangLabel(headerTitle, language, wrapper);
        header.appendChild(headerTitle);
      }

      const existingCopyBtn =
        wrapper.querySelector(".code-block-copy") || pre.querySelector(".code-block-copy") || header.querySelector(".code-block-copy");
      if (existingCopyBtn instanceof HTMLElement) {
        headerMeta.appendChild(existingCopyBtn);
      } else if (enableCodeCopy) {
        const btn = createCopyBtn("code-block-copy", "复制代码", () => codeNode?.textContent || pre.textContent || "");
        headerMeta.appendChild(btn);
      }

      header.appendChild(headerMeta);
      wrapper.insertBefore(header, pre);
      const allowRuntimeLineNumbers = enableCodeLineNumbers && activeHighlightProvider === "prism";
      if (allowRuntimeLineNumbers) {
        const lines = toCodeLines(codeNode);
        if (lines.length) {
          pre.dataset.lineNumbers = "1";
          pre.style.setProperty("--line-number-digits", String(Math.max(2, String(lines.length).length)));
        }
      }
      pre.dataset.codeEnhanced = "1";
    };

    const enhanceCodeBlocksInBatches = (article) => {
      const preElements = [...article.querySelectorAll("pre")].filter((pre) => pre instanceof HTMLElement);
      let index = 0;

      const step = (deadline) => {
        while (index < preElements.length) {
          const pre = preElements[index];
          const code = pre.querySelector("code");
          const isDiagramBlock =
            code && !isInsideDemoSource(code) && (isMermaidBlock(code) || isDrawioBlock(code) || isChartBlock(code));
          if (!isDiagramBlock) {
            enhanceCodeBlock(pre);
          }
          index += 1;
          if (deadline && typeof deadline.timeRemaining === "function" && deadline.timeRemaining() < 4) {
            break;
          }
        }
        if (index < preElements.length) {
          scheduleIdle(step);
        }
      };

      scheduleIdle(step);
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

    const enhanceExpressiveCodeHeader = (article, force = false) => {
      if (!isExpressiveProvider) return;
      const findDirectCopyWrap = (frame) => {
        for (const child of Array.from(frame.children)) {
          if (child instanceof HTMLElement && child.classList.contains("copy")) return child;
        }
        return null;
      };
      const frames = [...article.querySelectorAll(".expressive-code figure.frame")].filter(
        (frame) => frame instanceof HTMLElement
      );
      for (const frame of frames) {
        if (!(frame instanceof HTMLElement)) continue;

        const caption = frame.querySelector("figcaption.header");
        const pre = frame.querySelector("pre");
        if (!(caption instanceof HTMLElement) || !(pre instanceof HTMLElement)) {
          continue;
        }
        const headerMeta = ensureCodeBlockMeta(caption);
        const headerTitle = ensureCodeBlockTitle(caption);

        const preLang =
          pre.getAttribute("data-language") ||
          pre.dataset.language ||
          pre.className.match(/language-([a-z0-9+_#-]+)/i)?.[1] ||
          "";
        const languageLabel = normalizeLanguageLabel(preLang);

        headerMeta.querySelectorAll(":scope > .code-block-lang").forEach((node) => node.remove());

        if (codeWindowTitleMode !== "none") {
          ensureLangLabel(headerTitle, languageLabel, frame);
          frame.classList.add("has-title");
        } else {
          removeLangLabel(headerTitle, frame);
          frame.classList.remove("has-title");
        }

        let copyWrap =
          findDirectCopyWrap(frame) ||
          caption.querySelector(":scope .copy.code-block-copy-wrap, :scope .code-block-copy-wrap, :scope .copy");
        let copyReady = !enableCodeCopy;

        if (!(copyWrap instanceof HTMLElement) && enableCodeCopy) {
          copyWrap = document.createElement("div");
          copyWrap.className = "copy code-block-copy-wrap";
          const live = document.createElement("div");
          live.setAttribute("aria-live", "polite");
          copyWrap.appendChild(live);

          const codeNode = pre.querySelector("code");
          const btn = createCopyBtn("code-block-copy", "复制代码", () => {
            if (codeNode instanceof HTMLElement) return extractCodeRaw(codeNode);
            return stripFencedCode(pre.textContent || "");
          });
          copyWrap.appendChild(btn);
          copyReady = true;
        } else if (copyWrap instanceof HTMLElement) {
          copyReady = true;
          copyWrap.classList.add("code-block-copy-wrap");
          copyWrap.classList.add("copy");
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
    const syncExpressiveCodeTheme = (article) => {
      if (!isExpressiveProvider) return;
      const siteTheme = String(root.dataset.theme || "").trim().toLowerCase();
      const expressiveTheme = siteTheme.includes("dark") ? "github-dark" : "github-light";
      article.querySelectorAll(".expressive-code").forEach((block) => {
        if (block instanceof HTMLElement) {
          block.dataset.theme = expressiveTheme;
        }
      });
    };
    const bindHiddenBlocks = (article) => {
      const blocks = [...article.querySelectorAll(".mdx-hidden")];
      for (const block of blocks) {
        if (!(block instanceof HTMLButtonElement)) continue;
        if (block.dataset.hiddenBound === "1") continue;
        block.dataset.hiddenBound = "1";
        block.addEventListener("click", () => {
          const revealed = block.dataset.revealed === "1";
          const nextState = revealed ? "0" : "1";
          block.dataset.revealed = nextState;
          block.setAttribute("aria-expanded", nextState === "1" ? "true" : "false");
        });
      }
    };

    const observeAndRenderDiagrams = (article) => {
      const targets = [...article.querySelectorAll("pre")]
        .map((pre) => {
          if (!(pre instanceof HTMLElement)) return null;
          const code = pre.querySelector("code");
          if (!(code instanceof HTMLElement)) return null;
          if (isInsideDemoSource(code)) return null;
          if (isMermaidBlock(code)) return { kind: "mermaid", pre, code };
          if (isDrawioBlock(code)) return { kind: "drawio", pre, code };
          if (isChartBlock(code)) return { kind: "chart", pre, code };
          return null;
        })
        .filter((target) => target !== null)
        .filter((target) => {
          if (!target) return false;
          if (target.kind === "mermaid") return Boolean(enableMermaid);
          if (target.kind === "drawio") return Boolean(enableDrawio);
          if (target.kind === "chart") return Boolean(enableEcharts);
          return false;
        });

      if (!targets.length) return;

      const runForTarget = (target) => {
        if (!target || !(target.code instanceof HTMLElement)) return;
        if (target.kind === "mermaid" && enableMermaid) {
          renderMermaidBlock(target.code).catch(console.error);
          return;
        }
        if (target.kind === "drawio" && enableDrawio) {
          renderDrawioBlock(target.code).catch(console.error);
          return;
        }
        if (target.kind === "chart" && enableEcharts) {
          renderChartBlock(target.code).catch(console.error);
        }
      };

      if (!("IntersectionObserver" in window)) {
        targets.forEach((target) => scheduleIdle(() => runForTarget(target)));
        return;
      }

      const targetByPre = new WeakMap();
      targets.forEach((target) => {
        if (target?.pre instanceof HTMLElement) {
          targetByPre.set(target.pre, target);
        }
      });

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            observer.unobserve(entry.target);
            const target = targetByPre.get(entry.target);
            if (target) {
              scheduleIdle(() => runForTarget(target));
            }
          });
        },
        { rootMargin: "220px 0px" }
      );

      targets.forEach((target) => {
        if (target?.pre instanceof HTMLElement) {
          observer.observe(target.pre);
        }
      });

      window.setTimeout(() => {
        targets.forEach((target) => {
          if (!target || !(target.pre instanceof HTMLElement) || target.pre.dataset.diagramEnhanced === "1") {
            return;
          }
          observer.unobserve(target.pre);
          scheduleIdle(() => runForTarget(target));
        });
      }, 1200);
    };

    let iconifyApiPromise = null;
    const ensureIconifyLoaded = async () => {
      if (iconifyApiPromise) return iconifyApiPromise;
      iconifyApiPromise = new Promise((resolve, reject) => {
        if (window.customElements?.get("iconify-icon")) {
          resolve(true);
          return;
        }
        const script = document.createElement("script");
        script.src = iconifyBundle;
        script.async = true;
        script.onload = () => resolve(true);
        script.onerror = () => reject(new Error("iconify load failed"));
        document.head.appendChild(script);
      });
      return iconifyApiPromise;
    };

    const bindTabsSwitch = (article) => {
      article.querySelectorAll(".md-tabs").forEach((tabsRoot) => {
        if (!(tabsRoot instanceof HTMLElement)) return;
        if (tabsRoot.dataset.bound === "1") return;
        tabsRoot.dataset.bound = "1";
        tabsRoot.addEventListener("click", (event) => {
          const target = event.target;
          if (!(target instanceof Element)) return;
          const trigger = target.closest(".md-tabs-tab");
          if (!(trigger instanceof HTMLButtonElement)) return;
          const tabId = trigger.dataset.tabId;
          if (!tabId) return;
          tabsRoot.querySelectorAll(".md-tabs-tab").forEach((tabButton) => {
            if (!(tabButton instanceof HTMLButtonElement)) return;
            const active = tabButton.dataset.tabId === tabId;
            tabButton.dataset.active = active ? "1" : "0";
            tabButton.setAttribute("aria-selected", active ? "true" : "false");
          });
          tabsRoot.querySelectorAll(".md-tabs-panel").forEach((panel) => {
            if (!(panel instanceof HTMLElement)) return;
            const active = panel.getAttribute("aria-labelledby") === tabId;
            panel.dataset.active = active ? "1" : "0";
            panel.hidden = !active;
          });
        });
      });
    };
    const bindCodeGroupSwitch = (article) => {
      if (!enableCodeGroup) return;
      article.querySelectorAll(".md-code-group").forEach((groupRoot) => {
        if (!(groupRoot instanceof HTMLElement)) return;
        if (groupRoot.dataset.bound === "1") return;
        groupRoot.dataset.bound = "1";
        groupRoot.addEventListener("click", (event) => {
          const target = event.target;
          if (!(target instanceof Element)) return;
          const trigger = target.closest(".md-code-group-tab");
          if (!(trigger instanceof HTMLButtonElement)) return;
          const tabId = trigger.dataset.tabId;
          if (!tabId) return;
          groupRoot.querySelectorAll(".md-code-group-tab").forEach((tabButton) => {
            if (!(tabButton instanceof HTMLButtonElement)) return;
            const active = tabButton.dataset.tabId === tabId;
            tabButton.dataset.active = active ? "1" : "0";
            tabButton.setAttribute("aria-selected", active ? "true" : "false");
          });
          groupRoot.querySelectorAll(".md-code-group-panel").forEach((panel) => {
            if (!(panel instanceof HTMLElement)) return;
            const active = panel.getAttribute("aria-labelledby") === tabId;
            panel.dataset.active = active ? "1" : "0";
            panel.hidden = !active;
          });
        });
      });
    };
    const bindHeadingCopy = (article) => {
      if (!enableAnchorCopy) return;
      article.querySelectorAll("h2[id],h3[id],h4[id],h5[id],h6[id]").forEach((heading) => {
        if (!(heading instanceof HTMLElement)) return;
        if (heading.dataset.anchorCopyBound === "1") return;
        heading.dataset.anchorCopyBound = "1";
        heading.classList.add("has-heading-copy");
        const button = document.createElement("button");
        button.type = "button";
        button.className = "heading-copy-btn";
        button.title = "复制锚点链接";
        button.setAttribute("aria-label", "复制锚点链接");
        button.textContent = "#";
        button.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          const url = `${location.origin}${location.pathname}#${heading.id}`;
          copyWithFeedback(button, url);
        });
        heading.appendChild(button);
      });
    };
    const bindTitleCopy = () => {
      if (!enableAnchorCopy) return;
      const titleNode = document.querySelector(".post-head h1");
      if (!(titleNode instanceof HTMLElement)) return;
      if (titleNode.dataset.titleCopyBound === "1") return;
      titleNode.dataset.titleCopyBound = "1";
      titleNode.classList.add("has-title-copy");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "title-copy-btn";
      button.title = "复制标题与链接";
      button.setAttribute("aria-label", "复制标题与链接");
      button.textContent = "复制";
      button.addEventListener("click", () => {
        copyWithFeedback(button, `${articleTitle}\n${location.href}`);
      });
      titleNode.appendChild(button);
    };
    const applyCodeFold = (article) => {
      if (!enableCodeFold) return;
      const foldLines = Math.max(6, Number(codeFoldDefaultLines || 18));
      const blocks = [...article.querySelectorAll(".code-block-wrapper, .expressive-code .frame")];
      blocks.forEach((block) => {
        if (!(block instanceof HTMLElement)) return;
        if (block.dataset.codeFoldReady === "1") return;

        const pre = block.querySelector(":scope > pre");
        if (!(pre instanceof HTMLElement)) return;

        const expressiveLines = pre.querySelectorAll(".ec-line").length;
        const plainRaw = pre.querySelector("code")?.textContent || pre.textContent || "";
        const plainLines = plainRaw.split("\n").length;
        const lineCount = Math.max(expressiveLines, plainLines);
        if (lineCount <= foldLines) {
          block.dataset.codeFoldReady = "1";
          return;
        }

        pre.dataset.foldable = "1";
        pre.dataset.folded = "1";
        pre.style.setProperty("--code-fold-lines", String(foldLines));

        let footer = block.querySelector(":scope > .code-fold-footer");
        if (!(footer instanceof HTMLElement)) {
          footer = document.createElement("div");
          footer.className = "code-fold-footer";
          block.appendChild(footer);
        }

        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "code-fold-toggle-icon";
        toggle.innerHTML = `
          <svg class="icon-expand" viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
            <path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="m5 7 5 6 5-6" />
          </svg>
          <svg class="icon-collapse" viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
            <path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="m5 13 5-6 5 6" />
          </svg>
          <span class="sr-only">展开代码</span>
        `;
        const srText = toggle.querySelector(".sr-only");
        const updateFoldState = (folded) => {
          pre.dataset.folded = folded ? "1" : "0";
          toggle.dataset.folded = folded ? "1" : "0";
          toggle.title = folded ? `展开代码（${lineCount} 行）` : "收起代码";
          toggle.setAttribute("aria-label", folded ? "展开代码" : "收起代码");
          toggle.setAttribute("aria-expanded", folded ? "false" : "true");
          if (srText instanceof HTMLElement) {
            srText.textContent = folded ? "展开代码" : "收起代码";
          }
        };
        updateFoldState(true);
        toggle.addEventListener("click", () => {
          const folded = pre.dataset.folded !== "0";
          updateFoldState(!folded);
        });
        footer.innerHTML = "";
        footer.appendChild(toggle);
        block.dataset.codeFoldReady = "1";
      });
    };
    const enhanceDiffBlocks = (article) => {
      if (!enableDiffEnhance) return;
      article.querySelectorAll("pre").forEach((pre) => {
        if (!(pre instanceof HTMLElement)) return;
        if (pre.dataset.diffEnhanced === "1") return;
        const lang = String(pre.getAttribute("data-language") || "").toLowerCase();
        const matchLang = lang.includes("diff") || pre.className.includes("language-diff");
        if (!matchLang) return;

        const markLine = (lineNode, text) => {
          const value = String(text || "");
          if (value.startsWith("+") && !value.startsWith("+++")) lineNode.classList.add("diff-added");
          if (value.startsWith("-") && !value.startsWith("---")) lineNode.classList.add("diff-removed");
          if (value.startsWith("@@")) lineNode.classList.add("diff-hunk");
        };

        const expressiveLines = [...pre.querySelectorAll(".ec-line")];
        if (expressiveLines.length) {
          expressiveLines.forEach((lineNode) => {
            const text = lineNode.querySelector(".code")?.textContent || lineNode.textContent || "";
            markLine(lineNode, text.trimStart());
          });
        } else {
          const plainLines = [...pre.querySelectorAll(".code-line")];
          plainLines.forEach((lineNode) => {
            const text = lineNode.textContent || "";
            markLine(lineNode, text.trimStart());
          });
        }
        pre.dataset.diffEnhanced = "1";
      });
    };
    const initInlineIcons = async (article) => {
      if (!enableInlineIcon) return;
      if (!article.querySelector("iconify-icon")) return;
      await ensureIconifyLoaded();
    };

    const renderChartJsCards = async (article) => {
      if (!enableExtendedMarkdown || !enableChartJs) return;
      const cards = [...article.querySelectorAll(".md-chartjs")];
      if (!cards.length) return;

      const runForCard = async (card) => {
        if (!(card instanceof HTMLElement)) return;
        if (card.dataset.chartjsRendered === "1") return;
        const raw = card.dataset.chartjsConfig || "";
        const canvas = card.querySelector("canvas");
        if (!(canvas instanceof HTMLCanvasElement)) return;

        try {
          const Chart = await getChartJsApi();
          const config = JSON.parse(raw);
          if (!config?.type) throw new Error("chart type missing");
          config.options = config.options || {};
          if (typeof config.options.responsive === "undefined") {
            config.options.responsive = true;
          }
          if (typeof config.options.maintainAspectRatio === "undefined") {
            config.options.maintainAspectRatio = false;
          }
          applyChartJsThemeDefaults(config);

          const instance = new Chart(canvas, config);
          chartJsInstances.push(instance);
          if (enableChartJsThemeSync) {
            chartJsThemeApplied.add(instance);
          }
          bindChartResize();
          card.dataset.chartjsRendered = "1";
        } catch (error) {
          card.dataset.chartjsRendered = "error";
          const fallback = document.createElement("p");
          fallback.className = "md-chartjs-error";
          fallback.textContent = "Chart.js 配置解析失败，请检查 JSON。";
          card.appendChild(fallback);
          console.error(error);
        }
      };

      if (!("IntersectionObserver" in window)) {
        for (const card of cards) {
          await runForCard(card);
        }
        return;
      }

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            observer.unobserve(entry.target);
            runForCard(entry.target).catch(console.error);
          });
        },
        { rootMargin: "220px 0px" }
      );
      cards.forEach((card) => observer.observe(card));
    };

    const stabilizeCodeUi = (article) => {
      if (!(article instanceof HTMLElement)) return;
      const passes = isLowPerf || isCompactViewport ? [0, 320, 960] : [0, 90, 260, 520, 980, 1400];
      passes.forEach((delay) => {
        window.setTimeout(() => {
          enhanceExpressiveCodeHeader(article, true);
          enhanceDiffBlocks(article);
          applyCodeFold(article);
        }, delay);
      });
    };

    const initArticleEnhancements = async () => {
      if (root.dataset.encryptedLocked === "1") return;
      if (root.dataset.antiCrawlLocked === "1") return;
      const article = document.querySelector(".article-body");
      if (!article) return;
      if (article.dataset.enhanced === "1") return;
      article.dataset.enhanced = "1";

      transformDemoShortcodes(article);
      bindTabsSwitch(article);
      bindCodeGroupSwitch(article);
      bindHiddenBlocks(article);
      bindHeadingCopy(article);
      bindTitleCopy();
      await initInlineIcons(article);
      await renderChartJsCards(article);
      addMathCopy(article);
      observeAndRenderDiagrams(article);
      syncExpressiveCodeTheme(article);
      enhanceExpressiveCodeHeader(article);
      enhanceCodeBlocksInBatches(article);
      enhanceDiffBlocks(article);
      applyCodeFold(article);
      stabilizeCodeUi(article);
    };
    const runArticleEnhancements = () => {
      initArticleEnhancements().catch(console.error);
    };

    if (window.__flyPostEnhanceHandler) {
      document.removeEventListener("astro:page-load", window.__flyPostEnhanceHandler);
      document.removeEventListener("astro:after-swap", window.__flyPostEnhanceHandler);
    }
    window.__flyPostEnhanceHandler = runArticleEnhancements;
    document.addEventListener("astro:page-load", runArticleEnhancements);
    document.addEventListener("astro:after-swap", runArticleEnhancements);

    if (!window.__flyPostThemeSyncBound) {
      window.__flyPostThemeSyncBound = true;
      window.addEventListener("site:theme-change", () => {
        const article = document.querySelector(".article-body");
        if (!(article instanceof HTMLElement)) return;
        syncExpressiveCodeTheme(article);
        refreshEchartsTheme().catch(console.error);
        refreshChartJsTheme();
      });
      document.addEventListener("astro:page-load", () => {
        const article = document.querySelector(".article-body");
        if (!(article instanceof HTMLElement)) return;
        syncExpressiveCodeTheme(article);
        refreshEchartsTheme().catch(console.error);
        refreshChartJsTheme();
      });
    }

    const VIEW_CLIENT_KEY = "fly-view-client-id";
    const VIEW_COUNT_CACHE_KEY = "fly-view-count-cache-v1";
    const HISTORY_KEY = "fly-reading-history-v1";
    const STATE_KEY = "fly-reading-state-v1";

    const getClientId = () => {
      let id = localStorage.getItem(VIEW_CLIENT_KEY);
      if (!id) {
        id = `u-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
        localStorage.setItem(VIEW_CLIENT_KEY, id);
      }
      return id;
    };

    const updateViewChip = (count) => {
      const chip = document.getElementById("post-view-count");
      if (!chip) return;
      chip.textContent = `阅读 ${Number(count || 0).toLocaleString("zh-CN")}`;
    };

    const readViewCountCache = (slug) => {
      if (!slug) return null;
      try {
        const raw = sessionStorage.getItem(VIEW_COUNT_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") return null;
        const count = Number(parsed[slug]);
        return Number.isFinite(count) && count >= 0 ? count : null;
      } catch {
        return null;
      }
    };

    const writeViewCountCache = (slug, count) => {
      if (!slug) return;
      const normalizedCount = Number(count);
      if (!Number.isFinite(normalizedCount) || normalizedCount < 0) return;
      try {
        const raw = sessionStorage.getItem(VIEW_COUNT_CACHE_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        const next = parsed && typeof parsed === "object" ? parsed : {};
        next[slug] = normalizedCount;
        sessionStorage.setItem(VIEW_COUNT_CACHE_KEY, JSON.stringify(next));
      } catch {}
    };

    const syncViewStats = async () => {
      if (!viewStatsEnabled || !viewStatsEndpoint) return;
      const chip = document.getElementById("post-view-count");
      if (!(chip instanceof HTMLElement)) return;
      const slug = chip.dataset.viewSlug || location.pathname;
      if (!slug) return;

      const cachedCount = readViewCountCache(slug);
      if (cachedCount !== null) {
        updateViewChip(cachedCount);
      }

      const clientId = getClientId();

      try {
        const postResp = await fetch(viewStatsEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Client-Id": clientId
          },
          keepalive: true,
          body: JSON.stringify({ slug })
        });
        if (postResp.ok) {
          const payload = await postResp.json();
          const nextCount = Number(payload?.count || 0);
          updateViewChip(nextCount);
          writeViewCountCache(slug, nextCount);
        }
      } catch (error) {
        console.warn("view count post failed", error);
      }
    };

    const writeReadingHistory = (progress) => {
      const entry = {
        title: articleTitle,
        url: location.pathname,
        tags: articleTags,
        updatedAt: Date.now(),
        progress
      };

      const list = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      const next = [entry, ...list.filter((item) => item.url !== entry.url)].slice(0, 20);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));

      const state = JSON.parse(localStorage.getItem(STATE_KEY) || "{}");
      state[entry.url] = { progress, updatedAt: entry.updatedAt };
      localStorage.setItem(STATE_KEY, JSON.stringify(state));
    };

    const bindReadingState = () => {
      if (isLowPerf || isCompactViewport) return;
      let timer = 0;
      let lastProgress = -1;
      const write = () => {
        const total = Math.max(document.body.scrollHeight - window.innerHeight, 1);
        const progress = Math.max(0, Math.min(100, Math.round((window.scrollY / total) * 100)));
        if (Math.abs(progress - lastProgress) < 1) return;
        lastProgress = progress;
        writeReadingHistory(progress);
      };

      window.addEventListener("scroll", () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          if ("requestIdleCallback" in window) {
            window.requestIdleCallback(write, { timeout: 600 });
          } else {
            write();
          }
        }, 360);
      }, { passive: true });

      window.addEventListener("beforeunload", write);
      write();
    };

    runArticleEnhancements();
    scheduleIdle(() => {
      syncViewStats().catch(console.error);
    });
    bindReadingState();
}


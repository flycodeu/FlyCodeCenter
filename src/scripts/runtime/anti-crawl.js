const BOT_UA_PATTERN = /(bot|crawler|spider|headless|puppeteer|playwright|selenium|phantom|scrapy|curl|wget)/i;

const REASON_LABELS = {
  normal: "\u6b63\u5e38\u9605\u8bfb",
  webdriver: "\u81ea\u52a8\u5316\u6d4f\u89c8\u73af\u5883",
  "suspicious-ua": "\u53ef\u7591\u8bbf\u95ee\u73af\u5883",
  "source-shortcut": "\u9891\u7e41\u67e5\u770b\u6e90\u7801",
  "high-frequency-copy": "\u9ad8\u9891\u590d\u5236\u64cd\u4f5c",
  "high-frequency-extraction": "\u9ad8\u9891\u63d0\u53d6\u884c\u4e3a"
};

const ensureNumber = (value, fallback, minimum) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, parsed);
};

export const formatAntiCrawlReason = (reason) => REASON_LABELS[reason] || String(reason || "\u5f02\u5e38\u8bbf\u95ee");

export const notifyAntiCrawl = (message) => {
  if (!message) return;
  if (typeof window.__flyNotifyCopySuccess === "function") {
    window.__flyNotifyCopySuccess(message);
    return;
  }
  window.dispatchEvent(new CustomEvent("fly:copy-success", { detail: { message } }));
};

export const createAntiCrawlGuard = (config = {}) => {
  const enabled = Boolean(config.enabled);
  const lockOnSuspicious = config.lockOnSuspicious ?? true;
  const legacyMaxCopyActions = ensureNumber(config.maxCopyActions, 8, 4);
  const timeWindowMs = ensureNumber(config.timeWindowMs, 20000, 8000);
  const warnThresholdScore = ensureNumber(
    config.warnThresholdScore,
    Math.max(legacyMaxCopyActions + 2, 10),
    4
  );
  const restrictThresholdScore = ensureNumber(
    config.restrictThresholdScore,
    Math.max(warnThresholdScore + 4, legacyMaxCopyActions * 2 + 2),
    warnThresholdScore + 1
  );
  const warnCooldownMs = ensureNumber(
    config.warnCooldownMs,
    Math.max(timeWindowMs * 2, 45000),
    10000
  );
  const eventCooldownMs = ensureNumber(
    config.eventCooldownMs,
    Math.max(1800, Math.round(timeWindowMs / 8)),
    400
  );
  const maxCopyBurst = ensureNumber(
    config.maxCopyBurst,
    Math.max(legacyMaxCopyActions + 4, 12),
    6
  );
  const onWarn = typeof config.onWarn === "function" ? config.onWarn : () => {};
  const onRestrict = typeof config.onRestrict === "function" ? config.onRestrict : () => {};

  const eventRules = {
    copy: {
      score: 2,
      cooldownMs: eventCooldownMs,
      group: "copy",
      reason: "high-frequency-copy"
    },
    cut: {
      score: 3,
      cooldownMs: Math.max(eventCooldownMs, 3200),
      group: "copy",
      reason: "high-frequency-copy"
    },
    "hotkey-u": {
      score: 6,
      cooldownMs: Math.max(eventCooldownMs * 3, 12000),
      group: "inspect",
      reason: "source-shortcut"
    }
  };

  const records = [];
  const lastEventAt = new Map();
  let state = "normal";
  let restricted = false;
  let lastReason = "normal";
  let lastWarnAt = 0;

  const trimRecords = (now) => {
    while (records.length && now - records[0].ts > timeWindowMs) {
      records.shift();
    }
  };

  const getScore = () => records.reduce((sum, record) => sum + record.score, 0);
  const getGroupCount = (group) => records.filter((record) => record.group === group).length;

  const warn = (reason, meta = {}) => {
    const now = Date.now();
    state = "warned";
    lastReason = reason;
    if (now - lastWarnAt < warnCooldownMs) return false;
    lastWarnAt = now;
    onWarn({
      reason,
      reasonLabel: formatAntiCrawlReason(reason),
      state,
      snapshot: { score: getScore(), copyBurst: getGroupCount("copy") },
      ...meta
    });
    return true;
  };

  const restrict = (reason, meta = {}) => {
    if (!enabled || restricted || !lockOnSuspicious) return false;
    restricted = true;
    state = "restricted";
    lastReason = reason;
    onRestrict({
      reason,
      reasonLabel: formatAntiCrawlReason(reason),
      state,
      snapshot: { score: getScore(), copyBurst: getGroupCount("copy") },
      ...meta
    });
    return true;
  };

  const inspectEnvironment = () => {
    if (!enabled || restricted || !lockOnSuspicious) return { state, reason: lastReason };
    const ua = navigator.userAgent || "";
    if (navigator.webdriver) {
      restrict("webdriver");
      return { state, reason: "webdriver" };
    }
    if (BOT_UA_PATTERN.test(ua)) {
      restrict("suspicious-ua");
      return { state, reason: "suspicious-ua" };
    }
    return { state, reason: lastReason };
  };

  const mark = (name) => {
    if (!enabled) return { enabled: false, state };
    if (restricted) return { blocked: true, state, reason: lastReason };

    const rule = eventRules[name];
    if (!rule) return { ignored: true, state };

    const now = Date.now();
    trimRecords(now);

    const lastAt = lastEventAt.get(name) || 0;
    if (now - lastAt < rule.cooldownMs) {
      return { ignored: true, deduped: true, state, reason: lastReason };
    }
    lastEventAt.set(name, now);

    records.push({
      ts: now,
      name,
      score: rule.score,
      group: rule.group,
      reason: rule.reason
    });
    trimRecords(now);

    const score = getScore();
    const copyBurst = getGroupCount("copy");
    const dominantReason = copyBurst >= Math.max(4, Math.ceil(warnThresholdScore / 2))
      ? "high-frequency-copy"
      : rule.reason;

    if (lockOnSuspicious && (score >= restrictThresholdScore || copyBurst >= maxCopyBurst)) {
      restrict(copyBurst >= maxCopyBurst ? "high-frequency-copy" : "high-frequency-extraction", {
        score,
        copyBurst,
        trigger: name
      });
      return { accepted: true, state, restricted: true, reason: lastReason, score, copyBurst };
    }

    if (score >= warnThresholdScore) {
      warn(dominantReason, { score, copyBurst, trigger: name });
    }

    return { accepted: true, state, reason: lastReason, score, copyBurst };
  };

  return {
    inspectEnvironment,
    mark,
    restrict,
    isRestricted: () => restricted,
    getState: () => state,
    getReason: () => lastReason,
    getSnapshot: () => ({
      state,
      reason: lastReason,
      score: getScore(),
      copyBurst: getGroupCount("copy"),
      eventCount: records.length
    })
  };
};

export const clearAntiCrawlBindings = () => {
  if (typeof window.__flyAntiCrawlCleanup === "function") {
    window.__flyAntiCrawlCleanup();
  }
  window.__flyAntiCrawlCleanup = null;
};

const ensureNavigationCleanupBinding = () => {
  if (window.__flyAntiCrawlNavigationCleanupBound) return;
  window.__flyAntiCrawlNavigationCleanupBound = true;
  document.addEventListener("astro:before-preparation", clearAntiCrawlBindings);
};

export const bindAntiCrawlInteractions = ({ guard, target = document } = {}) => {
  clearAntiCrawlBindings();
  ensureNavigationCleanupBinding();

  if (!guard || typeof guard.mark !== "function") {
    return () => {};
  }

  const controller = new AbortController();
  const { signal } = controller;

  const blockRestrictedEvent = (event) => {
    if (!guard.isRestricted()) return false;
    event.preventDefault();
    event.stopPropagation();
    return true;
  };

  target.addEventListener(
    "copy",
    (event) => {
      if (blockRestrictedEvent(event)) return;
      guard.mark("copy");
    },
    { capture: true, signal }
  );

  target.addEventListener(
    "cut",
    (event) => {
      if (blockRestrictedEvent(event)) return;
      guard.mark("cut");
    },
    { capture: true, signal }
  );

  target.addEventListener(
    "keydown",
    (event) => {
      if (blockRestrictedEvent(event)) return;
      if (!event.ctrlKey && !event.metaKey) return;
      const hotkey = String(event.key || "").toLowerCase();
      if (hotkey === "u") {
        guard.mark("hotkey-u");
      }
    },
    { capture: true, signal }
  );

  const cleanup = () => controller.abort();
  window.__flyAntiCrawlCleanup = cleanup;
  return cleanup;
};

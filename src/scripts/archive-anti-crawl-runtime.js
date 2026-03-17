import {
  bindAntiCrawlInteractions,
  clearAntiCrawlBindings,
  createAntiCrawlGuard,
  formatAntiCrawlReason,
  notifyAntiCrawl
} from "./runtime/anti-crawl.js";

const parseArchiveAntiCrawlConfig = () => {
  const node = document.getElementById("archive-anti-crawl-config");
  if (!node?.textContent) return null;
  try {
    const parsed = JSON.parse(node.textContent);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (error) {
    console.error("failed to parse archive anti-crawl config", error);
    return null;
  }
};

const initArchiveAntiCrawl = () => {
  const config = parseArchiveAntiCrawlConfig();
  const timeline = document.getElementById("archive-timeline");
  const lockPanel = document.getElementById("archive-lock");
  const lockReason = document.getElementById("archive-lock-reason");

  if (!(timeline instanceof HTMLElement) || !config?.antiCrawlEnabled) {
    clearAntiCrawlBindings();
    return;
  }

  const lock = ({ reason }) => {
    const reasonLabel = formatAntiCrawlReason(reason);
    timeline.classList.add("is-locked");
    document.documentElement.dataset.archivesLocked = "1";
    if (lockPanel instanceof HTMLElement) lockPanel.hidden = false;
    if (lockReason instanceof HTMLElement) lockReason.textContent = `\u539f\u56e0: ${reasonLabel}`;
  };

  const guard = createAntiCrawlGuard({
    enabled: config.antiCrawlEnabled,
    lockOnSuspicious: config.antiCrawlLockOnSuspicious,
    maxCopyActions: config.antiCrawlMaxCopyActions,
    timeWindowMs: config.antiCrawlTimeWindowMs,
    warnThresholdScore: config.antiCrawlWarnThresholdScore,
    restrictThresholdScore: config.antiCrawlRestrictThresholdScore,
    warnCooldownMs: config.antiCrawlWarnCooldownMs,
    eventCooldownMs: config.antiCrawlEventCooldownMs,
    maxCopyBurst: config.antiCrawlMaxCopyBurst,
    onWarn: ({ reasonLabel }) => {
      notifyAntiCrawl(`\u9605\u8bfb\u4fdd\u62a4\uff1a\u68c0\u6d4b\u5230${reasonLabel}\uff0c\u5df2\u8fdb\u5165\u89c2\u5bdf\u6a21\u5f0f\uff0c\u6b63\u5e38\u6d4f\u89c8\u4e0d\u53d7\u5f71\u54cd\u3002`);
    },
    onRestrict: lock
  });

  document.documentElement.dataset.archivesLocked = "0";
  timeline.classList.remove("is-locked");
  if (lockPanel instanceof HTMLElement) lockPanel.hidden = true;

  guard.inspectEnvironment();
  bindAntiCrawlInteractions({ guard });
};

initArchiveAntiCrawl();
document.addEventListener("astro:page-load", initArchiveAntiCrawl);

import { expect, test, type Page } from "@playwright/test";

interface PerformanceAudit {
  cls: number;
  layoutShifts: Array<{
    sources: Array<{
      currentRect: string;
      node: string;
      previousRect: string;
    }>;
    startTime: number;
    value: number;
  }>;
  lcp: {
    className: string;
    size: number;
    startTime: number;
    tag: string;
    text: string;
    url: string;
  } | null;
  longTasks: Array<{ duration: number; startTime: number }>;
}

type LcpEntry = PerformanceEntry & {
  element: Element | null;
  size: number;
  url: string;
};

type LayoutShiftEntry = PerformanceEntry & {
  hadRecentInput: boolean;
  sources?: Array<{
    currentRect?: DOMRectReadOnly;
    node?: Node | null;
    previousRect?: DOMRectReadOnly;
  }>;
  value: number;
};

async function installPerformanceObservers(page: Page) {
  await page.addInitScript(() => {
    const audit: PerformanceAudit = {
      cls: 0,
      layoutShifts: [],
      lcp: null,
      longTasks: []
    };
    window.__flyPerformanceAudit = audit;

    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const entry = entries[entries.length - 1] as LcpEntry | undefined;
      if (!entry) return;
      audit.lcp = {
        className: entry.element?.className || "",
        size: entry.size,
        startTime: entry.startTime,
        tag: entry.element?.tagName || "",
        text: (entry.element?.textContent || "").trim().slice(0, 80),
        url: entry.url || ""
      };
    }).observe({ type: "largest-contentful-paint", buffered: true });

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as LayoutShiftEntry[]) {
        if (entry.hadRecentInput) continue;
        audit.cls += entry.value;
        audit.layoutShifts.push({
          sources: (entry.sources || []).slice(0, 4).map((source) => {
            const node = source.node;
            const element = node instanceof Element ? node : node?.parentElement;
            return {
              currentRect: source.currentRect ? JSON.stringify(source.currentRect.toJSON()) : "",
              node: element
                ? `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${element.className ? `.${String(element.className).trim().replace(/\s+/g, ".")}` : ""}`
                : "",
              previousRect: source.previousRect ? JSON.stringify(source.previousRect.toJSON()) : ""
            };
          }),
          startTime: entry.startTime,
          value: entry.value
        });
      }
    }).observe({ type: "layout-shift", buffered: true });

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        audit.longTasks.push({ duration: entry.duration, startTime: entry.startTime });
      }
    }).observe({ type: "longtask", buffered: true });
  });
}

test("records representative pages under constrained network and CPU", async (
  { browserName, context, page },
  testInfo
) => {
  test.skip(
    browserName !== "chromium",
    "CDP performance audit requires Chromium"
  );
  test.setTimeout(75_000);

  const session = await context.newCDPSession(page);
  await session.send("Network.enable");
  await session.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: Math.floor((1.6 * 1024 * 1024) / 8),
    uploadThroughput: Math.floor((750 * 1024) / 8),
    connectionType: "cellular3g"
  });
  await session.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await installPerformanceObservers(page);

  const results = [];
  for (const route of ["/", "/tutorials/cpp/C++快速入门"]) {
    const response = await page.goto(route, { waitUntil: "load", timeout: 60_000 });
    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator("main")).toBeVisible();
    await page.waitForTimeout(1_200);

    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
      const longTaskTotal = window.__flyPerformanceAudit.longTasks.reduce(
        (sum, entry) => sum + entry.duration,
        0
      );

      return {
        route: location.pathname,
        navigation: navigation
          ? {
              domContentLoaded: Math.round(navigation.domContentLoadedEventEnd),
              load: Math.round(navigation.loadEventEnd),
              responseEnd: Math.round(navigation.responseEnd)
            }
          : null,
        lcp: window.__flyPerformanceAudit.lcp,
        cls: Number(window.__flyPerformanceAudit.cls.toFixed(4)),
        layoutShifts: window.__flyPerformanceAudit.layoutShifts
          .sort((a, b) => b.value - a.value)
          .slice(0, 5),
        longTaskCount: window.__flyPerformanceAudit.longTasks.length,
        longTaskTotal: Math.round(longTaskTotal),
        requestCount: resources.length,
        transferSize: resources.reduce((sum, entry) => sum + (entry.transferSize || 0), 0)
      };
    });

    expect(metrics.navigation?.domContentLoaded).toBeGreaterThan(0);
    expect(metrics.requestCount).toBeGreaterThan(0);
    expect(metrics.lcp?.startTime).toBeGreaterThan(0);
    expect(metrics.lcp!.startTime, `${metrics.route} LCP`).toBeLessThanOrEqual(6_000);
    expect(metrics.cls, `${metrics.route} CLS`).toBeLessThanOrEqual(0.15);
    expect(metrics.longTaskTotal, `${metrics.route} long tasks`).toBeLessThanOrEqual(500);
    expect(metrics.transferSize, `${metrics.route} transfer size`).toBeLessThanOrEqual(2 * 1024 * 1024);
    results.push(metrics);
  }

  const description = JSON.stringify(results);
  testInfo.annotations.push({ type: "performance-audit", description });
  console.log(`[performance-audit] ${description}`);
});

declare global {
  interface Window {
    __flyPerformanceAudit: PerformanceAudit;
  }
}

import { expect, test, type Page } from "@playwright/test";

const representativeRoutes = [
  "/",
  "/blog",
  "/tutorials",
  "/tutorials/cpp/C++快速入门",
  "/archives",
  "/projects",
  "/reading",
  "/sites",
  "/gallery",
  "/timeline",
  "/tags",
  "/about",
  "/jarvis",
  "/interview"
];

function watchPageErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

async function expectNoViewportOverflow(page: Page) {
  const metrics = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth
  }));

  expect(metrics.documentWidth, JSON.stringify(metrics)).toBeLessThanOrEqual(metrics.viewport + 1);
  expect(metrics.bodyWidth, JSON.stringify(metrics)).toBeLessThanOrEqual(metrics.viewport + 1);
}

test.describe("route smoke and responsive layout", () => {
  for (const route of representativeRoutes) {
    test(`${route} renders without runtime errors or viewport overflow`, async ({ page }) => {
      const errors = watchPageErrors(page);
      const response = await page.goto(route, { waitUntil: "domcontentloaded" });

      expect(response?.status()).toBeLessThan(400);
      await expect(page.locator("main")).toBeVisible();
      await expect(page.locator("body")).not.toHaveText("");
      await page.waitForTimeout(150);
      await expectNoViewportOverflow(page);
      expect(errors).toEqual([]);
    });
  }
});

test("development runtime keeps real article content available", async ({ page }) => {
  await page.goto("/tutorials/cpp/C++快速入门", { waitUntil: "domcontentloaded" });

  await expect(page.locator(".anti-crawl-lock")).toHaveCount(0);
  const article = page.locator(".article-body");
  await expect(article).toBeVisible();
  expect((await article.innerText()).trim().length).toBeGreaterThan(500);
});

test("article runtime refreshes metadata after client-side navigation", async ({ page, isMobile }) => {
  test.skip(isMobile, "Reading history tracking is disabled on compact viewports");

  await page.addInitScript(() => {
    localStorage.removeItem("fly-reading-history-v1");
    localStorage.removeItem("fly-reading-state-v1");
  });
  await page.goto("/blog/byztpdi79", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".article-body")).toHaveAttribute("data-enhanced", "1", {
    timeout: 12_000
  });

  const firstTitle = (await page.locator(".post-head h1").innerText()).trim();
  const nextLink = page.locator(".prev-next a").first();
  const nextHref = await nextLink.getAttribute("href");
  expect(nextHref).toBeTruthy();
  await nextLink.click();
  await expect(page).toHaveURL(new RegExp(`${nextHref!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/?$`));

  const secondTitle = (await page.locator(".post-head h1").innerText()).trim();
  expect(secondTitle).not.toBe(firstTitle);
  await expect(page.locator(".article-body")).toHaveAttribute("data-enhanced", "1", {
    timeout: 12_000
  });

  const runtimeConfig = await page.locator("#article-runtime-config").evaluate((node) =>
    JSON.parse(node.textContent || "{}")
  );
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const history = JSON.parse(localStorage.getItem("fly-reading-history-v1") || "[]");
          return history[0] ?? null;
        }),
      { timeout: 12_000 }
    )
    .toMatchObject({
      title: runtimeConfig.articleTitle,
      url: new URL(nextHref!, "http://localhost").pathname,
      tags: runtimeConfig.articleTags
    });
});

test("search remains usable while its index loads slowly", async ({ page }) => {
  await page.route("**/src/scripts/search-modal.ts*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 700));
    await route.continue();
  });
  await page.route("**/search/minisearch.json", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1_200));
    await route.continue();
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.keyboard.press("/");

  const visibleSearch = page.locator("#search-modal[open], #search-fallback.open");
  await expect(visibleSearch).toBeVisible();
  await expect(page.locator("#search-input:visible, #search-input-fallback:visible")).toBeFocused({
    timeout: 400
  });

  const input = page.locator("#search-input:visible, #search-input-fallback:visible");
  await input.fill("Java");
  await expect(page.locator(".search-results:visible .result-item").first()).toBeVisible({
    timeout: 12_000
  });

  const resultCount = await page.locator(".search-results:visible .result-item").count();
  await expect(page.locator(".search-count:visible")).toHaveText(`${resultCount} 条结果`);

  await page.keyboard.press("ArrowDown");
  await expect(page.locator(".search-results:visible .result-item.active")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(visibleSearch).toBeHidden();

  await page.keyboard.press("/");
  await expect(visibleSearch).toBeVisible();
  await expect(input).toHaveValue("Java");
  await expect(page.locator(".search-results:visible .result-item").first()).toBeVisible({
    timeout: 12_000
  });
  await page.keyboard.press("Escape");
});

test("theme selection survives client-side navigation", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "深色" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", /dark/i);

  await page.locator('a[href="/about"]').first().click();
  await expect(page).toHaveURL(/\/about\/?$/);
  await expect(page.locator("html")).toHaveAttribute("data-theme", /dark/i);
  await expect(page.getByRole("button", { name: "深色" })).toHaveAttribute("aria-pressed", "true");
});

test("mobile tutorial drawer opens and closes without trapping the page", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Mobile interaction only");

  await page.goto("/tutorials/cpp/C++快速入门", { waitUntil: "domcontentloaded" });
  const open = page.getByRole("button", { name: "打开章节目录" });
  const close = page.getByRole("button", { name: "关闭章节目录" });
  const drawer = page.locator("[data-sidebar-mobile-panel]");

  await open.click();
  await expect(drawer).toBeVisible();
  await expect(page.locator("body")).toHaveClass(/tutorial-sidebar-drawer-open/);
  await expectNoViewportOverflow(page);

  await close.click();
  await expect(drawer).toBeHidden();
  await expect(page.locator("body")).not.toHaveClass(/tutorial-sidebar-drawer-open/);
  await expect(open).toHaveAttribute("aria-expanded", "false");
  await expect(open).toBeFocused();
});

test("mobile table of contents opens, closes and restores page scrolling", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Mobile interaction only");

  await page.goto("/tutorials/cpp/C++快速入门", { waitUntil: "domcontentloaded" });
  const panel = page.locator("#toc-mobile-panel");
  const open = page.getByRole("button", { name: "打开目录" });
  const close = page.getByRole("button", { name: "关闭目录" });

  await open.click();
  await expect(panel).toBeVisible();
  await expect(page.locator("body")).toHaveClass(/toc-drawer-open/);
  await expect(open).toHaveAttribute("aria-expanded", "true");
  await expect(close).toBeFocused();

  await close.click();
  await open.click();
  await page.waitForTimeout(220);
  await expect(panel).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(page.locator("body")).not.toHaveClass(/toc-drawer-open/);
  await expect(open).toHaveAttribute("aria-expanded", "false");
  await expect(open).toBeFocused();
});

test("home featured cover uses a responsive high-priority image candidate", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const image = page.locator(".featured-cover img");
  await expect(image).toBeVisible();
  await expect(image).toHaveAttribute("loading", "eager");
  await expect(image).toHaveAttribute("fetchpriority", "high");
  await expect(image).toHaveAttribute("srcset", /480w.*768w.*960w.*1200w/);

  const currentSrc = await image.evaluate((node: HTMLImageElement) => node.currentSrc);
  expect(currentSrc).not.toContain("w=2400");
});

test("profile rail keeps the same desktop geometry across list pages", async ({ page, isMobile }) => {
  test.skip(isMobile, "The profile rail joins the document flow on compact viewports");

  const boxes = [];
  for (const route of ["/", "/blog", "/tutorials", "/tags"]) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    const box = await page.locator(".profile-rail .profile-card").boundingBox();
    expect(box, route).not.toBeNull();
    boxes.push({ route, ...box! });
  }

  const reference = boxes[0];
  for (const box of boxes.slice(1)) {
    expect(Math.abs(box.x - reference.x), box.route).toBeLessThanOrEqual(1);
    expect(Math.abs(box.y - reference.y), box.route).toBeLessThanOrEqual(1);
    expect(Math.abs(box.width - reference.width), box.route).toBeLessThanOrEqual(1);
  }
});

test("post cards reserve cover space and render content-aware text fallbacks", async ({ page }) => {
  await page.goto("/blog", { waitUntil: "domcontentloaded" });

  const cards = page.locator(".post-card");
  const covers = page.locator(".post-card .cover-wrap");
  expect(await cards.count()).toBeGreaterThan(0);
  expect(await covers.count()).toBe(await cards.count());

  const fallback = page.locator('.post-card [data-content-cover][data-image-state="fallback"]').first();
  await expect(fallback).toBeVisible();
  const fallbackCopy = await fallback.evaluate((node) => {
    const card = node.closest(".post-card");
    return {
      cardTitle: card?.querySelector(".title")?.textContent?.trim() || "",
      coverTitle: node.querySelector(".content-cover-title")?.textContent?.trim() || ""
    };
  });
  expect(fallbackCopy.coverTitle).toBe(fallbackCopy.cardTitle);

  const lazyImage = page.locator(".post-card [data-content-cover] img").first();
  await expect(lazyImage).toHaveAttribute("loading", "lazy");
  await expect(lazyImage).toHaveAttribute("decoding", "async");
  await expect(lazyImage).toHaveAttribute("fetchpriority", "low");
});

test("content covers keep their text fallback when image requests fail", async ({ page }) => {
  await page.route("**/*", async (route) => {
    if (route.request().resourceType() === "image") {
      await route.abort();
      return;
    }
    await route.continue();
  });

  await page.goto("/blog", { waitUntil: "domcontentloaded" });
  const failedCover = page.locator('[data-content-cover][data-image-state="error"]').first();
  await expect(failedCover).toBeVisible();
  await expect(failedCover.locator(".content-cover-title")).not.toHaveText("");
});

test("generated taxonomies and interview navigation omit placeholder copy", async ({ page }) => {
  await page.goto("/tags", { waitUntil: "domcontentloaded" });
  await expect(page.locator("body")).not.toContainText(/Uncategorized/i);
  const tagFontSizes = await page.locator(".tag-node").evaluateAll((nodes) =>
    nodes.map((node) => Number.parseFloat(getComputedStyle(node).fontSize))
  );
  expect(Math.max(...tagFontSizes)).toBeLessThanOrEqual(19);
  expect(Math.min(...tagFontSizes)).toBeGreaterThanOrEqual(13);

  await page.goto("/interview", { waitUntil: "domcontentloaded" });
  await expect(page.locator("body")).not.toContainText(
    "按顺序回顾题目，掌握状态和最近进度会自动记录。"
  );
});

test("external cover images load without leaking a referrer", async ({ page }) => {
  const coverPattern =
    "https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/**";
  const requestReferrers: string[] = [];
  const imageBody = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64"
  );

  await page.route(coverPattern, async (route) => {
    requestReferrers.push(route.request().headers().referer || "");
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      body: imageBody
    });
  });

  await page.goto("/?page=2", { waitUntil: "domcontentloaded" });
  const cover = page.locator("#home-feed-list [data-page-item]:visible img").first();
  await cover.scrollIntoViewIfNeeded();
  await expect(cover).toHaveAttribute("referrerpolicy", "no-referrer");
  await expect
    .poll(() => cover.evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBeGreaterThan(0);
  expect(requestReferrers.length).toBeGreaterThan(0);
  expect(requestReferrers).toEqual(requestReferrers.map(() => ""));
});

test("interview gate unlocks and restores the protected content", async ({ page }) => {
  await page.goto("/interview", { waitUntil: "domcontentloaded" });
  const gate = page.locator("[data-interview-access-gate]");

  await expect(gate).toBeVisible();
  await page.locator("[data-access-password]").fill("flycode");
  await page.getByRole("button", { name: "验证并进入" }).click();

  await expect(gate).toBeHidden();
  await expect(page.locator("[data-interview-protected]")).toBeVisible();
});

test("Jarvis settings stay inside the viewport and close cleanly", async ({ page }) => {
  await page.goto("/jarvis", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "打开设置" }).click();

  const modal = page.locator("#jarvis-settings-modal");
  const panel = page.locator(".jarvis-modal-panel");
  await expect(modal).toBeVisible();
  await expect(panel).toBeVisible();
  await expectNoViewportOverflow(page);

  const bounds = await panel.boundingBox();
  const viewport = page.viewportSize();
  expect(bounds).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(-1);
  expect(bounds!.y).toBeGreaterThanOrEqual(-1);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport!.width + 1);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport!.height + 1);

  await page.getByRole("button", { name: "关闭" }).click();
  await expect(modal).toBeHidden();
  await expect(page.locator("body")).not.toHaveClass(/has-overlay/);
});

test("reduced-motion and low-capability devices use the lightweight mode", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "deviceMemory", { configurable: true, get: () => 2 });
    Object.defineProperty(navigator, "hardwareConcurrency", { configurable: true, get: () => 2 });
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page.locator("html")).toHaveAttribute("data-perf", "low");
  await expect(page.locator("#jarvis-bot")).toBeHidden();
});

test("home pagination updates the visible batch and URL without a reload", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const visibleItems = page.locator("#home-feed-list [data-page-item]:visible");
  const firstTitle = (await visibleItems.first().innerText()).trim();
  await page.locator("#home-feed-pager .pager-btn-num[data-page='2']").click();

  await expect(page).toHaveURL(/[?&]page=2(?:&|$)/);
  await expect(visibleItems.first()).not.toHaveText(firstTitle);
  await expectNoViewportOverflow(page);
});

test("reading, tag and site filters keep URL and visible content in sync", async ({ page }) => {
  await page.goto("/reading", { waitUntil: "domcontentloaded" });
  const readingFilter = page.locator("#reading-filter .tag-chip").nth(1);
  const readingTag = await readingFilter.getAttribute("data-tag");
  await readingFilter.click();
  await expect(page.locator("#reading-filter .tag-chip.active")).toHaveAttribute("data-tag", readingTag!);
  await expect(page.locator("#reading-grid [data-item]:visible").first()).toBeVisible();
  expect(new URL(page.url()).searchParams.get("tag")).toBe(readingTag);

  await page.goto("/tags", { waitUntil: "domcontentloaded" });
  const tagFilter = page.locator("#tag-filter-root .tag-node").nth(1);
  const tag = await tagFilter.getAttribute("data-tag");
  await tagFilter.click();
  await expect(page.locator("#tag-filter-root .tag-node.active")).toHaveAttribute("data-tag", tag!);
  await expect(page.locator("#tag-result-list [data-entry-item]:visible").first()).toBeVisible();
  expect(new URL(page.url()).searchParams.get("tag")).toBe(tag?.toLowerCase());

  await page.goto("/sites", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#vault-nav .nav-item.active")).toHaveAttribute("data-filter", "all");
  expect(await page.locator("#vault-groups .vault-group:visible").count()).toBeGreaterThan(1);
  const categoryButton = page.locator("#vault-nav .nav-item").nth(1);
  const category = await categoryButton.getAttribute("data-filter");
  await categoryButton.click();
  await expect(page.locator("#vault-nav .nav-item.active")).toHaveAttribute("data-filter", category!);
  await expect(page.locator("#vault-groups .vault-group:visible")).toHaveCount(1);
  expect(new URL(page.url()).searchParams.get("category")).toBe(category);
  await expectNoViewportOverflow(page);
});

test("gallery loads another batch and disables motion on constrained devices", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "deviceMemory", { configurable: true, get: () => 2 });
    Object.defineProperty(navigator, "hardwareConcurrency", { configurable: true, get: () => 2 });
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/gallery", { waitUntil: "domcontentloaded" });

  const visibleItems = page.locator("#photo-grid [data-photo-item]:visible");
  const before = await visibleItems.count();
  const hiddenBefore = await page.locator("#photo-grid [data-photo-item][hidden]").count();
  expect(hiddenBefore).toBeGreaterThan(0);

  await page.getByRole("button", { name: "加载更多" }).click();
  expect(await visibleItems.count()).toBeGreaterThan(before);
  await expect(page.locator("#photo-grid .is-motion-active")).toHaveCount(0);
  await expectNoViewportOverflow(page);
});

test("desktop more menu closes with Escape and after navigation", async ({ page, isMobile }) => {
  test.skip(isMobile, "Desktop navigation menu only");

  await page.goto("/", { waitUntil: "domcontentloaded" });
  const menu = page.locator("details[data-nav-more]");
  await menu.locator("summary").click();
  await expect(menu).toHaveAttribute("open", "");
  await page.keyboard.press("Escape");
  await expect(menu).not.toHaveAttribute("open", "");

  await menu.locator("summary").click();
  await expect(menu).toHaveAttribute("open", "");
  await menu.locator('a[href="/reading"]').click();
  await expect(page).toHaveURL(/\/reading\/?$/);
  await expect(page.locator("details[data-nav-more]")).not.toHaveAttribute("open", "");
});

test("interview answer and progress controls remain functional after unlock", async ({ page, isMobile }) => {
  test.skip(isMobile, "Desktop interview sidebar workflow");

  await page.goto("/interview", { waitUntil: "domcontentloaded" });
  await page.locator("[data-access-password]").fill("flycode");
  await page.getByRole("button", { name: "验证并进入" }).click();
  await expect(page.locator("[data-interview-access-gate]")).toBeHidden();

  await page.locator("a[data-space-card]").first().click();
  const firstQuestion = page.locator("[data-interview-item] a").first();
  if (await firstQuestion.count()) {
    await firstQuestion.click();
  }
  await expect(page.locator("[data-interview-answer-shell]")).toBeVisible();
  const answerToggle = page.locator("[data-answer-toggle]");
  await answerToggle.click();
  await expect(answerToggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("[data-answer-panel]")).toBeVisible();

  const remember = page.locator("[data-remember-toggle]").first();
  await remember.click();
  await expect(remember).toHaveAttribute("aria-pressed", "true");
});

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const base = (process.env.RELAY_PREVIEW_URL || 'http://127.0.0.1:4321').replace(/\/$/, '');
const isDev = process.env.RELAY_PAGE_MODE === 'dev';
const output = path.resolve('test-results/usb-relay', isDev ? 'dev' : 'build');
const sourceArticle = await fs.readFile('src/content/blog/USB单路继电器零基础入门与Python实操.md', 'utf8');
const expectedCodeBlocks = [...sourceArticle.matchAll(/^```[^\r\n]*\r?\n[\s\S]*?^```[ \t]*$/gm)].length;
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const results = [];
try {
  for (const width of [1440, 390]) {
    // Existing site crawler allowlist exposes the content for structural QA.
    // This is not an acceptance test of normal visitor anti-crawl interactions.
    const context = await browser.newContext({
      viewport: { width, height: 960 },
      ...(isDev ? {} : { userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' }),
      permissions: ['clipboard-read', 'clipboard-write'],
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const response = await page.goto(`${base}/blog/b2kz8iy4i/`, { waitUntil: 'domcontentloaded' });
    assert.equal(response.status(), 200);
    const article = page.locator('.article-body');
    await article.waitFor();
    assert.ok((await article.innerText()).includes('实体动作及触点通断仍待确认'));
    await article.locator('pre').first().waitFor({ state: 'attached', timeout: 30000 });
    assert.equal(await page.locator('main h1').count(), 1);
    assert.equal(await article.locator('h2').count(), 17);
    assert.equal(await article.locator('pre').count(), expectedCodeBlocks);
    const diagram = article.locator('.mermaid-host').first();
    await diagram.scrollIntoViewIfNeeded();
    await diagram.locator('svg').waitFor({ timeout: 30000 });
    await diagram.locator('.node').first().waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(output, `diagram-${width}.png`) });
    assert.equal(await article.locator('.mermaid-error').count(), 0);
    const tables = article.locator('table');
    assert.ok(await tables.count() >= 10);
    for (const index of [0, 4, 10]) {
      await tables.nth(index).scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(output, `table-${index}-${width}.png`) });
    }
    const fullCode = article.locator('pre').filter({ hasText: 'def check_target(port)' });
    assert.equal(await fullCode.count(), 1);
    await fullCode.scrollIntoViewIfNeeded();
    await fullCode.locator('code span').first().waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(output, `code-${width}.png`) });
    const codeFrame = fullCode.locator('..');
    await codeFrame.getByRole('button', { name: '展开代码', exact: true }).click();
    assert.equal(await fullCode.getAttribute('data-folded'), '0');
    await codeFrame.getByRole('button', { name: '复制代码', exact: true }).click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    const source = await fs.readFile('public/examples/usb-relay/relay_control.py', 'utf8');
    assert.equal(copied.replaceAll('\r\n', '\n').trimEnd(), source.replaceAll('\r\n', '\n').trimEnd());
    await codeFrame.getByRole('button', { name: '收起代码', exact: true }).click();
    assert.equal(await fullCode.getAttribute('data-folded'), '1');
    const articleLinks = await article.locator('a[href^="/examples/usb-relay/"]')
      .evaluateAll(nodes => nodes.map(node => node.getAttribute('href')));
    assert.equal(new Set(articleLinks).size, 4);
    for (const href of new Set(articleLinks)) {
      const download = await context.request.get(base + href);
      assert.equal(download.status(), 200, href);
      const local = await fs.readFile(path.resolve('public', href.slice(1)), 'utf8');
      assert.equal((await download.text()).replaceAll('\r\n', '\n'), local.replaceAll('\r\n', '\n'));
    }
    const headingIds = await article.locator('h2,h3').evaluateAll(nodes => nodes.map(node => node.id));
    assert.equal(new Set(headingIds).size, headingIds.length);
    const metrics = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
    }));
    assert.ok(metrics.document <= metrics.viewport + 1 && metrics.body <= metrics.viewport + 1,
      JSON.stringify(metrics));
    assert.deepEqual(errors, []);
    await page.locator('main h1').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(output, `top-${width}.png`) });
    results.push({ width, status: response.status(), metrics, mermaid: true,
      sourceDownloadParity: true, fullCodeCopyParity: true, foldToggle: true, dev: isDev });
    await context.close();
  }
  const visitor = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const page = await visitor.newPage();
  const response = await page.goto(`${base}/blog/b2kz8iy4i/`, { waitUntil: 'domcontentloaded' });
  assert.equal(response.status(), 200);
  await page.locator('main h1').waitFor();
  await page.screenshot({ path: path.join(output, 'normal-visitor.png') });
  results.push({ normalVisitorHttp: response.status(), heading: await page.locator('main h1').innerText() });
  await visitor.close();
  console.log(JSON.stringify({ results, screenshots: output }, null, 2));
} finally {
  await browser.close();
}

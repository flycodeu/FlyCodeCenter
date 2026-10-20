import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const base = (process.env.RELAY_PREVIEW_URL || 'http://127.0.0.1:4321').replace(/\/$/, '');
const isDev = process.env.RELAY_PAGE_MODE === 'dev';
const output = path.resolve('test-results/usb-relay/utf8-environment-fix', isDev ? 'dev' : 'build');
const normalize = value => value.replace(/^\uFEFF/, '').replaceAll('\r\n', '\n').trimEnd();
const sourceArticle = await fs.readFile('src/content/blog/USB单路继电器零基础入门与Python实操.md', 'utf8');
const expectedCodeBlocks = [...sourceArticle.matchAll(/^```[^\r\n]*\r?\n[\s\S]*?^```[ \t]*$/gm)].length;
const expectedHeadings = [...sourceArticle.matchAll(/^## /gm)].length;
const expectedTables = [...sourceArticle.matchAll(/^\| --- \|/gm)].length;
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
    const articleText = await article.innerText();
    assert.ok(articleText.includes('使用者已确认听到了本次测试的切换声'));
    assert.ok(articleText.includes('进入文件夹不会自动启用'));
    assert.ok(articleText.includes('UTF-8 BOM'));
    assert.ok(!/\uFFFD|鎸囦护|绋嬪簭/.test(articleText));
    assert.ok(articleText.includes('python .\\relay_demo.py on'));
    assert.ok(articleText.includes('python .\\relay_demo.py off'));
    await article.locator('pre').first().waitFor({ state: 'attached', timeout: 30000 });
    assert.equal(await page.locator('main h1').count(), 1);
    assert.equal(await article.locator('h2').count(), expectedHeadings);
    assert.equal(await article.locator('pre').count(), expectedCodeBlocks);
    assert.equal(await article.locator('.mermaid-host').count(), 0);
    const tables = article.locator('table');
    assert.equal(await tables.count(), expectedTables);
    for (const index of [0, 1, expectedTables - 1]) {
      await tables.nth(index).scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(output, `table-${index}-${width}.png`) });
    }
    const fullCode = article.locator('pre').filter({ hasText: 'with serial.Serial(PORT, 9600, write_timeout=1)' });
    assert.equal(await fullCode.count(), 1);
    await fullCode.scrollIntoViewIfNeeded();
    await fullCode.locator('code span').first().waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(output, `code-${width}.png`) });
    const codeFrame = fullCode.locator('..');
    assert.equal(await fullCode.getAttribute('data-folded'), null, 'short example stays fully visible');
    assert.equal(await codeFrame.getByRole('button', { name: '展开代码', exact: true }).count(), 0);
    await codeFrame.getByRole('button', { name: '复制代码', exact: true }).click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    const source = await fs.readFile('public/examples/usb-relay/relay_demo.py', 'utf8');
    assert.equal(normalize(copied), normalize(source));
    const optional = article.locator('details');
    assert.equal(await optional.count(), 1);
    assert.equal(await optional.getAttribute('open'), null);
    await optional.locator('summary').click();
    assert.equal(await optional.getAttribute('open'), '');
    await optional.getByRole('link', { name: 'relay_control.py：带参数检查的原教学工具', exact: true }).waitFor({ state: 'visible' });
    const articleLinks = await article.locator('a[href^="/examples/usb-relay/"]')
      .evaluateAll(nodes => nodes.map(node => node.getAttribute('href')));
    assert.equal(new Set(articleLinks).size, 6);
    for (const href of new Set(articleLinks)) {
      const download = await context.request.get(base + href);
      assert.equal(download.status(), 200, href);
      const local = await fs.readFile(path.resolve('public', href.slice(1)), 'utf8');
      assert.equal(normalize(await download.text()), normalize(local));
      if (href.endsWith('/relay_demo.py')) {
        const bytes = await download.body();
        assert.deepEqual([...bytes.subarray(0, 3)], [0xEF, 0xBB, 0xBF]);
      }
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
    results.push({ width, status: response.status(), metrics, headings: expectedHeadings, tables: expectedTables,
      beginnerCodeLines: source.trimEnd().split('\n').length, optionalDownloads: 6,
      sourceDownloadParity: true, fullCodeCopyParity: true, shortCodeUnfolded: true, optionalDisclosure: true, dev: isDev });
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

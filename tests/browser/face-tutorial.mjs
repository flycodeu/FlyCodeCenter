import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Run against an already running dev server or built static site.
const root = fileURLToPath(new URL('../../', import.meta.url));
const base = (process.env.FACE_BASE_URL || 'http://127.0.0.1:4321').replace(/\/$/, '');
const output = path.join(root, 'test-results/face-tutorial');
const routes = ['face-recognition', 'tface-compare', 'tface-pad', 'tface-actions', 'tface-engineering'];
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || undefined });
const results = [];
try {
  for (const width of [1440, 390]) {
    // Inspect production content through the existing crawler allowlist.
    // This does not test the normal visitor's anti-crawl behavior.
    const context = await browser.newContext({ viewport: { width, height: 960 },
      userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const route of routes) {
      const response = await page.goto(`${base}/tutorials/${route}/`, { waitUntil: 'domcontentloaded' });
      assert.equal(response.status(), 200, route);
      await page.locator('.article-body').waitFor();
      assert.ok((await page.locator('.article-body').innerText()).length > 600, route);
      assert.equal(await page.locator('main h1').count(), 1, route);
      assert.equal(await page.locator('.article-body .katex-error').count(), 0, route);
      if (['tface-compare', 'tface-actions', 'tface-pad'].includes(route)) {
        assert.ok(await page.locator('.article-body .katex').count() > 0, `${route}: missing formulas`);
      }
      const links = await page.locator('.article-body a[href^="/tutorials/"], .article-body a[href^="/examples/face-recognition/"]')
        .evaluateAll(nodes => nodes.map(node => node.getAttribute('href')));
      for (const href of new Set(links)) {
        assert.equal((await context.request.get(base + href)).status(), 200, href);
      }
      if (route === 'face-recognition') {
        const diagram = page.locator('.article-body .mermaid-host').first();
        await diagram.waitFor({ timeout: 30000 });
        await diagram.scrollIntoViewIfNeeded();
        await diagram.locator('svg').waitFor({ timeout: 30000 });
      }
      const metrics = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth,
        content: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
      assert.ok(metrics.content <= metrics.viewport + 1 && metrics.body <= metrics.viewport + 1,
        `${route} ${JSON.stringify(metrics)}`);
      await page.locator('main h1').scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(output, `${route}-${width}.png`) });
      results.push({ route, width });
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
  const index = await browser.newContext();
  assert.ok((await (await index.request.get(`${base}/tutorials/`)).text()).includes('人脸与活体'));
  for (const file of ['algorithms.py', 'test_algorithms.py', 'test_image_pipeline.py', 'face_io.py',
    'single_image_pad.py', 'pnp_pose.py', 'landmark_camera.py', 'compare_faces.py', 'README.md']) {
    const response = await index.request.get(`${base}/examples/face-recognition/${file}`);
    assert.equal(response.status(), 200, file);
    // Git may check out CRLF on Windows; only compare logical text lines.
    assert.equal((await response.text()).replaceAll('\r\n', '\n'),
      (await readFile(path.join(root, 'public/examples/face-recognition', file), 'utf8')).replaceAll('\r\n', '\n'), file);
  }
  await index.close();
  console.log(JSON.stringify({ pages: results, downloadParity: true, errors: [], screenshots: output }, null, 2));
} finally {
  await browser.close();
}

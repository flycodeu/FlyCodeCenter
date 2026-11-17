import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const base = (process.env.AGENT_BASE_URL || 'http://127.0.0.1:4339').replace(/\/$/, '');
const output = path.resolve('test-results/agent-tutorial');
await fs.mkdir(output, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  channel: process.env.BROWSER_CHANNEL || 'msedge'
});

try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: 960 },
      userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));

    // Series index
    const seriesResp = await page.goto(`${base}/tutorials/agent/`, { waitUntil: 'domcontentloaded' });
    assert.equal(seriesResp.status(), 200);
    const seriesDiagram = page.locator('.article-body .mermaid-host').first();
    await seriesDiagram.waitFor({ timeout: 30000 });
    await seriesDiagram.scrollIntoViewIfNeeded();
    await seriesDiagram.locator('svg').waitFor({ timeout: 30000 });
    assert.equal(await page.locator('.article-body .mermaid-host svg').count(), 1);
    const seriesOverflow = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth
    }));
    assert.ok(seriesOverflow.scroll <= seriesOverflow.viewport + 1, JSON.stringify(seriesOverflow));
    if (width === 1440) {
      await page.screenshot({ path: path.join(output, 'series-1440.png') });
    }

    // Lesson 1
    const l1Resp = await page.goto(`${base}/tutorials/tagent-lesson01/`, { waitUntil: 'domcontentloaded' });
    assert.equal(l1Resp.status(), 200);
    await page.locator('.article-body .mermaid-host').nth(1).waitFor({ timeout: 30000 });
    for (const idx of [0, 1]) {
      const m = page.locator('.article-body .mermaid-host').nth(idx);
      await m.scrollIntoViewIfNeeded();
      await m.locator('svg').waitFor({ timeout: 30000 });
    }
    assert.equal(await page.locator('.article-body .mermaid-host svg').count(), 2);

    const demo1 = page.locator('param-learning-demo');
    await demo1.waitFor();
    await page.waitForFunction(
      () => document.querySelector('param-learning-demo')?.getAttribute('data-ready') === 'true',
      null,
      { timeout: 15000 }
    );
    await demo1.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);

    for (let i = 0; i < 3; i += 1) {
      await demo1.getByRole('button', { name: '下一步', exact: true }).click();
    }
    assert.equal(await demo1.getAttribute('data-step'), '3');
    if (width === 1440) {
      await demo1.screenshot({ path: path.join(output, 'l1-demo-step3-1440.png') });
    }

    // Play & verify canvas pixels animate, then pause
    await demo1.getByRole('button', { name: '▶ 播放演示', exact: true }).click();
    assert.equal(await demo1.getAttribute('data-playing'), 'true');
    const canvas1 = demo1.locator('[data-canvas="plot"]');
    const frameA = await canvas1.evaluate((el) => el.toDataURL());
    await page.waitForFunction(
      (prev) => {
        const host = document.querySelector('param-learning-demo');
        const c = host?.shadowRoot?.querySelector('[data-canvas="plot"]');
        return c && c.toDataURL() !== prev;
      },
      frameA,
      { timeout: 5000 }
    );
    await demo1.getByRole('button', { name: 'Ⅱ 暂停', exact: true }).click();
    assert.equal(await demo1.getAttribute('data-playing'), 'false');

    const slider1 = demo1.getByRole('slider', { name: '演示步骤' });
    await slider1.focus();
    await slider1.press('End');
    assert.equal(await demo1.getAttribute('data-best-weight'), '2');
    assert.equal(await demo1.getAttribute('data-prediction'), '8');
    if (width === 1440) {
      await demo1.screenshot({ path: path.join(output, 'l1-demo-step9-1440.png') });
    } else {
      await demo1.screenshot({ path: path.join(output, 'l1-demo-step9-390.png') });
    }

    await demo1.locator('[data-mode="triple"]').click();
    await slider1.focus();
    await slider1.press('End');
    assert.equal(await demo1.getAttribute('data-best-weight'), '3');
    assert.equal(await demo1.getAttribute('data-prediction'), '12');

    // Lesson 2
    const l2Resp = await page.goto(`${base}/tutorials/tagent-lesson02/`, { waitUntil: 'domcontentloaded' });
    assert.equal(l2Resp.status(), 200);
    const l2Diagram = page.locator('.article-body .mermaid-host').first();
    await l2Diagram.waitFor({ timeout: 30000 });
    await l2Diagram.scrollIntoViewIfNeeded();
    await l2Diagram.locator('svg').waitFor({ timeout: 30000 });
    assert.equal(await page.locator('.article-body .mermaid-host svg').count(), 1);

    const demo2 = page.locator('step-adjust-demo');
    await demo2.waitFor();
    await page.waitForFunction(
      () => document.querySelector('step-adjust-demo')?.getAttribute('data-ready') === 'true',
      null,
      { timeout: 15000 }
    );
    await demo2.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);

    // Step to round 5 on fine mode -> capture mid-descent
    for (let i = 0; i < 5; i += 1) {
      await demo2.getByRole('button', { name: '下一步', exact: true }).click();
    }
    if (width === 1440) {
      await demo2.screenshot({ path: path.join(output, 'l2-demo-fine-mid-1440.png') });
    }

    const slider2 = demo2.getByRole('slider', { name: '演示步骤' });
    await slider2.focus();
    await slider2.press('End');
    assert.equal(await demo2.getAttribute('data-weight'), '2.5');
    assert.equal(await demo2.getAttribute('data-prediction'), '10');
    if (width === 1440) {
      await demo2.screenshot({ path: path.join(output, 'l2-demo-fine-end-1440.png') });
    }

    // Coarse step = 1.0 -> stuck at 2.0
    await demo2.locator('[data-mode="coarse"]').click();
    await slider2.focus();
    await slider2.press('Previous').catch(() => {});
    await slider2.focus();
    await slider2.press('End');
    assert.equal(await demo2.getAttribute('data-weight'), '2');
    assert.equal(await demo2.getAttribute('data-prediction'), '8');
    if (width === 1440) {
      await demo2.locator('[data-action="previous"]').click();
      await demo2.screenshot({ path: path.join(output, 'l2-demo-coarse-stuck-1440.png') });
    } else {
      await demo2.screenshot({ path: path.join(output, 'l2-demo-390.png') });
    }

    // Reverse start
    await demo2.locator('[data-mode="reverse"]').click();
    await slider2.focus();
    await slider2.press('End');
    assert.equal(await demo2.getAttribute('data-weight'), '2.5');
    assert.equal(await demo2.getAttribute('data-prediction'), '10');

    // Dark theme screenshot on Lesson 2 before Lesson 3 (and switch back to light)
    if (width === 1440) {
      const darkBtn = page.getByRole('button', { name: '深色' });
      if (await darkBtn.count()) {
        await darkBtn.first().click();
        await page.waitForTimeout(150);
        await demo2.screenshot({ path: path.join(output, 'l2-demo-dark-1440.png') });
        const lightBtn = page.getByRole('button', { name: '浅色' });
        if (await lightBtn.count()) {
          await lightBtn.first().click();
          await page.waitForTimeout(120);
        }
      }
    }

    // Lesson 3
    const l3Resp = await page.goto(`${base}/tutorials/tagent-lesson03/`, { waitUntil: 'domcontentloaded' });
    assert.equal(l3Resp.status(), 200);
    const l3Diagram = page.locator('.article-body .mermaid-host').first();
    await l3Diagram.waitFor({ timeout: 30000 });
    await l3Diagram.scrollIntoViewIfNeeded();
    await l3Diagram.locator('svg').waitFor({ timeout: 30000 });
    assert.equal(await page.locator('.article-body .mermaid-host svg').count(), 1);

    const demo3 = page.locator('two-param-demo');
    await demo3.waitFor();
    await page.waitForFunction(
      () => document.querySelector('two-param-demo')?.getAttribute('data-ready') === 'true',
      null,
      { timeout: 15000 }
    );
    await demo3.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);

    // Click cell (w=3, b=2) directly on the 5x5 matrix canvas -> step 1 + 3*5 + 2 = 18
    const canvas3 = demo3.locator('[data-canvas="plot"]');
    const box3 = await canvas3.boundingBox();
    assert.ok(box3);
    const cellCenterX = box3.x + ((72 + 2 * 69 + 33) / 440) * box3.width;
    const cellCenterY = box3.y + ((278 + 3 * 30 + 13) / 436) * box3.height;
    await page.mouse.click(cellCenterX, cellCenterY);
    assert.equal(await demo3.getAttribute('data-step'), '18');
    assert.equal(await demo3.getAttribute('data-best-weight'), '3');
    assert.equal(await demo3.getAttribute('data-best-bias'), '2');
    if (width === 1440) {
      await demo3.screenshot({ path: path.join(output, 'l3-demo-cell32-1440.png') });
    }

    const slider3 = demo3.getByRole('slider', { name: '演示步骤' });
    await slider3.focus();
    await slider3.press('End');
    assert.equal(await demo3.getAttribute('data-prediction'), '14');
    if (width === 1440) {
      await demo3.screenshot({ path: path.join(output, 'l3-demo-end-1440.png') });
    } else {
      await demo3.screenshot({ path: path.join(output, 'l3-demo-390.png') });
    }

    await demo3.locator('[data-mode="affine24"]').click();
    await slider3.focus();
    await slider3.press('End');
    assert.equal(await demo3.getAttribute('data-best-weight'), '2');
    assert.equal(await demo3.getAttribute('data-best-bias'), '4');
    assert.equal(await demo3.getAttribute('data-prediction'), '12');

    // Lesson 4
    const l4Resp = await page.goto(`${base}/tutorials/tagent-lesson04/`, { waitUntil: 'domcontentloaded' });
    assert.equal(l4Resp.status(), 200);
    const l4Diagram = page.locator('.article-body .mermaid-host').first();
    await l4Diagram.waitFor({ timeout: 30000 });
    await l4Diagram.scrollIntoViewIfNeeded();
    await l4Diagram.locator('svg').waitFor({ timeout: 30000 });
    assert.equal(await page.locator('.article-body .mermaid-host svg').count(), 1);

    const demo4 = page.locator('train-test-demo');
    await demo4.waitFor();
    await page.waitForFunction(
      () => document.querySelector('train-test-demo')?.getAttribute('data-ready') === 'true',
      null,
      { timeout: 15000 }
    );
    await demo4.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);

    await demo4.getByRole('button', { name: '▶ 播放演示', exact: true }).click();
    const canvas4 = demo4.locator('[data-canvas="plot"]');
    const frame4A = await canvas4.evaluate((el) => el.toDataURL());
    await page.waitForFunction(
      (prev) => {
        const host = document.querySelector('train-test-demo');
        const c = host?.shadowRoot?.querySelector('[data-canvas="plot"]');
        return c && c.toDataURL() !== prev;
      },
      frame4A,
      { timeout: 6000 }
    );
    await demo4.getByRole('button', { name: 'Ⅱ 暂停', exact: true }).click();

    const slider4 = demo4.getByRole('slider', { name: '演示步骤' });
    await slider4.focus();
    await slider4.press('End');
    assert.equal(await demo4.getAttribute('data-best-weight'), '2');
    assert.equal(await demo4.getAttribute('data-best-bias'), '0');
    assert.equal(await demo4.getAttribute('data-train-error'), '0');
    assert.equal(await demo4.getAttribute('data-test-error'), '5');
    if (width === 1440) {
      await demo4.screenshot({ path: path.join(output, 'l4-demo-end-1440.png') });
    } else {
      await demo4.screenshot({ path: path.join(output, 'l4-demo-390.png') });
    }

    await demo4.locator('[data-mode="linear_ex"]').click();
    await slider4.focus();
    await slider4.press('End');
    assert.equal(await demo4.getAttribute('data-best-weight'), '2');
    assert.equal(await demo4.getAttribute('data-best-bias'), '1');
    assert.equal(await demo4.getAttribute('data-test-error'), '0');

    // Lesson 5
    const l5Resp = await page.goto(`${base}/tutorials/tagent-lesson05/`, { waitUntil: 'domcontentloaded' });
    assert.equal(l5Resp.status(), 200);
    const l5Diagram = page.locator('.article-body .mermaid-host').first();
    await l5Diagram.waitFor({ timeout: 30000 });
    await l5Diagram.scrollIntoViewIfNeeded();
    await l5Diagram.locator('svg').waitFor({ timeout: 30000 });
    assert.equal(await page.locator('.article-body .mermaid-host svg').count(), 1);

    const demo5 = page.locator('feature-transform-demo');
    await demo5.waitFor();
    await page.waitForFunction(
      () => document.querySelector('feature-transform-demo')?.getAttribute('data-ready') === 'true',
      null,
      { timeout: 15000 }
    );
    await demo5.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);

    await demo5.getByRole('button', { name: '▶ 播放演示', exact: true }).click();
    const canvas5 = demo5.locator('[data-canvas="plot"]');
    const frame5A = await canvas5.evaluate((el) => el.toDataURL());
    await page.waitForFunction(
      (prev) => {
        const host = document.querySelector('feature-transform-demo');
        const c = host?.shadowRoot?.querySelector('[data-canvas="plot"]');
        return c && c.toDataURL() !== prev;
      },
      frame5A,
      { timeout: 6000 }
    );
    await demo5.getByRole('button', { name: 'Ⅱ 暂停', exact: true }).click();

    const slider5 = demo5.getByRole('slider', { name: '演示步骤' });
    await slider5.focus();
    await slider5.press('End');
    assert.equal(await demo5.getAttribute('data-best-weight'), '1');
    assert.equal(await demo5.getAttribute('data-best-bias'), '0');
    assert.equal(await demo5.getAttribute('data-train-error'), '0');
    assert.equal(await demo5.getAttribute('data-test-error'), '0');
    if (width === 1440) {
      await demo5.screenshot({ path: path.join(output, 'l5-demo-end-1440.png') });
    } else {
      await demo5.screenshot({ path: path.join(output, 'l5-demo-390.png') });
    }

    await demo5.locator('[data-mode="exp_exercise"]').click();
    await slider5.focus();
    await slider5.press('End');
    assert.equal(await demo5.getAttribute('data-best-weight'), '3');
    assert.equal(await demo5.getAttribute('data-best-bias'), '1');
    assert.equal(await demo5.getAttribute('data-test-error'), '0');
    if (width === 1440) {
      await demo5.screenshot({ path: path.join(output, 'l5-demo-ex-1440.png') });
    }

    // Download parity checks
    for (const file of ['lesson01.py', 'lesson02.py', 'lesson03.py', 'lesson04.py', 'lesson05.py']) {
      const pyResp = await context.request.get(`${base}/examples/agent/${file}`);
      assert.equal(pyResp.status(), 200);
      const localPy = await fs.readFile(path.resolve(`public/examples/agent/${file}`), 'utf8');
      assert.equal((await pyResp.text()).replaceAll('\r\n', '\n'), localPy.replaceAll('\r\n', '\n'));
    }

    const overflow2 = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
      body: document.body.scrollWidth
    }));
    assert.ok(
      overflow2.scroll <= overflow2.viewport + 1 && overflow2.body <= overflow2.viewport + 1,
      JSON.stringify(overflow2)
    );
    assert.deepEqual(errors, []);
    await context.close();
  }

  const indexContext = await browser.newContext();
  const tutorialsHtml = await (await indexContext.request.get(`${base}/tutorials/`)).text();
  assert.ok(tutorialsHtml.includes('Agent 从零实战'));
  await indexContext.close();

  // Verify early route switching works unblocked before Rem silently loads after idle
  const navCtx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
  });
  const navPage = await navCtx.newPage();
  const navErrors = [];
  navPage.on('pageerror', (err) => navErrors.push(err.message));
  const heavyReqsBeforeNav = [];
  let switched = false;
  navPage.on('request', (req) => {
    const u = req.url();
    if (!switched && (u.includes('live2d.min.js') || u.includes('remu.moc') || u.includes('texture_00'))) {
      heavyReqsBeforeNav.push(u);
    }
  });
  await navPage.goto(`${base}/tutorials/agent/`, { waitUntil: 'domcontentloaded' });
  await Promise.all([
    navPage.waitForURL(/\/tutorials\/tagent-lesson04/, { waitUntil: 'commit', timeout: 8000 }),
    navPage.click('a[href="/tutorials/tagent-lesson04/"]')
  ]);
  switched = true;
  assert.deepEqual(heavyReqsBeforeNav, []);
  await navPage.waitForFunction(() => Boolean(document.getElementById('live2d-canvas')?.__live2dLoaded), null, {
    timeout: 12000
  });
  await navPage.waitForTimeout(300);
  const mascotSilentDone = await navPage.evaluate(() => {
    const w = document.getElementById('fly-mascot-widget');
    return w ? !w.classList.contains('is-silent-loading') : false;
  });
  assert.equal(mascotSilentDone, true);
  assert.deepEqual(navErrors, []);
  await navCtx.close();

  console.log(JSON.stringify({ ok: true, output }, null, 2));
} finally {
  await browser.close();
}

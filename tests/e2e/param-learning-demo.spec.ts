import { expect, test } from '@playwright/test';

const seriesRoute = '/tutorials/agent/';
const lesson1Route = '/tutorials/tagent-lesson01/';
const lesson2Route = '/tutorials/tagent-lesson02/';
const lesson3Route = '/tutorials/tagent-lesson03/';

test('agent tutorial series and lesson 1 render Mermaid diagrams and interactive parameter demo cleanly', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto(seriesRoute, { waitUntil: 'domcontentloaded' });
  const seriesDiagram = page.locator('.mermaid-host').first();
  await seriesDiagram.waitFor({ timeout: 12_000 });
  await seriesDiagram.scrollIntoViewIfNeeded();
  await expect(seriesDiagram.locator('svg')).toBeVisible({ timeout: 12_000 });
  await expect(page.locator(`a[href="${lesson1Route}"]`).first()).toBeVisible();
  await expect(page.locator(`a[href="${lesson2Route}"]`).first()).toBeVisible();
  await expect(page.locator(`a[href="${lesson3Route}"]`).first()).toBeVisible();

  await page.goto(lesson1Route, { waitUntil: 'domcontentloaded' });
  for (const idx of [0, 1]) {
    const m = page.locator('.mermaid-host').nth(idx);
    await m.waitFor({ timeout: 12_000 });
    await m.scrollIntoViewIfNeeded();
    await expect(m.locator('svg')).toBeVisible({ timeout: 12_000 });
  }
  await expect(page.locator('.mermaid-host svg')).toHaveCount(2);

  const demo = page.locator('param-learning-demo');
  await expect(demo).toHaveAttribute('data-ready', 'true', { timeout: 12_000 });
  await expect(demo).toHaveAttribute('data-mode', 'double');
  await expect(demo).toHaveAttribute('data-step', '0');

  for (let i = 0; i < 9; i += 1) {
    await demo.getByRole('button', { name: '下一步', exact: true }).click();
  }
  await expect(demo).toHaveAttribute('data-step', '9');
  await expect(demo).toHaveAttribute('data-best-weight', '2');
  await expect(demo).toHaveAttribute('data-prediction', '8');

  await demo.locator('[data-mode="triple"]').click();
  await expect(demo).toHaveAttribute('data-mode', 'triple');
  await expect(demo).toHaveAttribute('data-step', '0');

  const slider = demo.getByRole('slider', { name: '演示步骤' });
  await slider.focus();
  await slider.press('End');
  await expect(demo).toHaveAttribute('data-step', '9');
  await expect(demo).toHaveAttribute('data-best-weight', '3');
  await expect(demo).toHaveAttribute('data-prediction', '12');

  const layoutMetrics = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth
  }));
  expect(layoutMetrics.page).toBeLessThanOrEqual(layoutMetrics.viewport + 1);
  expect(errors).toEqual([]);
});

test('lesson 2 step-adjust demo walks down error valley, shows coarse overshoot, and keeps static fallback', async ({ page, browser }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto(lesson2Route, { waitUntil: 'domcontentloaded' });
  const l2Diagram = page.locator('.mermaid-host').first();
  await l2Diagram.waitFor({ timeout: 12_000 });
  await l2Diagram.scrollIntoViewIfNeeded();
  await expect(l2Diagram.locator('svg')).toBeVisible({ timeout: 12_000 });

  const demo = page.locator('step-adjust-demo');
  await expect(demo).toHaveAttribute('data-ready', 'true', { timeout: 12_000 });
  await expect(demo).toHaveAttribute('data-mode', 'fine');

  const slider = demo.getByRole('slider', { name: '演示步骤' });
  await slider.focus();
  await slider.press('End');
  await expect(demo).toHaveAttribute('data-weight', '2.5');
  await expect(demo).toHaveAttribute('data-prediction', '10');

  // Switch to coarse step = 1.0 -> gets stranded at 2.0 -> predicts 8
  await demo.locator('[data-mode="coarse"]').click();
  await expect(demo).toHaveAttribute('data-mode', 'coarse');
  await slider.focus();
  await slider.press('End');
  await expect(demo).toHaveAttribute('data-weight', '2');
  await expect(demo).toHaveAttribute('data-prediction', '8');

  // Switch to reverse start -> steps left from 3.5 to 2.5
  await demo.locator('[data-mode="reverse"]').click();
  await expect(demo).toHaveAttribute('data-mode', 'reverse');
  await slider.focus();
  await slider.press('End');
  await expect(demo).toHaveAttribute('data-weight', '2.5');
  await expect(demo).toHaveAttribute('data-prediction', '10');

  await demo.getByRole('button', { name: '放大演示 ↗', exact: true }).click();
  await expect(demo.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(demo.getByRole('dialog')).not.toBeVisible();

  const layoutMetrics = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth
  }));
  expect(layoutMetrics.page).toBeLessThanOrEqual(layoutMetrics.viewport + 1);
  expect(errors).toEqual([]);

  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const staticPage = await context.newPage();
    await staticPage.goto(page.url(), { waitUntil: 'domcontentloaded' });
    await expect(staticPage.locator(demo)).toContainText('step = 0.1');
  } finally {
    await context.close();
  }
});

test('lesson 3 two-param demo scans 25 pairs, switches to exercise 2x+4, and keeps static fallback', async ({ page, browser }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto(lesson3Route, { waitUntil: 'domcontentloaded' });
  const l3Diagram = page.locator('.mermaid-host').first();
  await l3Diagram.waitFor({ timeout: 12_000 });
  await l3Diagram.scrollIntoViewIfNeeded();
  await expect(l3Diagram.locator('svg')).toBeVisible({ timeout: 12_000 });

  const demo = page.locator('two-param-demo');
  await expect(demo).toHaveAttribute('data-ready', 'true', { timeout: 12_000 });

  const slider = demo.getByRole('slider', { name: '演示步骤' });
  await slider.focus();
  await slider.press('End');
  await expect(demo).toHaveAttribute('data-best-weight', '3');
  await expect(demo).toHaveAttribute('data-best-bias', '2');
  await expect(demo).toHaveAttribute('data-prediction', '14');

  await demo.locator('[data-mode="affine24"]').click();
  await slider.focus();
  await slider.press('End');
  await expect(demo).toHaveAttribute('data-best-weight', '2');
  await expect(demo).toHaveAttribute('data-best-bias', '4');
  await expect(demo).toHaveAttribute('data-prediction', '12');

  expect(errors).toEqual([]);

  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const staticPage = await context.newPage();
    await staticPage.goto(page.url(), { waitUntil: 'domcontentloaded' });
    await expect(staticPage.locator(demo)).toContainText('25 组组合');
  } finally {
    await context.close();
  }
});

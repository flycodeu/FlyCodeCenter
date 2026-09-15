import { expect, test, type Locator } from '@playwright/test';

const route = '/tutorials/tffmpeg-bitstream/';
const predictionSelector = 'video-coding-demo[lesson="prediction"]';
const orderSelector = 'video-coding-demo[lesson="frame-order"]';

async function samplePixel(canvas: Locator, column: number) {
  return canvas.evaluate((element, col) => {
    const canvas = element as HTMLCanvasElement;
    const scale = canvas.width / 264;
    return [...canvas.getContext('2d')!.getImageData((12 + col * 20 + 10) * scale, (12 + 3 * 20 + 10) * scale, 1, 1).data];
  }, column);
}

test('I/P/B have different prediction sources but all reconstruct the current pixels', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(route);
  const demo = page.locator(predictionSelector);
  await expect(demo).toHaveAttribute('data-ready', 'true');
  for (const mode of ['I', 'P', 'B']) {
    await demo.locator(`[data-mode="${mode}"]`).click();
    await expect(demo.locator(`[data-mode="${mode}"]`)).toBeFocused();
    await demo.getByRole('button', { name: '下一步', exact: true }).click();
    await demo.getByRole('button', { name: '下一步', exact: true }).click();
    expect(await samplePixel(demo.locator('[data-canvas="result"]'), mode === 'B' ? 6 : 7)).toEqual(mode === 'I' ? [40, 40, 40, 255] : [180, 180, 180, 255]);
    await demo.getByRole('button', { name: '下一步', exact: true }).click();
    await expect(demo.locator('[data-formula]')).toContainText(mode === 'I' ? '差值 200' : '差值 60');
    await demo.getByRole('button', { name: '下一步', exact: true }).click();
    expect(await samplePixel(demo.locator('[data-canvas="result"]'), mode === 'B' ? 6 : 7)).toEqual([240, 240, 240, 255]);
    await demo.getByRole('checkbox').uncheck();
    expect(await samplePixel(demo.locator('[data-canvas="result"]'), mode === 'B' ? 6 : 7)).toEqual([180, 180, 180, 255]);
    await demo.getByRole('checkbox').check();
  }
  const sizes = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, page: document.documentElement.scrollWidth }));
  expect(sizes.page).toBeLessThanOrEqual(sizes.viewport + 1);
  expect(errors).toEqual([]);
});

test('motion actually animates, pauses, and supports keyboard step navigation', async ({ page }) => {
  await page.goto(route);
  const demo = page.locator(predictionSelector);
  await expect(demo).toHaveAttribute('data-ready', 'true');
  const range = demo.getByRole('slider', { name: '演示步骤' });
  await range.focus();
  await range.press('Home');
  await range.press('ArrowRight');
  await range.press('ArrowRight');
  await expect(demo).toHaveAttribute('data-step', '2');
  await demo.getByRole('button', { name: '▶ 播放演示', exact: true }).click();
  const result = demo.locator('[data-canvas="result"]');
  const first = await result.evaluate(element => (element as HTMLCanvasElement).toDataURL());
  await expect.poll(() => result.evaluate(element => (element as HTMLCanvasElement).toDataURL())).not.toBe(first);
  await demo.getByRole('button', { name: 'Ⅱ 暂停', exact: true }).click();
  const stopped = await result.evaluate(element => (element as HTMLCanvasElement).toDataURL());
  await page.waitForTimeout(400);
  expect(await result.evaluate(element => (element as HTMLCanvasElement).toDataURL())).toBe(stopped);
  await demo.getByRole('button', { name: '从头开始', exact: true }).click();
  await expect(demo).toHaveAttribute('data-step', '0');
  await expect(demo).toHaveAttribute('data-playing', 'false');
});

test('B waits for both references and playback follows display order; instances remain independent', async ({ page }) => {
  await page.goto(route);
  const order = page.locator(orderSelector);
  await expect(order).toHaveAttribute('data-ready', 'true');
  for (const decoded of ['I0', 'I0,P2', 'I0,P2,B1']) {
    await order.getByRole('button', { name: '下一步', exact: true }).click();
    await expect(order).toHaveAttribute('data-decoded', decoded);
    await expect(order).toHaveAttribute('data-output', '');
  }
  for (const output of ['I0', 'B1', 'P2']) {
    await order.getByRole('button', { name: '下一步', exact: true }).click();
    await expect(order).toHaveAttribute('data-output', output);
  }
  await expect(page.locator(predictionSelector)).toHaveAttribute('data-step', '0');
  await order.getByRole('button', { name: '从头开始', exact: true }).click();
  await expect(order).toHaveAttribute('data-decoded', '');
  await order.getByRole('combobox', { name: '演示速度' }).selectOption('2');
  await order.getByRole('button', { name: '▶ 播放演示', exact: true }).click();
  await expect(order).toHaveAttribute('data-step', '1', { timeout: 4000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(order).toHaveAttribute('data-playing', 'false');
  await order.evaluate(element => element.remove());
});

test('reduced motion keeps the moving patch still; static text survives without JavaScript', async ({ page, browser }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(route);
  const demo = page.locator(predictionSelector);
  await expect(demo).toHaveAttribute('data-ready', 'true');
  await demo.getByRole('button', { name: '下一步', exact: true }).click();
  await demo.getByRole('button', { name: '下一步', exact: true }).click();
  await demo.getByRole('button', { name: '▶ 播放演示', exact: true }).click();
  const result = demo.locator('[data-canvas="result"]');
  const first = await result.evaluate(element => (element as HTMLCanvasElement).toDataURL());
  await page.waitForTimeout(300);
  expect(await result.evaluate(element => (element as HTMLCanvasElement).toDataURL())).toBe(first);
  await demo.getByRole('button', { name: 'Ⅱ 暂停', exact: true }).click();
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const staticPage = await context.newPage();
    await staticPage.goto(page.url());
    await expect(staticPage.locator(predictionSelector)).toContainText('预测加差值');
    await expect(staticPage.locator(orderSelector)).toContainText('显示顺序仍为');
  } finally { await context.close(); }
});

test('expanded view keeps controls available, preserves frame switching, and closes with Escape', async ({ page }) => {
  await page.goto(route);
  const demo = page.locator(predictionSelector);
  await expect(demo).toHaveAttribute('data-ready', 'true');
  await demo.getByRole('button', { name: '放大演示 ↗', exact: true }).click();
  await expect(demo.getByRole('dialog')).toBeVisible();
  await demo.locator('[data-mode="B"]').click();
  await expect(demo.getByRole('dialog')).toBeVisible();
  await expect(demo).toHaveAttribute('data-mode', 'B');
  await demo.getByRole('button', { name: '下一步', exact: true }).click();
  await expect(demo).toHaveAttribute('data-step', '1');
  await demo.getByRole('button', { name: '▶ 播放演示', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(demo.getByRole('dialog')).not.toBeVisible();
  await expect(demo).toHaveAttribute('data-playing', 'false');
  await expect(demo.getByRole('button', { name: '放大演示 ↗', exact: true })).toBeFocused();
});

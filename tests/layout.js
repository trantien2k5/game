import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const base = process.env.GAME_URL || 'http://127.0.0.1:4173';
const errors = [];
const results = [];
await mkdir('artifacts/layout', { recursive: true });
const sizes = [
  [1920, 1080],
  [1440, 900],
  [1366, 768],
  [1280, 720],
  [1024, 600],
  [932, 430],
  [844, 390],
  [740, 360],
  [667, 375],
  [568, 320],
  [390, 844],
  [320, 640],
  [768, 1024],
];
const screenshotSizes = new Set(['1366x768', '844x390', '568x320', '390x844']);
async function audit(page, label, farm = true) {
  const dimensions = await page.evaluate((isFarm) => {
    const selectors = isFarm
      ? [
          '.topbar',
          '.resource-bar',
          '.header-actions',
          '.navigation',
          '.world-section',
          '.world-scroll',
          '.planting-section',
          '#quest-strip',
          '.seed',
          '.tool-button',
          '.nav-button',
          '[data-action="settings"]',
        ]
      : ['.topbar', '.navigation', '#side-panel', '#panel-content'];
    const outside = [];
    for (const selector of selectors)
      for (const el of document.querySelectorAll(selector)) {
        const style = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height || style.visibility === 'hidden') continue;
        if (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1)
          outside.push({ selector, x: r.x, y: r.y, width: r.width, height: r.height });
      }
    return {
      width: innerWidth,
      height: innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      outside,
    };
  }, farm);
  assert.ok(dimensions.scrollWidth <= dimensions.width + 1, `${label}: document width`);
  assert.ok(dimensions.scrollHeight <= dimensions.height + 1, `${label}: document height`);
  assert.deepEqual(dimensions.outside, [], `${label}: clipped controls`);
  await page.evaluate(() => window.scrollTo(200, 200));
  assert.deepEqual(await page.evaluate(() => [scrollX, scrollY]), [0, 0], `${label}: page must not scroll`);
}
try {
  for (const [width, height] of sizes) {
    const label = `${width}x${height}`;
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: width < 1000,
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(`${label}: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(`${label}: ${m.text()}`);
    });
    await page.goto(base);
    await page.waitForSelector('.plot');
    await page.waitForTimeout(250);
    if (screenshotSizes.has(label)) await page.screenshot({ path: `artifacts/layout/${label}.png` });
    await audit(page, label);
    // All 25 plot hit areas remain visible before zooming, including future land.
    const clippedPlots = await page.locator('#farm-world').evaluate((svg) => {
      const frame = svg.getBoundingClientRect();
      return [...svg.querySelectorAll('.plot')]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return (
            r.left < frame.left - 1 ||
            r.right > frame.right + 1 ||
            r.top < frame.top - 1 ||
            r.bottom > frame.bottom + 1
          );
        })
        .map((el) => el.dataset.plot);
    });
    assert.deepEqual(clippedPlots, [], `${label}: initial farm framing`);
    const farmTap = async (selector) =>
      width < 1000 ? page.locator(selector).tap() : page.locator(selector).click();
    await farmTap('[data-plot="6"]');
    await page.locator('[data-action="seed"][data-crop="mint"]').click();
    await farmTap('[data-plot="6"]');
    await page.locator('[data-mode="water"]').click();
    await farmTap('[data-plot="6"]');
    assert.ok((await page.locator('[data-plot="6"]').getAttribute('aria-label')).includes('Bạc hà'));
    await page.locator('[data-action="zoom-in"]').click();
    const before = await page.locator('#farm-world').getAttribute('viewBox');
    const map = await page.locator('#farm-world').boundingBox();
    const actionStats = () =>
      page.evaluate(() => JSON.parse(localStorage.getItem('mach-vuon.save.v1')).state.stats);
    const beforeDrag = await actionStats();
    if (width < 1000) {
      const cdp = await context.newCDPSession(page);
      const x = map.x + map.width * 0.45,
        y = map.y + map.height * 0.6;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      for (let step = 1; step <= 8; step++)
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ x: x + step * 6, y }],
        });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await cdp.detach();
    } else {
      await page.mouse.move(map.x + map.width * 0.45, map.y + map.height * 0.6);
      await page.mouse.down();
      await page.mouse.move(map.x + map.width * 0.45 + 50, map.y + map.height * 0.6, { steps: 8 });
      await page.mouse.up();
    }
    assert.deepEqual(await actionStats(), beforeDrag, `${label}: panning cannot trigger a farm action`);
    assert.notEqual(await page.locator('#farm-world').getAttribute('viewBox'), before, `${label}: map drag`);
    await audit(page, `${label} zoom and pan`);
    await page.locator('[data-action="zoom-out"]').click();
    for (const tab of ['production', 'inventory', 'orders', 'growth', 'journal']) {
      const control = tab === 'journal' ? '.level-resource' : `.nav-main [data-tab="${tab}"]`;
      await page.locator(control).click();
      await audit(page, `${label} ${tab}`, false);
      if (tab === 'journal') {
        const panel = page.locator('#panel-content');
        await panel.evaluate((el) => {
          el.scrollTop = el.scrollHeight;
        });
        assert.ok(await panel.evaluate((el) => el.scrollTop > 0), `${label}: long journal is reachable`);
        const finalLevel = await page.locator('.level-stop').last().boundingBox();
        assert.ok(finalLevel.y + finalLevel.height <= height + 1, `${label}: final unlock reachable`);
      }
    }
    if (await page.locator('#app').evaluate((el) => el.classList.contains('single-panel'))) {
      await page.locator('.panel-return').focus();
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#main').evaluate((el) => el.inert), false);
    } else await page.locator('.nav-main [data-tab="farm"]').click();
    await audit(page, `${label} return`);
    await page.locator('[data-action="settings"]').click();
    const dialog = await page.locator('dialog').boundingBox();
    assert.ok(dialog.y >= 0 && dialog.y + dialog.height <= height, `${label}: dialog contained`);
    await page.keyboard.press('Escape');
    results.push(
      `${label}: farm, all seeds, tools, navigation, panels, zoom/pan and dialogs fit; page does not scroll`
    );
    await context.close();
  }
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await context.newPage();
  await page.goto(base);
  await page.waitForSelector('.plot');
  await page.locator('.nav-main [data-tab="production"]').click();
  for (const size of [
    { width: 844, height: 390 },
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size);
    await page.waitForTimeout(200);
    await audit(page, `Orientation ${size.width}`, false);
  }
  await page.locator('.panel-return').click();
  await audit(page, 'Orientation back to farm');
  await context.close();
  assert.deepEqual(errors, []);
  console.log(results.join('\n'));
  console.log('Orientation changes preserve the active tab. No console/runtime errors.');
  await writeFile('artifacts/layout/report.json', JSON.stringify({ results, errors }, null, 2));
} finally {
  await browser.close();
}

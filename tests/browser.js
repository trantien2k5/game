import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createState } from '../src/state.js';
import { ensureOrders } from '../src/simulation.js';
import { encodeSave } from '../src/persistence.js';
import { SAVE_KEY, LEVELS } from '../src/data.js';

await mkdir('artifacts', { recursive: true });
const base = process.env.GAME_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const errors = [],
  requests = [],
  results = [];
function watch(page) {
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('response', (r) => {
    if (r.status() >= 400) requests.push(`${r.status()} ${r.url()}`);
  });
}
const stateOf = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)).state, SAVE_KEY);
const tick = async (page, ms) => {
  await page.clock.fastForward(ms);
  await page.waitForTimeout(350);
};
const click = async (page, selector) => {
  await page.locator(selector).first().click();
  await page.waitForTimeout(100);
};
async function noOverflow(page, label) {
  const v = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: innerWidth }));
  assert.ok(v.scroll <= v.width + 1, `${label}: horizontal overflow ${v.scroll}>${v.width}`);
  results.push(`${label}: no page overflow`);
}
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1040 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  watch(page);
  await page.clock.install({ time: new Date() });
  await page.goto(base);
  await page.waitForSelector('.plot');
  await page.waitForFunction((key) => !!localStorage.getItem(key), SAVE_KEY);
  assert.equal(await page.locator('.plot').count(), 25);
  assert.equal(await page.locator('.seed').count(), 6);
  await noOverflow(page, 'Desktop 1440');
  await page.screenshot({ path: 'artifacts/desktop-initial.png', fullPage: true });
  await click(page, '[data-plot="6"]');
  let s = await stateOf(page);
  assert.equal(s.inventory.radish, 2);
  assert.equal(s.stats.harvests, 1);
  assert.equal(s.stats.pulses, 1);
  await click(page, '[data-action="seed"][data-crop="mint"]');
  await click(page, '[data-plot="6"]');
  s = await stateOf(page);
  assert.equal(s.plots[6].crop.type, 'mint');
  assert.equal(s.plots[6].crop.rotation, true);
  await click(page, '[data-mode="water"]');
  await click(page, '[data-plot="6"]');
  s = await stateOf(page);
  assert.equal(s.plots[6].crop.watered, true);
  const water = s.water;
  await click(page, '[data-plot="6"]');
  s = await stateOf(page);
  assert.equal(s.water, water);
  await click(page, '[data-mode="plant"]');
  await click(page, '[data-tab="production"]');
  await click(page, '[data-recipe="tea"]');
  s = await stateOf(page);
  assert.equal(s.buildings.mill.queue.length, 1);
  assert.equal(s.inventory.mint, 0);
  await tick(page, 70000);
  await click(page, '[data-action="collect"][data-building="mill"]');
  s = await stateOf(page);
  assert.equal(s.inventory.tea, 1);
  await click(page, '[data-plot="6"]');
  s = await stateOf(page);
  assert.equal(s.inventory.mint, 4);
  await click(page, '[data-tab="inventory"]');
  const before = (await stateOf(page)).coins;
  await click(page, '[data-action="sell"][data-item="tea"][data-quantity="1"]');
  s = await stateOf(page);
  assert.equal(s.inventory.tea, 0);
  assert.ok(s.coins > before);
  results.push(
    'UI: plant, rotation, pulse, one-time watering, elapsed growth, harvest, production, collect and sell'
  );
  const saved = await stateOf(page);
  await page.reload();
  await page.waitForSelector('.plot');
  await page.waitForTimeout(300);
  s = await stateOf(page);
  assert.equal(s.coins, saved.coins);
  assert.deepEqual(s.inventory, saved.inventory);
  assert.equal(s.stats.harvests, saved.stats.harvests);
  results.push('Reload preserves inventory, currency and statistics');
  const other = await context.newPage();
  watch(other);
  await other.goto(base);
  await other.waitForSelector('.locked-screen');
  assert.equal(await other.locator('.locked-screen').count(), 1);
  await other.close();
  results.push('Second tab cannot write the same farm');
  await click(page, '[data-action="help"]');
  assert.equal(await page.locator('dialog[open]').count(), 1);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('dialog[open]').count(), 0);
  const p = page.locator('[data-plot="8"]');
  await p.focus();
  await page.keyboard.press('Enter');
  s = await stateOf(page);
  assert.ok(s.plots[8].crop);
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.plot), '13');
  results.push('Keyboard planting, grid navigation, dialog Escape');
  await click(page, '[data-action="settings"]');
  await page.locator('[data-setting="sound"]').check();
  await page.locator('[data-setting="motion"]').uncheck();
  await click(page, '[data-action="close"]');
  s = await stateOf(page);
  assert.equal(s.settings.sound, true);
  assert.equal(s.settings.motion, false);
  results.push('Audio and reduced-motion controls');
  await context.close();

  const late = createState(Date.now());
  ensureOrders(late);
  late.xp = LEVELS.at(-1).xp + 200;
  late.coins = 6500;
  late.areas = { creek: true, sunny: true, hill: true };
  late.upgrades = { storage: 3, queue: 2, irrigation: 1, greenhouse: 1 };
  late.stats = {
    ...late.stats,
    harvests: 200,
    pulses: 85,
    orders: 30,
    products: 50,
    eggs: 8,
    expansions: 3,
    greenhouse: 1,
  };
  late.quest = 7;
  late.journalClaimed = [0, 1, 2, 3, 4, 5, 6];
  for (const b of Object.values(late.buildings)) b.owned = true;
  for (const id of Object.keys(late.inventory)) late.inventory[id] = 5;
  for (const p of late.plots) {
    p.prepared = true;
    p.soil = ['root', 'leaf', 'bloom'][p.id % 3];
    const type = ['radish', 'mint', 'wheat', 'carrot', 'blueberry', 'sunflower'][p.id % 6];
    p.crop = {
      type,
      plantedAt: 0,
      readyAt: p.id % 3 === 0 ? 0 : 50000,
      duration: 60000,
      pulses: p.id % 3,
      rotation: p.id % 2 === 0,
      watered: p.id % 2 === 0,
      bonus: 0,
    };
  }
  const full = await browser.newContext({ viewport: { width: 1440, height: 1040 }, deviceScaleFactor: 1 });
  await full.addInitScript(
    ({ key, text }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, text);
    },
    { key: SAVE_KEY, text: encodeSave(late) }
  );
  const latePage = await full.newPage();
  watch(latePage);
  await latePage.goto(base);
  await latePage.waitForSelector('.plot');
  await latePage.waitForTimeout(400);
  await latePage.screenshot({ path: 'artifacts/desktop-progressed.png', fullPage: true });
  for (const tab of ['production', 'inventory', 'growth', 'journal', 'orders', 'farm']) {
    await click(latePage, `[data-tab="${tab}"]`);
    await noOverflow(latePage, `Desktop ${tab}`);
  }
  await click(latePage, '[data-tab="production"]');
  await click(latePage, '[data-action="building"][data-building="press"]');
  await click(latePage, '[data-recipe="basket"]');
  assert.equal((await stateOf(latePage)).buildings.press.queue.length, 1);
  await click(latePage, '[data-tab="orders"]');
  const deliverBtn = latePage.locator('[data-action="deliver"]:not(:disabled)').first();
  const orderId = Number(await deliverBtn.getAttribute('data-id'));
  const order = (await stateOf(latePage)).orders.find((o) => o.id === orderId);
  const oldCoins = (await stateOf(latePage)).coins;
  await deliverBtn.click();
  await latePage.waitForTimeout(150);
  assert.equal((await stateOf(latePage)).coins, oldCoins + order.coins);
  await click(latePage, '[data-action="claim"]');
  assert.equal((await stateOf(latePage)).quest, 8);
  results.push('Late game: all panels, advanced production, customer delivery and final chapter');
  await click(latePage, '[data-tab="farm"]');
  await latePage.setViewportSize({ width: 1366, height: 768 });
  await noOverflow(latePage, 'Laptop 1366x768');
  await latePage.waitForTimeout(6800);
  await latePage.screenshot({ path: 'artifacts/laptop-progressed.png', fullPage: true });
  const tray = await latePage.locator('#seed-tray').boundingBox();
  assert.ok(tray.y + tray.height < 768, 'Seeds remain in the laptop first viewport');
  await full.close();

  const management = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const mid = createState(Date.now());
  ensureOrders(mid);
  mid.xp = LEVELS[3].xp;
  mid.coins = 1600;
  await management.addInitScript(
    ({ key, text }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, text);
    },
    { key: SAVE_KEY, text: encodeSave(mid) }
  );
  const manage = await management.newPage();
  watch(manage);
  await manage.goto(base);
  await manage.waitForSelector('.plot');
  await manage.waitForTimeout(300);
  await click(manage, '[data-tab="growth"]');
  await click(manage, '[data-action="expand"][data-area="creek"]');
  let managed = await stateOf(manage);
  assert.equal(managed.areas.creek, true);
  assert.equal(managed.coins, 1340);
  await click(manage, '[data-plot="10"]');
  assert.equal((await stateOf(manage)).plots[10].prepared, true);
  await click(manage, '[data-action="upgrade"][data-upgrade="storage"]');
  assert.equal((await stateOf(manage)).upgrades.storage, 1);
  await click(manage, '[data-tab="production"]');
  await click(manage, '[data-action="building"][data-building="coop"]');
  await click(manage, '[data-action="buy-building"][data-building="coop"]');
  assert.equal((await stateOf(manage)).buildings.coop.owned, true);
  results.push('UI expansion, new soil preparation, storage upgrade and building construction');
  await click(manage, '[data-action="settings"]');
  const downloadPromise = manage.waitForEvent('download');
  await click(manage, '[data-action="export"]');
  const download = await downloadPromise;
  assert.ok(download.suggestedFilename().endsWith('.json'));
  const chooserPromise = manage.waitForEvent('filechooser');
  await click(manage, '[data-action="import"]');
  const chooser = await chooserPromise;
  await chooser.setFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{bad') });
  await manage.waitForTimeout(200);
  assert.equal((await stateOf(manage)).buildings.coop.owned, true);
  const importState = createState(Date.now());
  ensureOrders(importState);
  importState.coins = 321;
  const validChooserPromise = manage.waitForEvent('filechooser');
  await click(manage, '[data-action="import"]');
  await (
    await validChooserPromise
  ).setFiles({
    name: 'garden.json',
    mimeType: 'application/json',
    buffer: Buffer.from(encodeSave(importState)),
  });
  await manage.locator('#confirm-import').click();
  await manage.waitForTimeout(200);
  assert.equal((await stateOf(manage)).coins, 321);
  await click(manage, '[data-action="settings"]');
  await click(manage, '[data-action="reset-confirm"]');
  assert.equal((await stateOf(manage)).coins, 321);
  await click(manage, '[data-action="reset"]');
  assert.equal((await stateOf(manage)).coins, 85);
  results.push('Export, invalid-import rejection, confirmed import and confirmed reset');
  await management.close();

  const recovery = await browser.newContext();
  const rp = await recovery.newPage();
  watch(rp);
  await rp.goto(base);
  await rp.waitForSelector('.plot');
  await rp.waitForTimeout(250);
  await click(rp, '[data-plot="6"]');
  await click(rp, '[data-action="save"]');
  await rp.evaluate((key) => {
    localStorage.setItem(key, '{damaged');
  }, SAVE_KEY);
  await rp.reload();
  await rp.waitForSelector('.plot');
  await rp.waitForTimeout(250);
  assert.equal((await stateOf(rp)).inventory.radish, 2);
  results.push('Browser recovers a corrupted primary save from backup');
  await recovery.close();

  const blocked = await browser.newContext();
  await blocked.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('Storage disabled', 'SecurityError');
      },
    });
  });
  const bp = await blocked.newPage();
  watch(bp);
  await bp.goto(base);
  await bp.waitForSelector('.plot');
  await bp.waitForTimeout(250);
  await click(bp, '[data-plot="6"]');
  assert.ok((await bp.locator('[data-plot="6"]').getAttribute('aria-label')).includes('đất trống'));
  assert.ok((await bp.locator('#save-status').textContent()).includes('Chưa lưu'));
  results.push('Browser with denied localStorage still plays and reports unsaved status');
  await blocked.close();

  for (const width of [390, 320, 768]) {
    const mobile = await browser.newContext({
      viewport: { width, height: 844 },
      deviceScaleFactor: 1,
      isMobile: width < 600,
      hasTouch: width < 600,
    });
    const mp = await mobile.newPage();
    watch(mp);
    await mp.goto(base);
    await mp.waitForSelector('.plot');
    await mp.waitForTimeout(400);
    await noOverflow(mp, `Responsive ${width}`);
    await mp.screenshot({ path: `artifacts/mobile-${width}.png`, fullPage: true });
    await click(mp, '[data-plot="6"]');
    assert.equal((await stateOf(mp)).stats.harvests, 1);
    for (const tab of ['production', 'inventory', 'growth', 'orders']) {
      await click(mp, `[data-tab="${tab}"]`);
      await noOverflow(mp, `Responsive ${width} ${tab}`);
    }
    await click(mp, '[data-tab="farm"]');
    await mp.waitForTimeout(500);
    assert.ok(
      await mp.evaluate(() => document.querySelector('#main').getBoundingClientRect().top >= -5),
      'Farm navigation returns to the playable field'
    );
    await mobile.close();
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(requests, []);
  results.push('Zero runtime/console errors and zero failing HTTP asset requests');
  console.log(results.join('\n'));
  await writeFile('artifacts/browser-report.json', JSON.stringify({ results, errors, requests }, null, 2));
} finally {
  await browser.close();
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, levelOf, capacity, usedCapacity, neighbors, isUnlocked } from '../src/state.js';
import { act } from '../src/actions.js';
import {
  advance,
  cropYield,
  ensureOrders,
  makeOrder,
  marketPrice,
  accessibleItems,
} from '../src/simulation.js';
import { encodeSave, decodeSave, loadGame, saveGame, validateState } from '../src/persistence.js';
import { CROPS, ITEMS, RECIPES, MAX_OFFLINE, SAVE_KEY, WEATHER_PERIOD, LEVELS } from '../src/data.js';

const fresh = () => {
  const s = createState(1000000);
  ensureOrders(s);
  return s;
};
const clear = (s) => {
  for (const p of s.plots) p.crop = null;
};
const step = (s, ms) => advance(s, s.lastWall + ms);
const memory = () => {
  const values = new Map();
  return {
    getItem: (k) => values.get(k) || null,
    setItem: (k, v) => values.set(k, String(v)),
    removeItem: (k) => values.delete(k),
  };
};

test('starter farm is playable, with 9 plots and one ripe crop', () => {
  const s = fresh();
  assert.equal(s.plots.filter((p) => isUnlocked(s, p)).length, 9);
  const result = act(s, 'harvest', 6);
  assert.equal(result.ok, true);
  assert.equal(s.inventory.radish, 2);
  assert.equal(s.plots[6].soil, 'root');
  assert.equal(act(s, 'harvest', 6).ok, false);
  assert.equal(s.inventory.radish, 2);
});
test('plant, grow, harvest, process, collect and sell a complete loop', () => {
  const s = fresh();
  clear(s);
  const coins = s.coins;
  assert.equal(act(s, 'plant', 6, 'mint').ok, true);
  assert.equal(s.coins, coins - 3);
  assert.equal(act(s, 'harvest', 6).ok, false);
  step(s, 40000);
  assert.equal(act(s, 'harvest', 6).ok, true);
  s.inventory.mint = 3;
  assert.equal(act(s, 'queueRecipe', 'tea').ok, true);
  assert.equal(s.inventory.mint, 0);
  assert.equal(act(s, 'collect', 'mill').ok, false);
  step(s, 25000);
  assert.equal(act(s, 'collect', 'mill').ok, true);
  assert.equal(s.inventory.tea, 1);
  const before = s.coins;
  assert.equal(act(s, 'sell', 'tea', 1).ok, true);
  assert.equal(s.coins, before + marketPrice(s, 'tea'));
});
test('directed orthogonal pulses reward layout and cap at two per planting', () => {
  const s = fresh();
  clear(s);
  s.coins = 1000;
  act(s, 'plant', 12, 'wheat');
  act(s, 'plant', 7, 'mint');
  act(s, 'plant', 11, 'mint');
  act(s, 'plant', 13, 'mint');
  step(s, 40000);
  const initial = s.plots[12].crop.readyAt;
  assert.deepEqual(act(s, 'harvest', 7).pulseTargets, [12]);
  assert.equal(s.plots[12].crop.readyAt, Math.max(s.clock, initial - s.plots[12].crop.duration * 0.2));
  act(s, 'harvest', 11);
  act(s, 'harvest', 13);
  assert.ok(s.plots[12].crop.pulses <= 2);
  assert.equal(
    neighbors(s, 6).some((p) => p.id === 12),
    false
  );
});
test('rotation, hill bonus, and pulses yield real extra items', () => {
  const s = fresh();
  clear(s);
  s.xp = 2000;
  s.areas.hill = true;
  s.coins = 1000;
  s.plots[1].prepared = true;
  s.plots[1].soil = 'bloom';
  act(s, 'plant', 1, 'carrot');
  assert.equal(s.plots[1].crop.rotation, true);
  assert.equal(cropYield(s.plots[1]), 6);
  step(s, 90000);
  act(s, 'harvest', 1);
  assert.equal(s.inventory.carrot, 6);
});
test('water applies once, irrigation reaches neighbors, no overdraft', () => {
  const s = fresh();
  clear(s);
  s.upgrades.irrigation = 1;
  s.water = 1;
  act(s, 'plant', 6, 'mint');
  act(s, 'plant', 7, 'wheat');
  assert.equal(act(s, 'water', 6).ok, true);
  assert.equal(s.water, 0);
  assert.equal(s.plots[7].crop.watered, true);
  const deadline = s.plots[6].crop.readyAt;
  assert.equal(act(s, 'water', 6).ok, false);
  assert.equal(s.plots[6].crop.readyAt, deadline);
  act(s, 'plant', 8, 'radish');
  assert.equal(act(s, 'water', 8).ok, false);
  assert.equal(s.water, 0);
});
test('zero coins never soft-lock planting; insufficient inputs are atomic', () => {
  const s = fresh();
  clear(s);
  s.coins = 0;
  assert.equal(act(s, 'plant', 6, 'mint').ok, false);
  assert.equal(s.plots[6].crop, null);
  assert.equal(act(s, 'plant', 6, 'radish').ok, true);
  step(s, 25000);
  act(s, 'harvest', 6);
  act(s, 'sell', 'radish', 2);
  assert.ok(s.coins > 0);
  s.inventory.mint = 0;
  const inventory = { ...s.inventory };
  assert.equal(act(s, 'queueRecipe', 'tea').ok, false);
  assert.deepEqual(s.inventory, inventory);
});
test('full storage keeps ripe crops and products; sales release space', () => {
  const s = fresh();
  s.inventory.radish = capacity(s) - 6;
  assert.equal(usedCapacity(s), capacity(s));
  assert.equal(act(s, 'harvest', 6).ok, false);
  assert.ok(s.plots[6].crop);
  act(s, 'queueRecipe', 'tea');
  s.inventory.radish += 3;
  step(s, 30000);
  assert.equal(act(s, 'collect', 'mill').ok, false);
  assert.equal(s.buildings.mill.queue.length, 1);
  act(s, 'sell', 'radish', 5);
  assert.equal(act(s, 'collect', 'mill').ok, true);
  assert.equal(act(s, 'harvest', 6).ok, true);
});
test('serial queues consume inputs once and retain completed jobs across offline time', () => {
  const s = fresh();
  s.inventory.mint = 12;
  act(s, 'queueRecipe', 'tea');
  act(s, 'queueRecipe', 'tea');
  const jobs = s.buildings.mill.queue;
  assert.equal(jobs[1].startAt, jobs[0].readyAt);
  assert.equal(act(s, 'queueRecipe', 'tea').ok, false);
  assert.equal(s.inventory.mint, 6);
  step(s, 100000);
  assert.equal(act(s, 'collect', 'mill').ok, true);
  assert.equal(act(s, 'collect', 'mill').ok, true);
  assert.equal(act(s, 'collect', 'mill').ok, false);
  assert.equal(s.inventory.tea, 2);
});
test('animal chain pays a finite return only after paid input and elapsed time', () => {
  const s = fresh();
  s.xp = 65;
  s.coins = 200;
  assert.equal(act(s, 'purchaseBuilding', 'coop').ok, true);
  act(s, 'queueRecipe', 'feed');
  step(s, 21000);
  act(s, 'collect', 'mill');
  assert.equal(act(s, 'queueRecipe', 'egg').ok, true);
  assert.equal(s.inventory.feed, 0);
  step(s, 66000);
  act(s, 'collect', 'coop');
  assert.equal(s.inventory.egg, 2);
  assert.equal(s.stats.eggs, 1);
  assert.equal(act(s, 'queueRecipe', 'egg').ok, false);
});
test('orders cannot pay twice, expire cleanly, and refresh has a cooldown', () => {
  const s = fresh(),
    o = s.orders[0];
  s.inventory.radish = 20;
  const coins = s.coins;
  assert.equal(act(s, 'deliver', o.id).ok, true);
  assert.equal(s.coins, coins + o.coins);
  assert.equal(act(s, 'deliver', o.id).ok, false);
  assert.equal(act(s, 'refreshOrder', s.orders[0].id).ok, false);
  step(s, 12000);
  assert.equal(act(s, 'refreshOrder', s.orders[0].id).ok, true);
  s.xp = 180;
  s.orders[2] = makeOrder(s, 2);
  const old = s.orders[2].id;
  step(s, 210001);
  assert.notEqual(s.orders[2].id, old);
  assert.equal(act(s, 'deliver', old).ok, false);
});
test('orders use only obtainable products at each building state', () => {
  const s = fresh();
  s.xp = 2000;
  const available = accessibleItems(s);
  assert.ok(!available.includes('bread'));
  assert.ok(!available.includes('egg'));
  assert.ok(!available.includes('basket'));
  for (let i = 0; i < 100; i++)
    assert.ok(Object.keys(makeOrder(s, i % 3).requirements).every((k) => available.includes(k)));
});
test('level unlocks, costs, expansion and quest rewards cannot be purchased twice', () => {
  const s = fresh();
  s.coins = 5000;
  assert.equal(act(s, 'plant', 8, 'carrot').ok, false);
  assert.equal(act(s, 'expand', 'creek').ok, false);
  s.xp = 180;
  assert.equal(levelOf(s), 3);
  assert.equal(act(s, 'expand', 'creek').ok, true);
  assert.equal(s.plots.filter((p) => isUnlocked(s, p)).length, 14);
  const coins = s.coins;
  assert.equal(act(s, 'expand', 'creek').ok, false);
  assert.equal(s.coins, coins);
  assert.equal(act(s, 'upgrade', 'queue').ok, true);
  assert.equal(act(s, 'upgrade', 'queue').ok, true);
  assert.equal(act(s, 'upgrade', 'queue').ok, false);
  s.stats.harvests = 3;
  assert.equal(act(s, 'claimQuest').ok, true);
  assert.equal(act(s, 'claimQuest').ok, false);
  assert.equal(s.quest, 1);
});
test('one large clock step equals small steps, including rain recovery', () => {
  const a = fresh(),
    b = fresh();
  a.water = b.water = 0;
  step(a, WEATHER_PERIOD + 34000);
  for (let i = 0; i < (WEATHER_PERIOD + 34000) / 1000; i++) step(b, 1000);
  assert.equal(a.clock, b.clock);
  assert.equal(a.water, b.water);
  assert.equal(a.waterClock, b.waterClock);
});
test('offline progression is capped; a backwards clock neither duplicates nor blocks later time', () => {
  const s = fresh();
  step(s, 24 * 60 * 60 * 1000);
  assert.equal(s.clock, MAX_OFFLINE);
  const clock = s.clock;
  advance(s, s.lastWall - 50000);
  assert.equal(s.clock, clock);
  step(s, 1000);
  assert.equal(s.clock, clock + 1000);
  const restored = decodeSave(encodeSave(s), s.lastWall - 100000);
  const wall = restored.lastWall;
  advance(restored, wall + 1000);
  assert.equal(restored.clock, clock + 2000);
});
test('versioned save roundtrip, backup recovery, corrupted and future save fallback', () => {
  const s = fresh();
  act(s, 'harvest', 6);
  const storage = memory();
  assert.equal(saveGame(s, storage), true);
  const loaded = loadGame(storage, s.lastWall);
  assert.equal(loaded.fresh, false);
  assert.deepEqual(loaded.state, s);
  act(s, 'plant', 6, 'mint');
  saveGame(s, storage);
  storage.setItem(SAVE_KEY, '{broken');
  const recovered = loadGame(storage, s.lastWall);
  assert.equal(recovered.recovered, true);
  assert.equal(recovered.state.inventory.radish, 2);
  storage.setItem(SAVE_KEY + '.backup', 'garbage');
  assert.equal(loadGame(storage, s.lastWall).fresh, true);
  assert.throws(() => decodeSave('{"version":99,"state":{}}'));
});
test('malformed saves reject unknown crops, negative inventory, duplicate orders and invalid queues', () => {
  for (const mutate of [
    (s) => (s.coins = -1),
    (s) => (s.inventory.radish = -5),
    (s) => (s.plots[6].crop.type = 'missing'),
    (s) => (s.orders[1].id = s.orders[0].id),
    (s) => (s.upgrades.storage = 500),
    (s) => (s.buildings.mill.queue = [{ id: 'x', recipe: 'egg', startAt: 0, readyAt: 65000 }]),
    (s) => (s.stats.pulses = Infinity),
    (s) => (s.plots[6].crop.pulses = 99),
  ]) {
    const s = fresh();
    mutate(s);
    assert.throws(() => validateState(s, s.lastWall));
  }
});
test('blocked storage returns a playable farm and a failed-save signal', () => {
  const blocked = {
    getItem: () => {
      throw new Error('Storage denied');
    },
    setItem: () => {
      throw new Error('Storage denied');
    },
  };
  const result = loadGame(blocked, 1000000);
  assert.equal(result.fresh, true);
  assert.ok(result.warning);
  assert.equal(act(result.state, 'harvest', 6).ok, true);
  assert.equal(saveGame(result.state, blocked), false);
});
test('invalid quantities and repeated double-clicks cannot create money or negative inventory', () => {
  const s = fresh(),
    coins = s.coins;
  for (const n of [-1, 0, NaN, Infinity, 0.5, 10000]) assert.equal(act(s, 'sell', 'mint', n).ok, false);
  assert.equal(s.coins, coins);
  assert.equal(act(s, 'sell', 'mint', 3).ok, true);
  assert.equal(act(s, 'sell', 'mint', 3).ok, false);
  assert.equal(s.inventory.mint, 0);
});
test('recipes have no circular arbitrage and every paid crop has positive baseline harvest margin', () => {
  for (const c of Object.values(CROPS)) assert.ok(c.value * c.yield > c.seed);
  const visiting = new Set(),
    done = new Set();
  const visit = (id) => {
    if (done.has(id) || CROPS[id]) return;
    assert.ok(!visiting.has(id), 'production cycle');
    visiting.add(id);
    for (const r of Object.values(RECIPES).filter((r) => r.output === id))
      for (const input of Object.keys(r.inputs)) visit(input);
    visiting.delete(id);
    done.add(id);
  };
  Object.keys(ITEMS).forEach(visit);
});
test('random action sequences preserve nonnegative quantities and save invariants', () => {
  const s = fresh();
  s.coins = 3000;
  s.xp = LEVELS.at(-1).xp;
  let rng = 1973;
  const rand = (n) => {
    rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
    return rng % n;
  };
  const cropIds = Object.keys(CROPS),
    recipeIds = Object.keys(RECIPES),
    itemIds = Object.keys(ITEMS);
  for (let i = 0; i < 3000; i++) {
    step(s, rand(6000));
    const id = rand(25),
      choice = rand(12);
    if (choice === 0) act(s, 'plant', id, cropIds[rand(cropIds.length)]);
    if (choice === 1) act(s, 'harvest', id);
    if (choice === 2) act(s, 'water', id);
    if (choice === 3) act(s, 'queueRecipe', recipeIds[rand(recipeIds.length)]);
    if (choice === 4) act(s, 'collect', ['mill', 'coop', 'kitchen', 'press'][rand(4)]);
    if (choice === 5) act(s, 'sell', itemIds[rand(itemIds.length)], rand(8));
    if (choice === 6) act(s, 'deliver', s.orders[rand(3)].id);
    if (choice === 7) act(s, 'expand', ['creek', 'sunny', 'hill'][rand(3)]);
    if (choice === 8) act(s, 'prepare', id);
    if (choice === 9) act(s, 'purchaseBuilding', ['coop', 'kitchen', 'press'][rand(3)]);
    if (choice === 10) act(s, 'claimQuest');
    if (choice === 11) act(s, 'refreshOrder', s.orders[rand(3)].id);
    assert.ok(s.coins >= 0);
    assert.ok(Object.values(s.inventory).every((n) => Number.isSafeInteger(n) && n >= 0));
    assert.ok(usedCapacity(s) <= capacity(s));
    if (i % 100 === 0) assert.doesNotThrow(() => validateState(s, s.lastWall));
  }
});

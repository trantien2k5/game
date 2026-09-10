import { writeFile, mkdir } from 'node:fs/promises';
import { createState, levelOf, isReady, isUnlocked, hasItems, usedCapacity, capacity } from '../src/state.js';
import { advance, ensureOrders, marketPrice } from '../src/simulation.js';
import { act, upgradeCost } from '../src/actions.js';
import { CROPS, FAMILIES, ITEMS, RECIPES, BUILDINGS, AREAS, QUESTS } from '../src/data.js';
import { encodeSave } from '../src/persistence.js';

const s = createState(1000000);
ensureOrders(s);
const milestones = [];
let actions = 0;
let successful = 0;
const doAct = (name, ...args) => {
  actions++;
  const result = act(s, name, ...args);
  if (result.ok) successful++;
  return result.ok;
};
for (let second = 0; second <= 3600; second += 2) {
  advance(s, 1000000 + second * 1000);
  const level = levelOf(s);
  const q = QUESTS[s.quest];
  if (q && s.stats[q.stat] >= q.target) doAct('claimQuest');
  for (const o of [...s.orders]) if (hasItems(s, o.requirements)) doAct('deliver', o.id);
  if (second % 30 === 0) {
    for (const [id, b] of Object.entries(BUILDINGS))
      if (!s.buildings[id].owned && level >= b.level && s.coins >= b.cost + 45) doAct('purchaseBuilding', id);
    for (const [id, a] of Object.entries(AREAS))
      if (!s.areas[id] && level >= a.level && s.coins >= a.cost + 70) doAct('expand', id);
    if (
      usedCapacity(s) > capacity(s) * 0.6 &&
      s.upgrades.storage < 3 &&
      level >= 2 &&
      s.coins > upgradeCost(s, 'storage') + 70
    )
      doAct('upgrade', 'storage');
    if (level >= 4 && !s.upgrades.irrigation && s.coins > 450) doAct('upgrade', 'irrigation');
    if (level >= 8 && !s.upgrades.greenhouse && s.coins > 1900) doAct('upgrade', 'greenhouse');
    if (level >= 5 && s.upgrades.queue < 2 && s.coins > upgradeCost(s, 'queue') + 200)
      doAct('upgrade', 'queue');
  }
  for (const [id, b] of Object.entries(s.buildings))
    if (b.owned && b.queue[0]?.readyAt <= s.clock) doAct('collect', id);
  // At most one field interaction every two seconds; prefer linked, mature harvests.
  let plot = s.plots.find((p) => isReady(s, p));
  if (plot) doAct('harvest', plot.id);
  else {
    plot = s.plots.find((p) => isUnlocked(s, p) && !p.crop);
    if (plot) {
      if (!plot.prepared) doAct('prepare', plot.id);
      else {
        const desired = {};
        for (const o of s.orders)
          for (const [id, n] of Object.entries(o.requirements)) desired[id] = (desired[id] || 0) + n;
        for (const r of Object.values(RECIPES))
          if (s.buildings[r.building].owned && r.level <= level)
            for (const [id, n] of Object.entries(r.inputs)) desired[id] = (desired[id] || 0) + n * 2;
        let options = Object.entries(CROPS).filter(([, c]) => c.level <= level && c.seed <= s.coins);
        const preferred = plot.soil
          ? FAMILIES[plot.soil].next
          : ['root', 'leaf', 'bloom'][(Math.floor(plot.id / 5) + (plot.id % 5)) % 3];
        options.sort(([a, ca], [b, cb]) => {
          const score = (id, c) =>
            ((desired[id] || 3) - s.inventory[id]) * 1.5 +
            (c.family === preferred ? 9 : 0) -
            s.plots.filter((p) => p.crop?.type === id).length * 5;
          return score(b, cb) - score(a, ca);
        });
        doAct('plant', plot.id, options[0][0]);
      }
    }
  }
  if (second % 10 === 0 && s.water > 2) {
    const thirsty = s.plots.find((p) => p.crop && !p.crop.watered && !isReady(s, p));
    if (thirsty) doAct('water', thirsty.id);
  }
  if (second % 6 === 0) {
    const recipes = Object.entries(RECIPES).filter(
      ([, r]) => s.buildings[r.building].owned && r.level <= level && hasItems(s, r.inputs)
    );
    recipes.sort(([, a], [, b]) => s.inventory[a.output] - s.inventory[b.output]);
    for (const [id, r] of recipes) if (s.inventory[r.output] < 5) doAct('queueRecipe', id);
  }
  if (second % 8 === 0) {
    const reserves = Object.fromEntries(Object.keys(ITEMS).map((k) => [k, CROPS[k] ? 7 : 2]));
    for (const o of s.orders)
      for (const [id, n] of Object.entries(o.requirements)) reserves[id] = Math.max(reserves[id], n);
    for (const [id, n] of Object.entries(s.inventory)) {
      const surplus = n - reserves[id];
      if (surplus > 0) doAct('sell', id, surplus);
    }
    if (usedCapacity(s) > capacity(s) * 0.9) {
      const [id, n] = Object.entries(s.inventory).sort((a, b) => b[1] - a[1])[0];
      doAct('sell', id, Math.ceil(n / 2));
    }
  }
  if ([300, 600, 1200, 1800, 2700, 3600].includes(second))
    milestones.push({
      minutes: second / 60,
      level: levelOf(s),
      xp: s.xp,
      coins: s.coins,
      earned: s.stats.earned,
      land: s.plots.filter((p) => isUnlocked(s, p)).length,
      chapters: s.quest,
      orders: s.stats.orders,
      pulses: s.stats.pulses,
      harvests: s.stats.harvests,
    });
}
console.table(milestones);
console.table(
  Object.entries(CROPS).map(([id, c]) => ({
    crop: id,
    seconds: c.time,
    seed: c.seed,
    baseMargin: c.value * c.yield - c.seed,
    marginPerMinute: (((c.value * c.yield - c.seed) / c.time) * 60).toFixed(1),
    circuitMarginPerMinute: (((c.value * (c.yield + 3) - c.seed) / c.time) * 60).toFixed(1),
  }))
);
console.log(
  JSON.stringify({
    actions,
    successful,
    finalLevel: levelOf(s),
    chapters: s.quest,
    upgrades: s.upgrades,
    buildings: Object.entries(s.buildings)
      .filter(([, b]) => b.owned)
      .map(([id]) => id),
  })
);
await mkdir('artifacts', { recursive: true });
await writeFile(
  'artifacts/balance.json',
  JSON.stringify({ milestones, actions, successful, state: s }, null, 2)
);
// A playable late-game fixture is useful for visual QA; it is never loaded by the game.
s.lastWall = Date.now();
await writeFile('artifacts/late-game.json', encodeSave(s));

import { LEVELS, CROPS, ITEMS } from './data.js';

export function areaFor(row, col) {
  if (col === 0) return 'creek';
  if (col === 4) return 'sunny';
  if (row === 0 || row === 4) return 'hill';
  return 'home';
}
export function createState(now = Date.now()) {
  const state = {
    version: 1,
    revision: 0,
    clock: 0,
    lastWall: now,
    startedAt: now,
    coins: 85,
    xp: 0,
    water: 8,
    waterClock: 0,
    reputation: 0,
    inventory: Object.fromEntries(Object.keys(ITEMS).map((k) => [k, 0])),
    plots: Array.from({ length: 25 }, (_, id) => ({
      id,
      area: areaFor(Math.floor(id / 5), id % 5),
      prepared: id >= 6 && id <= 18 && id % 5 > 0 && id % 5 < 4,
      soil: null,
      crop: null,
      marker: 0,
    })),
    buildings: {
      mill: { owned: true, queue: [] },
      coop: { owned: false, queue: [] },
      kitchen: { owned: false, queue: [] },
      press: { owned: false, queue: [] },
    },
    areas: { creek: false, sunny: false, hill: false },
    upgrades: { storage: 0, queue: 0, irrigation: 0, greenhouse: 0 },
    orders: [],
    nextOrderId: 1,
    rng: 73419,
    quest: 0,
    journalClaimed: [],
    stats: {
      harvests: 0,
      planted: 0,
      pulses: 0,
      rotations: 0,
      products: 0,
      eggs: 0,
      orders: 0,
      earned: 0,
      expansions: 0,
      greenhouse: 0,
      watered: 0,
    },
    settings: { sound: false, motion: true, circuits: true },
    tutorial: 0,
    seenLevel: 1,
    lastWeather: 0,
  };
  state.inventory.wheat = 3;
  state.inventory.mint = 3;
  for (const [id, type, readyAt] of [
    [6, 'radish', 0],
    [7, 'mint', 15000],
    [12, 'wheat', 35000],
  ]) {
    state.plots[id].crop = {
      type,
      plantedAt: -10000,
      readyAt,
      duration: CROPS[type].time * 1000,
      pulses: 0,
      rotation: false,
      watered: false,
      bonus: 0,
    };
  }
  return state;
}
export const levelOf = (state) => Math.max(1, LEVELS.filter((l) => state.xp >= l.xp).length);
export const capacity = (state) => 70 + state.upgrades.storage * 40 + state.upgrades.greenhouse * 60;
export const usedCapacity = (state) => Object.values(state.inventory).reduce((a, b) => a + b, 0);
export const waterCapacity = (state) => 10 + (state.areas.creek ? 2 : 0);
export const queueCapacity = (state) => 2 + state.upgrades.queue;
export const isUnlocked = (state, plot) => plot.area === 'home' || state.areas[plot.area];
export const isReady = (state, plot) => !!plot.crop && plot.crop.readyAt <= state.clock;
export const remaining = (state, deadline) => Math.max(0, deadline - state.clock);
export const canFit = (state, n) => usedCapacity(state) + n <= capacity(state);
export const hasItems = (state, items) => Object.entries(items).every(([id, n]) => state.inventory[id] >= n);
export function neighbors(state, id) {
  const row = Math.floor(id / 5),
    col = id % 5;
  return state.plots.filter(
    (p) => Math.abs(Math.floor(p.id / 5) - row) + Math.abs((p.id % 5) - col) === 1 && isUnlocked(state, p)
  );
}
export function random(state) {
  state.rng = (Math.imul(1664525, state.rng) + 1013904223) >>> 0;
  return state.rng / 4294967296;
}

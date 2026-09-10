import { WEATHER, WEATHER_PERIOD, MAX_OFFLINE, ITEMS, CROPS, RECIPES, PEOPLE } from './data.js';
import { levelOf, random, waterCapacity } from './state.js';

export const weatherIndex = (state) => Math.floor(state.clock / WEATHER_PERIOD) % WEATHER.length;
export const weatherOf = (state) => WEATHER[weatherIndex(state)];
export const weatherRemaining = (state) => WEATHER_PERIOD - (state.clock % WEATHER_PERIOD);
export function marketPrice(state, id) {
  const weather = weatherOf(state);
  const bonus = weather.demand === id || (weather.id === 'gold' && id === 'blueberry');
  return Math.max(1, Math.round(ITEMS[id].value * (bonus ? 1.3 : 1)));
}
export function accessibleItems(state) {
  const level = levelOf(state);
  return Object.keys(ITEMS).filter((id) => {
    if (CROPS[id]) return CROPS[id].level <= level;
    return Object.values(RECIPES).some(
      (r) =>
        r.output === id &&
        r.level <= level &&
        state.buildings[r.building].owned &&
        Object.keys(r.inputs).every((input) =>
          CROPS[input]
            ? CROPS[input].level <= level
            : Object.values(RECIPES).some(
                (p) => p.output === input && state.buildings[p.building].owned && p.level <= level
              )
        )
    );
  });
}
export function makeOrder(state, slot = 0) {
  const level = levelOf(state),
    available = accessibleItems(state);
  const cropIds = available.filter((k) => CROPS[k]);
  const item =
    state.nextOrderId <= 3
      ? ['radish', 'mint', 'wheat'][state.nextOrderId - 1]
      : available[Math.floor(random(state) * available.length)];
  const count = CROPS[item]
    ? 3 + Math.floor(random(state) * Math.min(5, level + 1))
    : 1 + (level >= 5 && random(state) > 0.65 ? 1 : 0);
  const requirements = { [item]: count };
  if (level >= 3 && random(state) > 0.45) {
    const second = cropIds[Math.floor(random(state) * cropIds.length)];
    if (second !== item) requirements[second] = 2 + Math.floor(random(state) * 2);
  }
  const value = Object.entries(requirements).reduce((sum, [id, n]) => sum + ITEMS[id].value * n, 0);
  const express = level >= 3 && slot === 2;
  return {
    id: state.nextOrderId++,
    person: Math.floor(random(state) * PEOPLE.length),
    requirements,
    coins: Math.ceil(value * (express ? 1.8 : 1.4)),
    xp: Math.ceil(value * 0.4) + 5,
    express,
    expiresAt: express ? state.clock + 210000 : null,
    refreshAt: state.clock + 12000,
  };
}
export function ensureOrders(state) {
  while (state.orders.length < 3) state.orders.push(makeOrder(state, state.orders.length));
}
export function advance(state, wallNow = Date.now()) {
  if (wallNow < state.lastWall) {
    state.lastWall = wallNow;
    return { elapsed: 0, expired: 0 };
  }
  const raw = Math.max(0, wallNow - state.lastWall);
  const elapsed = Math.min(MAX_OFFLINE, raw);
  state.lastWall = Math.max(state.lastWall, wallNow);
  if (!elapsed) return { elapsed: 0, expired: 0 };
  const oldClock = state.clock;
  state.clock += elapsed;
  // Integrate weather boundaries so water recovery is independent of tick frequency.
  let cursor = oldClock;
  while (cursor < state.clock) {
    const end = Math.min(state.clock, (Math.floor(cursor / WEATHER_PERIOD) + 1) * WEATHER_PERIOD);
    const rainy = Math.floor(cursor / WEATHER_PERIOD) % WEATHER.length === 1;
    state.waterClock += (end - cursor) * (rainy ? 2 : 1);
    cursor = end;
  }
  const refill = Math.floor(state.waterClock / 20000);
  state.waterClock %= 20000;
  state.water = Math.min(waterCapacity(state), state.water + refill);
  let expired = 0;
  state.orders = state.orders.map((o, i) => {
    if (o.expiresAt !== null && state.clock >= o.expiresAt) {
      expired++;
      return makeOrder(state, i);
    }
    return o;
  });
  return { elapsed, expired };
}
export function cropYield(plot) {
  return CROPS[plot.crop.type].yield + plot.crop.pulses + (plot.crop.rotation ? 1 : 0) + plot.crop.bonus;
}

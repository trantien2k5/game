import {
  SAVE_VERSION,
  SAVE_KEY,
  CROPS,
  FAMILIES,
  ITEMS,
  RECIPES,
  BUILDINGS,
  AREAS,
  UPGRADES,
  QUESTS,
} from './data.js';
import { createState, areaFor, capacity, usedCapacity, queueCapacity, waterCapacity } from './state.js';
import { ensureOrders } from './simulation.js';

const number = (v, min = 0, max = 1e12) =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const integer = (v, min = 0, max = 1e9) => Number.isSafeInteger(v) && number(v, min, max);
const object = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const assert = (condition) => {
  if (!condition) throw new Error('Dữ liệu lưu không hợp lệ.');
};

export function validateState(raw, now = Date.now()) {
  assert(object(raw) && raw.version === SAVE_VERSION);
  const s = createState(now);
  for (const key of [
    'coins',
    'xp',
    'reputation',
    'revision',
    'nextOrderId',
    'rng',
    'quest',
    'tutorial',
    'seenLevel',
    'lastWeather',
  ]) {
    assert(integer(raw[key], 0, key === 'rng' ? 0xffffffff : 1e9));
    s[key] = raw[key];
  }
  assert(
    s.quest <= QUESTS.length &&
      s.nextOrderId > 0 &&
      s.tutorial <= 5 &&
      s.seenLevel <= 8 &&
      s.rng <= 0xffffffff
  );
  for (const key of ['clock', 'lastWall', 'startedAt', 'waterClock']) {
    assert(number(raw[key], 0, 1e15));
    s[key] = raw[key];
  }
  assert(s.waterClock < 20000);
  assert(
    object(raw.inventory) &&
      object(raw.areas) &&
      object(raw.upgrades) &&
      object(raw.settings) &&
      object(raw.stats)
  );
  for (const id of Object.keys(ITEMS)) {
    assert(integer(raw.inventory[id], 0, 10000));
    s.inventory[id] = raw.inventory[id];
  }
  for (const id of Object.keys(AREAS)) {
    assert(typeof raw.areas[id] === 'boolean');
    s.areas[id] = raw.areas[id];
  }
  for (const id of Object.keys(UPGRADES)) {
    assert(integer(raw.upgrades[id], 0, UPGRADES[id].max));
    s.upgrades[id] = raw.upgrades[id];
  }
  for (const id of Object.keys(s.settings)) {
    assert(typeof raw.settings[id] === 'boolean');
    s.settings[id] = raw.settings[id];
  }
  for (const id of Object.keys(s.stats)) {
    assert(integer(raw.stats[id]));
    s.stats[id] = raw.stats[id];
  }
  assert(integer(raw.water, 0, waterCapacity(s)));
  s.water = raw.water;
  assert(usedCapacity(s) <= capacity(s));
  assert(Array.isArray(raw.plots) && raw.plots.length === 25);
  s.plots = raw.plots.map((p, i) => {
    assert(object(p) && p.id === i && p.area === areaFor(Math.floor(i / 5), i % 5));
    assert(
      typeof p.prepared === 'boolean' &&
        (p.soil === null || Object.hasOwn(FAMILIES, p.soil)) &&
        integer(p.marker, 0, 3)
    );
    let crop = null;
    if (p.crop !== null) {
      const c = p.crop;
      assert(
        object(c) && Object.hasOwn(CROPS, c.type) && p.prepared && (p.area === 'home' || s.areas[p.area])
      );
      assert(
        number(c.plantedAt, -1e6, s.clock) &&
          number(c.readyAt, 0, s.clock + 300000) &&
          number(c.duration, 1, 300000)
      );
      assert(
        integer(c.pulses, 0, 2) &&
          typeof c.rotation === 'boolean' &&
          typeof c.watered === 'boolean' &&
          integer(c.bonus, 0, 1)
      );
      crop = {
        type: c.type,
        plantedAt: c.plantedAt,
        readyAt: c.readyAt,
        duration: c.duration,
        pulses: c.pulses,
        rotation: c.rotation,
        watered: c.watered,
        bonus: c.bonus,
      };
    }
    return { id: i, area: p.area, prepared: p.prepared, soil: p.soil, marker: p.marker, crop };
  });
  assert(object(raw.buildings));
  for (const id of Object.keys(BUILDINGS)) {
    const b = raw.buildings[id];
    assert(
      object(b) &&
        typeof b.owned === 'boolean' &&
        Array.isArray(b.queue) &&
        b.queue.length <= queueCapacity(s)
    );
    assert(b.owned || b.queue.length === 0);
    let previous = 0;
    s.buildings[id] = {
      owned: b.owned,
      queue: b.queue.map((j) => {
        assert(
          object(j) &&
            Object.hasOwn(RECIPES, j.recipe) &&
            RECIPES[j.recipe].building === id &&
            typeof j.id === 'string' &&
            j.id.length < 100
        );
        assert(
          number(j.startAt, previous, s.clock + 600000) && number(j.readyAt, j.startAt, s.clock + 600000)
        );
        assert(j.readyAt - j.startAt === RECIPES[j.recipe].time * 1000);
        previous = j.readyAt;
        return { id: j.id, recipe: j.recipe, startAt: j.startAt, readyAt: j.readyAt };
      }),
    };
  }
  assert(s.buildings.mill.owned);
  assert(Array.isArray(raw.orders) && raw.orders.length <= 3);
  const ids = new Set();
  s.orders = raw.orders.map((o) => {
    assert(
      object(o) && integer(o.id, 1) && !ids.has(o.id) && o.id < s.nextOrderId && integer(o.person, 0, 3)
    );
    ids.add(o.id);
    assert(
      object(o.requirements) &&
        Object.keys(o.requirements).length >= 1 &&
        Object.keys(o.requirements).length <= 2
    );
    const requirements = {};
    for (const [id, n] of Object.entries(o.requirements)) {
      assert(Object.hasOwn(ITEMS, id) && integer(n, 1, 20));
      requirements[id] = n;
    }
    assert(integer(o.coins, 1, 10000) && integer(o.xp, 1, 10000) && typeof o.express === 'boolean');
    assert((o.express && number(o.expiresAt, 0, s.clock + 210000)) || (!o.express && o.expiresAt === null));
    assert(number(o.refreshAt, 0, s.clock + 12000));
    return {
      id: o.id,
      person: o.person,
      requirements,
      coins: o.coins,
      xp: o.xp,
      express: o.express,
      expiresAt: o.expiresAt,
      refreshAt: o.refreshAt,
    };
  });
  assert(
    Array.isArray(raw.journalClaimed) &&
      raw.journalClaimed.length === s.quest &&
      raw.journalClaimed.every((n, i) => n === i)
  );
  s.journalClaimed = [...raw.journalClaimed];
  // A clock correction must not freeze a saved farm until the old wall time returns.
  if (s.lastWall > now) s.lastWall = now;
  ensureOrders(s);
  return s;
}

export function decodeSave(text, now = Date.now()) {
  assert(typeof text === 'string' && text.length < 500000);
  const envelope = JSON.parse(text);
  assert(object(envelope));
  // Add sequential migrations here when the schema changes.
  if (envelope.version !== SAVE_VERSION) throw new Error('Phiên bản bản lưu chưa được hỗ trợ.');
  return validateState(envelope.state, now);
}
export function encodeSave(state) {
  return JSON.stringify({ version: SAVE_VERSION, state });
}
export function loadGame(storage, now = Date.now()) {
  try {
    storage ??= globalThis.localStorage;
    const saved = storage.getItem(SAVE_KEY);
    if (saved) {
      try {
        return { state: decodeSave(saved, now), recovered: false, fresh: false };
      } catch {
        const backup = storage.getItem(SAVE_KEY + '.backup');
        if (backup) {
          try {
            return {
              state: decodeSave(backup, now),
              recovered: true,
              fresh: false,
              warning: 'Bản lưu chính bị lỗi. Đã khôi phục bản dự phòng gần nhất.',
            };
          } catch {
            /* Fall through to a fresh, playable farm. */
          }
        }
        return {
          state: createState(now),
          recovered: true,
          fresh: true,
          warning:
            'Bản lưu không đọc được. Một vườn mới đã sẵn sàng; dữ liệu lỗi được giữ trong mục recovery.',
        };
      }
    }
  } catch {
    return {
      state: createState(now),
      fresh: true,
      warning: 'Trình duyệt không cho phép lưu. Hãy xuất bản lưu trước khi đóng vườn.',
    };
  }
  return { state: createState(now), fresh: true };
}
export function saveGame(state, storage) {
  try {
    storage ??= globalThis.localStorage;
    const text = encodeSave(state);
    const old = storage.getItem(SAVE_KEY);
    if (old) {
      try {
        decodeSave(old);
        storage.setItem(SAVE_KEY + '.backup', old);
      } catch {
        storage.setItem(SAVE_KEY + '.recovery', old);
      }
    }
    storage.setItem(SAVE_KEY, text);
    return true;
  } catch {
    return false;
  }
}
export function resetSave(storage) {
  storage ??= globalThis.localStorage;
  for (const suffix of ['', '.backup', '.recovery']) storage.removeItem(SAVE_KEY + suffix);
}

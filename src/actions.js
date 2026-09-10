import { CROPS, FAMILIES, RECIPES, BUILDINGS, AREAS, UPGRADES, QUESTS, ITEMS } from './data.js';
import { levelOf, isUnlocked, isReady, neighbors, canFit, hasItems, queueCapacity } from './state.js';
import { cropYield, weatherOf, marketPrice, makeOrder } from './simulation.js';

const fail = (message) => ({ ok: false, message });
const success = (message, extra = {}) => ({ ok: true, message, ...extra });
function spendItems(state, requirements) {
  for (const [id, n] of Object.entries(requirements)) state.inventory[id] -= n;
}
function earn(state, coins, xp = 0) {
  state.coins += coins;
  state.stats.earned += coins;
  state.xp += xp;
}
export function prepare(state, id) {
  const p = state.plots[id];
  if (!p || !isUnlocked(state, p)) return fail('Vùng đất này chưa được mở.');
  if (p.prepared) return fail('Đất đã sẵn sàng.');
  p.prepared = true;
  return success('Đất đã tơi. Một mùa mới đang chờ.', { sound: 'plant' });
}
export function plant(state, id, type) {
  const p = state.plots[id],
    c = CROPS[type];
  if (!p || !c || !isUnlocked(state, p)) return fail('Chọn một ô đất trong vườn.');
  if (levelOf(state) < c.level) return fail(`Mở ở cấp ${c.level}.`);
  if (p.crop) return fail('Ô đất đang có cây.');
  if (!p.prepared) return fail('Cần xới đất trước khi gieo.');
  if (state.coins < c.seed) return fail('Chưa đủ xu. Củ hồng luôn có hạt giống miễn phí.');
  const w = weatherOf(state);
  let duration = c.time * 1000 * (w.family === c.family ? w.speed : 1);
  if (p.area === 'sunny' && c.family === 'bloom') duration *= 0.85;
  const rotation = p.soil !== null && FAMILIES[p.soil].next === c.family;
  p.crop = {
    type,
    plantedAt: state.clock,
    readyAt: state.clock + duration,
    duration,
    pulses: 0,
    rotation,
    watered: false,
    bonus: p.area === 'hill' && rotation && c.family === 'root' ? 1 : 0,
  };
  state.coins -= c.seed;
  state.stats.planted++;
  if (rotation) state.stats.rotations++;
  return success(rotation ? `${c.name} · luân canh +1 sản lượng` : `Đã gieo ${c.name.toLowerCase()}`, {
    sound: 'plant',
    plot: id,
  });
}
export function harvest(state, id) {
  const p = state.plots[id];
  if (!p || !isReady(state, p)) return fail('Cây chưa đến lúc thu hoạch.');
  const c = CROPS[p.crop.type],
    quantity = cropYield(p),
    type = p.crop.type;
  if (!canFit(state, quantity))
    return fail(`Kho cần thêm ${quantity} chỗ trống. Bán hoặc chế biến để dành chỗ nhé.`);
  const pulseTargets = [];
  for (const n of neighbors(state, id)) {
    if (
      n.crop &&
      !isReady(state, n) &&
      CROPS[n.crop.type].family === FAMILIES[c.family].next &&
      n.crop.pulses < 2
    ) {
      n.crop.readyAt = Math.max(state.clock, n.crop.readyAt - n.crop.duration * 0.2);
      n.crop.pulses++;
      pulseTargets.push(n.id);
    }
  }
  state.inventory[type] += quantity;
  state.xp += c.xp + pulseTargets.length * 2;
  state.stats.harvests++;
  state.stats.pulses += pulseTargets.length;
  p.soil = c.family;
  p.crop = null;
  return success(
    `+${quantity} ${c.name.toLowerCase()}${pulseTargets.length ? ` · ${pulseTargets.length} mạch sống` : ''}`,
    { sound: pulseTargets.length ? 'pulse' : 'harvest', quantity, item: type, plot: id, pulseTargets }
  );
}
export function water(state, id) {
  const p = state.plots[id];
  if (!p?.crop || isReady(state, p)) return fail('Chọn cây đang lớn để tưới.');
  if (p.crop.watered) return fail('Cây đã được tưới trong vụ này.');
  if (!state.upgrades.greenhouse && state.water < 1)
    return fail('Giếng đang hồi nước. Cây vẫn tiếp tục lớn.');
  const targets = [p, ...(state.upgrades.irrigation ? neighbors(state, id) : [])];
  let count = 0;
  for (const t of targets) {
    if (t.crop && !isReady(state, t) && !t.crop.watered) {
      t.crop.readyAt = Math.max(state.clock, t.crop.readyAt - t.crop.duration * 0.25);
      t.crop.watered = true;
      count++;
    }
  }
  if (!state.upgrades.greenhouse) state.water--;
  state.stats.watered += count;
  return success(`Tưới ${count} ô · rút ngắn một phần tư vụ`, { sound: 'water', plot: id });
}
export function queueRecipe(state, recipeId) {
  const recipe = RECIPES[recipeId];
  if (!recipe) return fail('Công thức không tồn tại.');
  const b = state.buildings[recipe.building];
  if (!b.owned || levelOf(state) < recipe.level) return fail('Công thức này chưa mở.');
  if (b.queue.length >= queueCapacity(state)) return fail('Hàng đợi đã đầy. Thu thành phẩm để có chỗ.');
  if (!hasItems(state, recipe.inputs)) return fail('Chưa đủ nguyên liệu cho mẻ này.');
  spendItems(state, recipe.inputs);
  const startAt = Math.max(state.clock, b.queue.at(-1)?.readyAt || 0);
  b.queue.push({
    id: `${recipeId}-${state.revision}-${state.clock}`,
    recipe: recipeId,
    startAt,
    readyAt: startAt + recipe.time * 1000,
  });
  return success(
    recipeId === 'egg'
      ? 'Vịt đã ăn no. Một ổ trứng đang chờ.'
      : `Đã xếp mẻ ${ITEMS[recipe.output].name.toLowerCase()}`,
    { sound: 'produce' }
  );
}
export function collect(state, buildingId) {
  const b = state.buildings[buildingId];
  if (!b?.owned || !b.queue.length || b.queue[0].readyAt > state.clock)
    return fail('Chưa có thành phẩm để thu.');
  const r = RECIPES[b.queue[0].recipe];
  if (!canFit(state, r.quantity)) return fail('Kho đã đầy. Thành phẩm vẫn được giữ ở xưởng.');
  b.queue.shift();
  state.inventory[r.output] += r.quantity;
  state.stats.products++;
  if (r.output === 'egg') state.stats.eggs++;
  state.xp += r.xp;
  return success(`+${r.quantity} ${ITEMS[r.output].name.toLowerCase()}`, {
    sound: 'harvest',
    item: r.output,
    quantity: r.quantity,
  });
}
export function sell(state, id, quantity) {
  if (!ITEMS[id] || !Number.isSafeInteger(quantity) || quantity <= 0 || state.inventory[id] < quantity)
    return fail('Số lượng bán không hợp lệ.');
  const coins = marketPrice(state, id) * quantity;
  state.inventory[id] -= quantity;
  earn(state, coins);
  return success(`Đã bán ${quantity} ${ITEMS[id].name.toLowerCase()} · +${coins} xu`, {
    sound: 'sell',
    coins,
  });
}
export function deliver(state, id) {
  const index = state.orders.findIndex((o) => o.id === id),
    order = state.orders[index];
  if (!order || (order.expiresAt !== null && order.expiresAt <= state.clock)) return fail('Đơn hàng đã đổi.');
  if (!hasItems(state, order.requirements)) return fail('Chưa đủ hàng để giao.');
  spendItems(state, order.requirements);
  earn(state, order.coins, order.xp);
  state.reputation += order.express ? 2 : 1;
  state.stats.orders++;
  state.orders[index] = makeOrder(state, index);
  return success(`Giao hàng thành công · +${order.coins} xu · +${order.xp} XP`, {
    sound: 'sell',
    coins: order.coins,
  });
}
export function refreshOrder(state, id) {
  const index = state.orders.findIndex((o) => o.id === id),
    o = state.orders[index];
  if (!o) return fail('Đơn hàng đã đổi.');
  if (state.clock < o.refreshAt) return fail('Khách mới đang trên đường đến.');
  state.orders[index] = makeOrder(state, index);
  return success('Một lời hẹn mới từ xóm nhỏ.');
}
export function purchaseBuilding(state, id) {
  const data = BUILDINGS[id],
    b = state.buildings[id];
  if (!data || !b || b.owned) return fail('Công trình đã có trong vườn.');
  if (levelOf(state) < data.level) return fail(`Cần cấp ${data.level}.`);
  if (state.coins < data.cost) return fail(`Cần ${data.cost} xu để dựng ${data.short.toLowerCase()}.`);
  state.coins -= data.cost;
  b.owned = true;
  return success(`${data.name} đã sẵn sàng!`, { sound: 'level' });
}
export function expand(state, id) {
  const a = AREAS[id];
  if (!a || state.areas[id]) return fail('Vùng đất đã được mở.');
  if (levelOf(state) < a.level) return fail(`Cần cấp ${a.level} để mở ${a.name.toLowerCase()}.`);
  if (state.coins < a.cost) return fail(`Cần ${a.cost} xu để mở đất.`);
  state.coins -= a.cost;
  state.areas[id] = true;
  state.stats.expansions++;
  return success(`${a.name} · thêm ${a.count} ô đất mới!`, { sound: 'level' });
}
export function upgradeCost(state, id) {
  const u = UPGRADES[id];
  return Math.round(u.cost * (u.multiplier || 1) ** state.upgrades[id]);
}
export function upgrade(state, id) {
  const u = UPGRADES[id];
  if (!u || state.upgrades[id] >= u.max) return fail('Đã nâng cấp tối đa.');
  if (levelOf(state) < u.level) return fail(`Cần cấp ${u.level}.`);
  const cost = upgradeCost(state, id);
  if (state.coins < cost) return fail(`Cần ${cost} xu để nâng cấp.`);
  state.coins -= cost;
  state.upgrades[id]++;
  if (id === 'greenhouse') state.stats.greenhouse = 1;
  return success(`${u.name} đã hoàn thành!`, { sound: 'level' });
}
export function claimQuest(state) {
  const q = QUESTS[state.quest];
  if (!q || state.stats[q.stat] < q.target) return fail('Chặng vườn này chưa hoàn thành.');
  state.journalClaimed.push(state.quest++);
  earn(state, q.coins, q.xp);
  return success(`Hoàn thành chặng vườn · +${q.coins} xu · +${q.xp} XP`, { sound: 'level' });
}
export function act(state, command, ...args) {
  const handlers = {
    prepare,
    plant,
    harvest,
    water,
    queueRecipe,
    collect,
    sell,
    deliver,
    refreshOrder,
    purchaseBuilding,
    expand,
    upgrade,
    claimQuest,
  };
  const previousLevel = levelOf(state);
  const result = handlers[command]?.(state, ...args) || fail('Hành động không hợp lệ.');
  if (result.ok) state.revision++;
  result.levelUp = levelOf(state) > previousLevel ? levelOf(state) : null;
  return result;
}

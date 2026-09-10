import { CROPS, LEVELS, SAVE_KEY } from './data.js';
import { createState, levelOf, isUnlocked, isReady } from './state.js';
import { advance, ensureOrders } from './simulation.js';
import { act } from './actions.js';
import { loadGame, saveGame, encodeSave, decodeSave, resetSave } from './persistence.js';
import { UI } from './ui.js';
import { playSound } from './audio.js';

let state,
  ui,
  canWrite = false,
  lastSave = 0,
  raf = 0,
  lastRender = 0,
  savedWarning = false,
  releaseLock;
const loaded = loadGame();
state = loaded.state;
ensureOrders(state);
const elapsed = advance(state);

function persist(manual = false) {
  if (!canWrite) return;
  const ok = saveGame(state);
  lastSave = performance.now();
  ui.setSaveStatus(ok);
  if (!ok && !savedWarning) {
    savedWarning = true;
    ui.toast('Không lưu được vào trình duyệt. Xuất bản lưu trong Cài đặt để giữ tiến độ.', 'error');
  }
  if (manual && ok) ui.toast('Đã lưu khu vườn.');
}
function command(name, ...args) {
  if (!canWrite) return;
  advance(state);
  const result = act(state, name, ...args);
  if (result.ok) {
    ui.scene.effect(result);
    playSound(result.sound, state.settings.sound);
    persist();
  }
  ui.toast(result.message, result.ok ? 'success' : 'error');
  if (result.levelUp) {
    ui.toast(
      `Cấp ${result.levelUp} · ${LEVELS[result.levelUp - 1].name}. Mở ${LEVELS[result.levelUp - 1].unlock.toLowerCase()}.`,
      'level'
    );
    playSound('level', state.settings.sound);
  }
  ui.render();
  return result;
}
function replaceState(next) {
  state = next;
  ensureOrders(state);
  advance(state);
  ui.state = state;
  ui.selected = null;
  ui.crop = 'radish';
  ui.mode = 'plant';
  ui.tab = 'farm';
  ui.closeDialog();
  ui.render(true);
  persist();
}
async function onAction(action, data = {}) {
  if (!canWrite && action !== 'reload') return;
  if (action === 'plot') {
    advance(state);
    const id = Number(data.id),
      p = state.plots[id];
    ui.selected = id;
    if (!isUnlocked(state, p)) {
      ui.setTab('growth');
      ui.render();
      return;
    }
    if (ui.mode === 'marker') {
      p.marker = (p.marker + 1) % 4;
      state.revision++;
      persist();
      ui.render();
      return;
    }
    if (!p.prepared) {
      command('prepare', id);
      return;
    }
    if (ui.mode === 'water') {
      command('water', id);
      return;
    }
    if (isReady(state, p)) {
      command('harvest', id);
      return;
    }
    if (!p.crop) {
      command('plant', id, ui.crop);
      return;
    }
    ui.render();
    return;
  }
  if (action === 'seed') {
    const c = CROPS[data.crop];
    if (c && c.level <= levelOf(state)) ui.setCrop(data.crop);
    return;
  }
  if (action === 'mode') {
    ui.setMode(data.mode);
    return;
  }
  if (action === 'tab') {
    ui.setTab(data.tab);
    return;
  }
  if (action === 'building') {
    ui.building = data.building;
    ui.render(true);
    return;
  }
  if (action === 'category') {
    ui.category = data.category;
    ui.render(true);
    return;
  }
  if (action === 'recipe') {
    command('queueRecipe', data.recipe);
    return;
  }
  if (action === 'collect') {
    command('collect', data.building);
    return;
  }
  if (action === 'sell') {
    command('sell', data.item, Number(data.quantity));
    return;
  }
  if (action === 'deliver') {
    command('deliver', Number(data.id));
    return;
  }
  if (action === 'refresh-order') {
    command('refreshOrder', Number(data.id));
    return;
  }
  if (action === 'buy-building') {
    command('purchaseBuilding', data.building);
    return;
  }
  if (action === 'expand') {
    command('expand', data.area);
    return;
  }
  if (action === 'upgrade') {
    command('upgrade', data.upgrade);
    return;
  }
  if (action === 'claim') {
    if (data.open) ui.setTab('journal');
    else command('claimQuest');
    return;
  }
  if (action === 'sound') {
    state.settings.sound = !state.settings.sound;
    playSound('plant', state.settings.sound);
    persist();
    ui.render();
    return;
  }
  if (action === 'setting') {
    state.settings[data.setting] = data.value;
    playSound('plant', state.settings.sound && data.setting === 'sound');
    persist();
    ui.render();
    return;
  }
  if (action === 'circuits') {
    state.settings.circuits = !state.settings.circuits;
    persist();
    ui.render();
    return;
  }
  if (action === 'zoom-in' || action === 'zoom-out') {
    ui.setZoom(action === 'zoom-in' ? 0.2 : -0.2);
    return;
  }
  if (action === 'help') {
    ui.help();
    return;
  }
  if (action === 'settings') {
    ui.settings();
    return;
  }
  if (action === 'close') {
    ui.closeDialog();
    return;
  }
  if (action === 'save') {
    persist(true);
    return;
  }
  if (action === 'export') {
    advance(state);
    const blob = new Blob([encodeSave(state)], { type: 'application/json' }),
      url = URL.createObjectURL(blob),
      link = document.createElement('a');
    link.href = url;
    link.download = `mach-vuon-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    ui.toast('Đã xuất bản lưu khu vườn.');
    return;
  }
  if (action === 'import') {
    const input = document.querySelector('#import-file');
    input.value = '';
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      try {
        if (file.size > 500000) throw new Error('Bản lưu quá lớn.');
        const next = decodeSave(await file.text());
        ui.showDialog(
          'Mang khu vườn này về?',
          `<p class="dialog-copy">Bản lưu cấp ${levelOf(next)}, ${next.coins.toLocaleString('vi-VN')} xu sẽ thay thế khu vườn hiện tại.</p><div class="dialog-buttons"><button class="button" data-action="close">Giữ vườn hiện tại</button><button id="confirm-import" class="button primary">Nhập khu vườn</button></div>`
        );
        document.querySelector('#confirm-import').addEventListener(
          'click',
          () => {
            replaceState(next);
            ui.toast('Khu vườn đã trở về.');
          },
          { once: true }
        );
      } catch (error) {
        ui.toast(
          error.message === 'Bản lưu quá lớn.'
            ? error.message
            : 'Không đọc được bản lưu hợp lệ. Vườn hiện tại được giữ nguyên.',
          'error'
        );
      }
    };
    input.click();
    return;
  }
  if (action === 'reset-confirm') {
    ui.resetConfirm();
    return;
  }
  if (action === 'reset') {
    try {
      resetSave();
      replaceState(createState());
      ui.toast('Một khu vườn mới đang đón bạn.');
    } catch {
      ui.toast('Trình duyệt không cho phép xóa bản lưu.', 'error');
    }
    return;
  }
}

ui = new UI(state, onAction);
if (loaded.warning) ui.toast(loaded.warning, 'error');
if (!loaded.fresh && elapsed.elapsed > 60000) {
  const ripe = state.plots.filter((p) => isReady(state, p)).length,
    finished = Object.values(state.buildings).reduce(
      (n, b) => n + b.queue.filter((j) => j.readyAt <= state.clock).length,
      0
    );
  ui.toast(`Mừng bạn về vườn · ${ripe} ô đã chín · ${finished} mẻ đã xong.`, 'level');
}

function lockScreen() {
  canWrite = false;
  const overlay = document.createElement('div');
  overlay.className = 'locked-screen';
  overlay.setAttribute('role', 'alert');
  overlay.innerHTML =
    '<div><h2>Vườn đang mở ở thẻ khác.</h2><p>Đóng thẻ đó rồi trở lại đây để tiếp tục chăm cùng một khu vườn.</p><button class="button primary" id="retry-lock">Mở lại khu vườn</button></div>';
  document.body.append(overlay);
  document.querySelector('#retry-lock').addEventListener('click', () => location.reload());
}
function tick(time) {
  if (canWrite && !document.hidden && time - lastRender >= 250) {
    lastRender = time;
    const result = advance(state);
    if (result.expired) ui.toast('Chuyến đò đã rời bến. Một đơn mới đang chờ.');
    ui.render();
    if (time - lastSave > 5000) persist();
  }
  raf = requestAnimationFrame(tick);
}
if (navigator.locks) {
  navigator.locks
    .request('mach-vuon.writer', { ifAvailable: true }, async (lock) => {
      if (!lock) {
        lockScreen();
        return;
      }
      canWrite = true;
      persist();
      await new Promise((resolve) => {
        releaseLock = resolve;
      });
    })
    .catch(() => lockScreen());
} else {
  canWrite = true;
  persist();
}
document.addEventListener('visibilitychange', () => {
  if (!canWrite) return;
  advance(state);
  persist();
  if (!document.hidden) ui.render(true);
});
window.addEventListener('pagehide', () => {
  if (canWrite) {
    advance(state);
    persist();
  }
  cancelAnimationFrame(raf);
  releaseLock?.();
});
window.addEventListener('pageshow', (e) => {
  if (e.persisted) location.reload();
});
window.addEventListener('storage', (e) => {
  if (!navigator.locks && e.key === SAVE_KEY && canWrite) lockScreen();
});
requestAnimationFrame(tick);

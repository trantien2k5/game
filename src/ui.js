import {
  CROPS,
  FAMILIES,
  ITEMS,
  RECIPES,
  BUILDINGS,
  LEVELS,
  AREAS,
  UPGRADES,
  QUESTS,
  PEOPLE,
  CATEGORIES,
} from './data.js';
import {
  levelOf,
  capacity,
  usedCapacity,
  waterCapacity,
  queueCapacity,
  hasItems,
  isReady,
  isUnlocked,
} from './state.js';
import { weatherOf, weatherRemaining, marketPrice, cropYield } from './simulation.js';
import { upgradeCost } from './actions.js';
import { itemArt, portrait } from './art.js';
import { icon } from './icons.js';
import { createScene, formatTime } from './scene.js';

const fmt = (n) => n.toLocaleString('vi-VN');
const coin = (n) => `<span class="coin-value">${icon('coins')}${fmt(n)}</span>`;
const btn = (action, body, attrs = '', cls = 'button') =>
  `<button class="${cls}" data-action="${action}" ${attrs}>${body}</button>`;
const iconButton = (action, symbol, label, attrs = '') =>
  btn(action, icon(symbol), `aria-label="${label}" title="${label}" ${attrs}`, 'icon-button');
const progress = (value, max, cls = '') =>
  `<div class="progress ${cls}" role="progressbar" aria-valuenow="${Math.min(value, max)}" aria-valuemin="0" aria-valuemax="${max}" aria-label="Tiến độ"><span style="width:${Math.min(100, (value / max) * 100)}%"></span></div>`;
const requirement = (state, id, n) =>
  `<span class="requirement ${state.inventory[id] >= n ? 'enough' : ''}" title="${ITEMS[id].name}">${itemArt(id)}<span>${Math.min(n, state.inventory[id])}<span class="muted">/${n}</span></span>${state.inventory[id] >= n ? icon('check', 'tiny') : ''}</span>`;

export class UI {
  constructor(state, onAction) {
    this.state = state;
    this.onAction = onAction;
    this.tab = 'farm';
    this.crop = 'radish';
    this.mode = 'plant';
    this.selected = null;
    this.building = 'mill';
    this.category = 'all';
    this.zoom = 1;
    this.signatures = {};
    this.saveStatus = 'Đã lưu';
    this.lastTick = -1;
    this.compactLayout = matchMedia('(max-width: 1100px), (max-height: 560px)');
    document.querySelector('#app').innerHTML = `
      <header class="topbar">
        <a class="brand" href="./" aria-label="Mạch Vườn"><span class="brand-mark">${icon('sprout')}</span><span><strong>Mạch Vườn<span class="brand-dot">.</span></strong><small>MỘT GÓC BÌNH YÊN CỦA BẠN</small></span></a>
        <div class="resource-bar" id="resources"></div>
        <div class="header-actions">${iconButton('sound', 'volume-x', 'Bật âm thanh', 'id="sound-button"')}${iconButton('save', 'save', 'Lưu ngay', 'id="save-status"')}${iconButton('settings', 'settings-2', 'Cài đặt và bản lưu')}</div>
      </header>
      <div class="game-shell">
        <nav class="navigation" aria-label="Các khu trong vườn">
          <div class="nav-main">${[
            ['farm', 'sprout', 'Khu vườn'],
            ['production', 'factory', 'Sản xuất'],
            ['inventory', 'shopping-basket', 'Kho & chợ'],
            ['orders', 'mail', 'Đơn hàng'],
            ['growth', 'map', 'Mở rộng'],
          ]
            .map(([id, symbol, label]) =>
              btn(
                'tab',
                `${icon(symbol)}<span>${label}</span>`,
                `data-tab="${id}" title="${label}"`,
                'nav-button'
              )
            )
            .join('')}</div>
          <div class="nav-bottom">${btn('tab', `${icon('book-open')}<span>Sổ vườn</span>`, 'data-tab="journal" title="Sổ vườn"', 'nav-button')}${iconButton('help', 'circle-help', 'Sổ tay chăm vườn')}<span class="nav-leaf">${icon('leaf')}</span></div>
        </nav>
        <main class="farm-main" id="main">
          <div class="farm-heading"><div><div class="eyebrow"><span class="live-dot"></span>NÔNG TRẠI BÊN SUỐI</div><h1>Vườn đang thức giấc<span>.</span></h1></div><div id="weather" class="weather"></div></div>
          <section class="world-section" aria-label="Khu vườn">
            <div class="world-top"><div class="farm-sign">${icon('map-pin')}<span>Bờ Đông <span class="muted">/</span> <b id="plot-count">9 ô đất</b></span></div><div class="world-tools">${iconButton('circuits', 'waypoints', 'Ẩn/hiện mạch sống', 'id="circuit-button" aria-pressed="true"')}${iconButton('help', 'circle-help', 'Sổ tay chăm vườn')}${iconButton('zoom-out', 'minus', 'Thu nhỏ')}${iconButton('zoom-in', 'plus', 'Phóng to')}</div></div>
            <div id="world-scroll" class="world-scroll"><div id="world" class="world"></div></div>
            <div class="world-bottom"><div id="plot-context" class="plot-context"></div><div class="weather-caption" id="weather-caption"></div></div>
            <div class="world-legend"><span><i class="root-dot"></i>Rễ</span>${icon('arrow-right')}<span><i class="leaf-dot"></i>Lá</span>${icon('arrow-right')}<span><i class="bloom-dot"></i>Hoa</span>${icon('arrow-right')}<span><i class="root-dot"></i>Rễ</span>${iconButton('help', 'info', 'Mạch sống và luân canh')}</div>
          </section>
          <section class="planting-section" aria-label="Hạt giống và dụng cụ"><div class="planting-heading"><div class="section-caption">${icon('sprout')}<h2>Mùa mới từ đây</h2></div><div class="tool-switch" role="group" aria-label="Dụng cụ">${btn('mode', icon('sprout') + '<span>Gieo hạt</span>', 'data-mode="plant"', 'tool-button active')}${btn('mode', icon('droplets') + '<span>Tưới</span>', 'data-mode="water"', 'tool-button')}${btn('mode', icon('flag') + '<span>Cắm cờ</span>', 'data-mode="marker"', 'tool-button')}</div></div><div id="seed-tray" class="seed-tray"></div></section>
          <section id="quest-strip" class="quest-strip" aria-label="Chặng vườn hiện tại"></section>
        </main>
        <aside class="side-panel" id="side-panel" aria-label="Hoạt động nông trại"><div class="panel-toolbar">${btn('tab', icon('arrow-left') + '<span>Về khu vườn</span>', 'data-tab="farm"', 'button quiet panel-return')}</div><div id="panel-content" tabindex="0" aria-label="Nội dung hoạt động"></div></aside>
      </div>`;
    this.scene = createScene(
      document.querySelector('#world'),
      (id) => this.onAction('plot', { id }),
      (id) => {
        this.building = id;
        this.setTab('production');
      }
    );
    document.querySelector('#app').addEventListener('click', (e) => {
      const target = e.target.closest('[data-action]');
      if (!target || target.disabled) return;
      this.onAction(target.dataset.action, { ...target.dataset, element: target });
    });
    document.querySelector('#dialog').addEventListener('click', (e) => {
      const target = e.target.closest('[data-action]');
      if (target && !target.disabled)
        this.onAction(target.dataset.action, { ...target.dataset, element: target });
      if (e.target === document.querySelector('#dialog')) {
        const rect = e.target.getBoundingClientRect();
        if (
          e.clientX < rect.left ||
          e.clientX > rect.right ||
          e.clientY < rect.top ||
          e.clientY > rect.bottom
        )
          this.closeDialog();
      }
    });
    this.compactLayout.addEventListener('change', () => this.syncLayout());
    document.querySelectorAll('.tool-button').forEach((button) => {
      const name = button.textContent.trim();
      button.setAttribute('aria-label', name);
      button.title = name;
    });
    document.querySelector('#side-panel').addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.compactLayout.matches && !document.querySelector('#dialog').open) {
        event.preventDefault();
        this.setTab('farm');
        document.querySelector('.nav-button[data-tab="farm"]').focus({ preventScroll: true });
      }
    });
    this.render(true);
    this.setZoom(0);
  }
  setTab(tab) {
    const changed = tab !== this.tab;
    this.tab = tab;
    this.render(true);
    if (changed) document.querySelector('#panel-content').scrollTop = 0;
  }
  syncLayout() {
    const compact = this.compactLayout.matches;
    const open = compact && this.tab !== 'farm';
    const signature = `${compact}:${open}`;
    if (signature === this.signatures.layout) return;
    this.signatures.layout = signature;
    const main = document.querySelector('#main');
    const panel = document.querySelector('#side-panel');
    const active = document.activeElement;
    document.querySelector('#app').classList.toggle('single-panel', compact);
    document.querySelector('#app').classList.toggle('panel-open', open);
    main.inert = open;
    panel.inert = compact && !open;
    if (open && main.contains(active)) document.querySelector('.panel-return').focus({ preventScroll: true });
    if (compact && !open && panel.contains(active))
      document.querySelector('.nav-button[data-tab="farm"]').focus({ preventScroll: true });
  }
  setCrop(id) {
    this.crop = id;
    this.mode = 'plant';
    this.render(true);
  }
  setMode(mode) {
    this.mode = mode;
    this.render(true);
  }
  setZoom(delta) {
    this.zoom = Math.min(1.7, Math.max(1, this.zoom + delta));
    this.scene.setZoom(this.zoom);
    document.querySelector('[data-action="zoom-out"]').disabled = this.zoom <= 1;
    document.querySelector('[data-action="zoom-in"]').disabled = this.zoom >= 1.7;
  }
  render(force = false) {
    this.syncLayout();
    const s = this.state,
      level = levelOf(s),
      w = weatherOf(s);
    const resourceSig = JSON.stringify([s.coins, s.xp, s.water, usedCapacity(s), capacity(s)]);
    if (force || resourceSig !== this.signatures.resources) {
      this.signatures.resources = resourceSig;
      const current = LEVELS[level - 1],
        next = LEVELS[level];
      document.querySelector('#resources').innerHTML =
        `<div class="resource coins-resource">${icon('coins')}<span><small>ĐỒNG XU</small><strong id="coin-count">${fmt(s.coins)}</strong></span></div><button class="resource level-resource" data-action="tab" data-tab="journal" title="${current.name}"><span class="level-badge">${level}</span><span><small>CẤP ${level} · ${current.name}</small><span class="xp-line">${progress(next ? s.xp - current.xp : 1, next ? next.xp - current.xp : 1)}<span>${next ? `${s.xp}/${next.xp}` : 'MAX'}</span></span></span></button><div class="resource water-resource" title="Hồi 1 nước mỗi 20 giây; khi mưa mỗi 10 giây">${icon('droplets')}<span><small>NƯỚC GIẾNG</small><strong>${s.water}<em>/${waterCapacity(s)}</em></strong></span></div><button class="resource inventory-resource" data-action="tab" data-tab="inventory">${icon('backpack')}<span><small>KHO VƯỜN</small><strong class="${usedCapacity(s) > capacity(s) * 0.9 ? 'warning-text' : ''}">${usedCapacity(s)}<em>/${capacity(s)}</em></strong></span></button>`;
    }
    const second = Math.floor(s.clock / 1000);
    if (force || this.lastTick !== second) {
      this.lastTick = second;
      document.querySelector('#weather').innerHTML =
        `<span class="weather-icon">${icon(w.icon)}</span><span><strong>${w.name}</strong><small>Ngày ${String(Math.floor(s.clock / 960000) + 1).padStart(2, '0')} <span>·</span> ${formatTime(weatherRemaining(s))}</small></span>`;
      this.updateTimers();
    }
    document.querySelector('#weather-caption').textContent = w.desc;
    document.querySelector('#plot-count').textContent =
      `${s.plots.filter((p) => isUnlocked(s, p)).length} ô đất`;
    this.scene.render(s, this.selected, this.mode);
    this.renderContext();
    const seedSig = JSON.stringify([
      level,
      s.coins,
      this.crop,
      this.mode,
      this.selected !== null ? s.plots[this.selected].soil : null,
    ]);
    if (force || seedSig !== this.signatures.seed) {
      this.signatures.seed = seedSig;
      this.renderSeeds();
    }
    const questSig = JSON.stringify([s.quest, s.stats]);
    if (force || questSig !== this.signatures.quest) {
      this.signatures.quest = questSig;
      this.renderQuest();
    }
    const sideSig = JSON.stringify([
      this.tab,
      this.building,
      this.category,
      s.coins,
      s.xp,
      s.inventory,
      s.buildings,
      s.orders,
      s.upgrades,
      s.areas,
      s.quest,
      s.stats,
      s.reputation,
      w.id,
      Object.values(s.buildings).map((b) => b.queue.map((j) => j.readyAt <= s.clock)),
      s.orders.map((o) => o.refreshAt <= s.clock),
    ]);
    if (force || sideSig !== this.signatures.side) {
      this.signatures.side = sideSig;
      const active = document.activeElement,
        focusData = active?.closest('#panel-content') ? { ...active.dataset } : null;
      document.querySelector('#panel-content').innerHTML =
        this.tab === 'production'
          ? this.productionPanel()
          : this.tab === 'inventory'
            ? this.inventoryPanel()
            : this.tab === 'growth'
              ? this.growthPanel()
              : this.tab === 'journal'
                ? this.journalPanel()
                : this.ordersPanel();
      if (focusData?.action) {
        const match = [...document.querySelectorAll('#panel-content [data-action]')].find((el) =>
          Object.keys(focusData).every((k) => el.dataset[k] === focusData[k])
        );
        match?.focus({ preventScroll: true });
      }
      this.updateTimers();
    }
    document.querySelectorAll('.nav-button').forEach((b) => {
      const active = b.dataset.tab === this.tab;
      b.classList.toggle('active', active);
      b.setAttribute('aria-current', active ? 'page' : 'false');
    });
    document.querySelectorAll('.tool-button').forEach((b) => {
      const active = b.dataset.mode === this.mode;
      b.classList.toggle('active', active);
      b.setAttribute('aria-pressed', String(active));
    });
    document.querySelector('#circuit-button').setAttribute('aria-pressed', String(s.settings.circuits));
    document.querySelector('#sound-button').innerHTML = icon(s.settings.sound ? 'volume-2' : 'volume-x');
    document
      .querySelector('#sound-button')
      .setAttribute('aria-label', s.settings.sound ? 'Tắt âm thanh' : 'Bật âm thanh');
    document.querySelector('#sound-button').title = s.settings.sound ? 'Tắt âm thanh' : 'Bật âm thanh';
    document.body.classList.toggle('reduced-motion', !s.settings.motion);
  }
  renderSeeds() {
    const s = this.state,
      level = levelOf(s),
      soil = this.selected !== null ? s.plots[this.selected].soil : null;
    document.querySelector('#seed-tray').innerHTML = Object.entries(CROPS)
      .map(([id, c]) => {
        const locked = level < c.level,
          rotates = soil && FAMILIES[soil].next === c.family;
        return `<button class="seed ${this.crop === id && this.mode === 'plant' ? 'selected' : ''} ${locked ? 'seed-locked' : ''}" data-action="seed" data-crop="${id}" aria-pressed="${this.crop === id && this.mode === 'plant'}" title="${c.name} · ${c.note}. ${c.time}s · ${c.yield} sản phẩm · ${c.value} xu/món. Nhóm ${FAMILIES[c.family].name}." ${locked ? 'disabled' : ''}><span class="seed-top"><span class="family-label ${c.family}">${FAMILIES[c.family].name}</span>${locked ? icon('lock') : rotates ? `<span class="rotation-label">+1</span>` : this.crop === id && this.mode === 'plant' ? icon('check') : ''}</span><span class="seed-art">${itemArt(id)}</span><strong>${c.name}</strong><span class="seed-detail">${locked ? `Cấp ${c.level}` : `${c.time}s <span>·</span> ${c.seed ? c.seed + ' xu' : 'Miễn phí'}`}</span></button>`;
      })
      .join('');
  }
  renderContext() {
    const s = this.state,
      p = this.selected !== null ? s.plots[this.selected] : null;
    let html = '';
    if (!p)
      html = `<span class="context-icon">${icon('sprout')}</span><span><strong>${s.stats.harvests ? 'Một vụ mới đang chờ' : 'Củ hồng đầu tiên đã chín'}</strong><small>${s.stats.harvests ? 'Đất lành giữ nhịp, mùa sau nối mùa trước.' : 'Món quà nhỏ của Miên dành cho khu vườn.'}</small></span>`;
    else if (!isUnlocked(s, p))
      html = `<span class="context-icon">${icon('lock')}</span><span><strong>${AREAS[p.area].name}</strong><small>${AREAS[p.area].note}</small></span>`;
    else if (p.crop) {
      const c = CROPS[p.crop.type];
      html = `<span class="context-item">${itemArt(p.crop.type)}</span><span><strong>${c.name} <span class="context-family">${FAMILIES[c.family].name}</span></strong><small>${isReady(s, p) ? 'Sẵn sàng thu hoạch' : formatTime(p.crop.readyAt - s.clock) + ' nữa'} · ${cropYield(p)} sản phẩm${p.crop.rotation ? ' · Luân canh +1' : ''}${p.crop.pulses ? ' · Mạch +' + p.crop.pulses : ''}</small></span>`;
    } else
      html = `<span class="context-icon">${icon(p.prepared ? 'sprout' : 'shovel')}</span><span><strong>${p.prepared ? 'Đất sẵn sàng' : 'Đất mới, mùa mới'}</strong><small>${p.soil ? 'Dấu ' + FAMILIES[p.soil].name + ' · tiếp nối bằng ' + FAMILIES[FAMILIES[p.soil].next].name + ' để thêm 1 sản lượng' : p.prepared ? 'Gieo ' + CROPS[this.crop].name.toLowerCase() + ' · ' + (CROPS[this.crop].seed ? CROPS[this.crop].seed + ' xu' : 'miễn phí') : 'Xới một lần để mở đầu mùa vụ'}</small></span>`;
    const target = document.querySelector('#plot-context');
    if (target.innerHTML !== html) target.innerHTML = html;
  }
  renderQuest() {
    const s = this.state,
      q = QUESTS[s.quest],
      target = document.querySelector('#quest-strip');
    if (!q) {
      target.innerHTML = `<span class="quest-emblem">${icon('trees')}</span><div class="quest-copy"><small>MỘT MIỀN XANH</small><strong>Khu vườn đã tìm được nhịp riêng.</strong><span>Những mùa vụ mới vẫn đang chờ bạn.</span></div>${icon('badge-check', 'quest-done')}`;
      return;
    }
    const n = Math.min(q.target, s.stats[q.stat]),
      ready = n >= q.target;
    target.innerHTML = `<span class="quest-emblem">${icon(ready ? 'gift' : 'book-open')}</span><div class="quest-copy"><small>CHẶNG ${String(s.quest + 1).padStart(2, '0')} <span>/${String(QUESTS.length).padStart(2, '0')}</span></small><strong>${q.title}</strong><span>${q.text}</span></div><div class="quest-progress"><span>${n}<small>/${q.target}</small></span>${progress(n, q.target)}</div>${btn('claim', ready ? `${icon('gift')}Nhận ${coin(q.coins)}` : `${icon('arrow-up-right')}Sổ vườn`, ready ? '' : 'data-open="journal"', ready ? 'button primary' : 'button quiet')}`;
  }
  panelHeader(eyebrow, title, detail = '', action = '') {
    return `<div class="panel-header"><div class="eyebrow">${eyebrow}</div><div class="panel-title"><h2>${title}</h2>${action}</div>${detail ? `<p>${detail}</p>` : ''}</div>`;
  }
  ordersPanel() {
    const s = this.state,
      w = weatherOf(s);
    return (
      this.panelHeader(
        'TỪ NHỮNG NGƯỜI HÀNG XÓM',
        'Lời hẹn đầu ngõ',
        `${s.stats.orders} chuyến hàng <span>·</span> ${s.reputation} tín nhiệm`,
        iconButton('tab', 'arrow-up-right', 'Sổ vườn', 'data-tab="journal"')
      ) +
      `<div class="orders-list">${s.orders
        .map((o) => {
          const p = PEOPLE[o.person],
            ready = hasItems(s, o.requirements);
          return `<article class="order ${o.express ? 'express' : ''}" data-order="${o.id}"><div class="customer"><span class="portrait">${portrait(p.portrait, p.color)}</span><span><strong>${p.name}</strong><small>${p.title}</small></span>${iconButton('refresh-order', 'refresh-cw', 'Đổi khách hàng', `data-id="${o.id}" ${s.clock < o.refreshAt ? 'disabled' : ''}`)}</div>${o.express ? `<div class="express-line">${icon('timer')}Chuyến đò sắp đi<span data-deadline="${o.expiresAt}">${formatTime(o.expiresAt - s.clock)}</span></div>` : ''}<div class="order-items">${Object.entries(
            o.requirements
          )
            .map(([id, n]) => requirement(s, id, n))
            .join(
              ''
            )}<span class="order-xp">+${o.xp} XP</span></div><div class="order-bottom"><span class="order-reward">${coin(o.coins)}${o.express ? '<small>Đơn hẹn giờ</small>' : ''}</span>${btn('deliver', `${ready ? 'Giao hàng' : 'Chưa đủ'}${icon(ready ? 'arrow-right' : 'package-open')}`, `data-id="${o.id}" ${ready ? '' : 'disabled'}`, ready ? 'button primary compact' : 'button compact muted-button')}</div></article>`;
        })
        .join(
          ''
        )}</div><div class="market-note"><span class="market-note-icon">${icon('store')}</span><div><div class="eyebrow">CHỢ ĐANG TÌM</div><strong>${ITEMS[w.demand].name}</strong><span>Giá hôm nay <b>+30%</b></span></div>${btn('tab', icon('arrow-right'), 'data-tab="inventory" aria-label="Đến chợ"', 'icon-button')}</div><div class="neighbor-note"><span class="neighbor-avatar">${portrait(2, '#96a582')}</span><p>“Một ít mang ra chợ,<br>một ít để dành cho mùa sau.”<small>MIÊN · HÀNG XÓM TRÊN ĐỒI</small></p></div>`
    );
  }
  productionPanel() {
    const s = this.state,
      level = levelOf(s),
      id = this.building,
      b = s.buildings[id],
      data = BUILDINGS[id];
    let content =
      this.panelHeader('TỪ ĐẤT ĐẾN THÀNH PHẨM', 'Góc sản xuất') +
      `<div class="building-tabs" role="tablist" aria-label="Công trình">${Object.entries(BUILDINGS)
        .map(([key, d]) =>
          btn(
            'building',
            `${icon(d.icon)}<span>${d.short}</span>`,
            `data-building="${key}" role="tab" aria-selected="${id === key}"`,
            id === key ? 'building-tab active' : 'building-tab'
          )
        )
        .join('')}</div>`;
    content += `<div class="workshop-title"><span style="--building-color:${data.color}">${icon(data.icon)}</span><div><h3>${data.name}</h3><p>${b.owned ? 'Mỗi mẻ, một chút hương vườn.' : data.desc}</p></div></div>`;
    if (!b.owned)
      return (
        content +
        `<div class="construction"><span class="construction-icon">${icon('hammer')}</span><h3>${level >= data.level ? 'Một góc vườn đang chờ' : 'Hẹn ở cấp ' + data.level}</h3><p>${data.desc}</p>${btn('buy-building', `${icon('hammer')}Dựng nhà ${coin(data.cost)}`, `data-building="${id}" ${level < data.level || s.coins < data.cost ? 'disabled' : ''}`, 'button primary full')}</div>`
      );
    content += `<div class="subheading"><h3>${id === 'coop' ? 'Ổ trứng' : 'Hàng đợi'}</h3><span>${b.queue.length}/${queueCapacity(s)}</span></div><div class="production-queue">${Array.from(
      { length: queueCapacity(s) },
      (_, i) => {
        const job = b.queue[i];
        if (!job) return `<div class="queue-slot empty">${icon('plus')}<small>Chỗ trống</small></div>`;
        const r = RECIPES[job.recipe],
          done = job.readyAt <= s.clock;
        return `<button class="queue-slot ${done ? 'done' : ''}" data-action="collect" data-building="${id}" ${done ? '' : 'disabled'} title="${ITEMS[r.output].name}">${itemArt(r.output)}<span>${done ? 'Thu ngay' : `<span data-deadline="${job.readyAt}">${formatTime(job.readyAt - s.clock)}</span>`}</span>${done ? icon('check', 'queue-check') : `<div class="progress"><span data-progress-end="${job.readyAt}" data-progress-start="${job.startAt}" style="width:${Math.max(0, Math.min(100, ((s.clock - job.startAt) / (job.readyAt - job.startAt)) * 100))}%"></span></div>`}</button>`;
      }
    ).join(
      ''
    )}</div><div class="subheading recipe-heading"><h3>${id === 'coop' ? 'Chăm đàn vịt' : 'Công thức'}</h3>${icon('notebook-pen')}</div><div class="recipe-list">${Object.entries(
      RECIPES
    )
      .filter(([, r]) => r.building === id)
      .map(([key, r]) => {
        const locked = level < r.level,
          able = !locked && hasItems(s, r.inputs) && b.queue.length < queueCapacity(s);
        return `<article class="recipe"><div class="recipe-top"><span class="recipe-art">${itemArt(r.output)}</span><div><strong>${key === 'carrotbread' ? 'Bánh cà rốt' : ITEMS[r.output].name}</strong><small>${locked ? 'Cấp ' + r.level : `${r.time}s · ${r.quantity} thành phẩm · +${r.xp} XP`}</small></div></div><div class="recipe-bottom"><div class="ingredients">${Object.entries(
          r.inputs
        )
          .map(([k, n]) => requirement(s, k, n))
          .join(
            ''
          )}</div>${btn('recipe', icon(locked ? 'lock' : id === 'coop' ? 'wheat' : 'plus'), `data-recipe="${key}" aria-label="${id === 'coop' ? 'Cho vịt ăn' : 'Chế biến ' + ITEMS[r.output].name}" title="${id === 'coop' ? 'Cho vịt ăn' : 'Chế biến ' + ITEMS[r.output].name}" ${able ? '' : 'disabled'}`, 'icon-button make-button')}</div></article>`;
      })
      .join('')}</div>`;
    return content;
  }
  inventoryPanel() {
    const s = this.state,
      w = weatherOf(s);
    return (
      this.panelHeader(
        'CẤT MỘT MÙA VÀO KHO',
        'Kho & quầy chợ',
        `${usedCapacity(s)} / ${capacity(s)} chỗ đang dùng`,
        iconButton('tab', 'arrow-up-right', 'Nâng cấp kho', 'data-tab="growth"')
      ) +
      `<div class="storage-meter">${progress(usedCapacity(s), capacity(s), usedCapacity(s) > capacity(s) * 0.9 ? 'almost-full' : '')}</div><div class="inventory-filter" role="tablist" aria-label="Loại hàng">${Object.entries(
        CATEGORIES
      )
        .map(([id, name]) =>
          btn(
            'category',
            name,
            `data-category="${id}" role="tab" aria-selected="${this.category === id}"`,
            this.category === id ? 'filter-tab active' : 'filter-tab'
          )
        )
        .join(
          ''
        )}</div><div class="price-notice">${icon(w.icon)}<span>${ITEMS[w.demand].name} đang được giá <b>+30%</b></span></div><div class="inventory-list">${
        Object.entries(ITEMS)
          .filter(
            ([id, d]) => s.inventory[id] > 0 && (this.category === 'all' || d.category === this.category)
          )
          .map(
            ([id, d]) =>
              `<article class="inventory-item"><span class="inventory-art">${itemArt(id)}</span><div class="inventory-info"><strong>${d.name}<span>×${s.inventory[id]}</span></strong><small>${coin(marketPrice(s, id))} / món${marketPrice(s, id) > d.value ? '<b class="price-up">↑</b>' : ''}</small><div class="sell-controls">${btn('sell', 'Bán 1', `data-item="${id}" data-quantity="1"`, 'button mini')}${btn('sell', 'Bán 5', `data-item="${id}" data-quantity="5" ${s.inventory[id] < 5 ? 'disabled' : ''}`, 'button mini')}${btn('sell', icon('arrow-up-right') + 'Tất cả', `data-item="${id}" data-quantity="${s.inventory[id]}"`, 'button mini quiet')}</div></div></article>`
          )
          .join('') ||
        `<div class="empty-state">${icon('basket-shopping')}<h3>Kho đang thoáng</h3><p>Mùa thu hoạch tiếp theo sẽ mang đến điều gì?</p></div>`
      }</div><div class="inventory-footer">${icon('shield-check')}Nông sản và thành phẩm không hỏng.</div>`
    );
  }
  growthPanel() {
    const s = this.state,
      level = levelOf(s);
    return (
      this.panelHeader(
        'THÊM ĐẤT, THÊM KHẢ NĂNG',
        'Vươn một miền xanh',
        `${s.stats.expansions}/3 vùng đất mới`
      ) +
      `<div class="subheading"><h3>Bên kia hàng rào</h3>${icon('map')}</div><div class="expansion-list">${Object.entries(
        AREAS
      )
        .map(([id, a]) => {
          const owned = s.areas[id],
            locked = level < a.level;
          return `<article class="expansion"><div class="area-picture ${id}">${icon(id === 'creek' ? 'waves' : id === 'sunny' ? 'sun' : 'mountain')}<span>+${a.count}<small>Ô ĐẤT</small></span></div><div class="expansion-copy"><strong>${a.name}</strong><p>${a.note}</p>${owned ? `<span class="owned-label">${icon('check')}Đã mở</span>` : btn('expand', locked ? `${icon('lock')}Cấp ${a.level}` : `Mở đất ${coin(a.cost)}`, `data-area="${id}" ${locked || s.coins < a.cost ? 'disabled' : ''}`, 'button compact')}</div></article>`;
        })
        .join(
          ''
        )}</div><div class="subheading"><h3>Một khu vườn tốt hơn</h3>${icon('hammer')}</div><div class="upgrade-list">${Object.entries(
        UPGRADES
      )
        .map(([id, u]) => {
          const max = s.upgrades[id] >= u.max,
            locked = level < u.level,
            cost = upgradeCost(s, id);
          return `<article class="upgrade"><span class="upgrade-icon">${icon(u.icon)}</span><div><strong>${u.name}${u.max > 1 ? ` <small>${s.upgrades[id]}/${u.max}</small>` : ''}</strong><p>${u.note}</p>${max ? `<span class="owned-label">${icon('check')}Đã hoàn thành</span>` : btn('upgrade', locked ? `${icon('lock')}Cấp ${u.level}` : `Nâng cấp ${coin(cost)}`, `data-upgrade="${id}" ${locked || s.coins < cost ? 'disabled' : ''}`, 'button compact')}</div></article>`;
        })
        .join('')}</div>`
    );
  }
  journalPanel() {
    const s = this.state,
      level = levelOf(s);
    return (
      this.panelHeader('NHỮNG NGÀY Ở MẠCH VƯỜN', 'Sổ của người làm vườn') +
      `<div class="journal-summary"><span>${icon('sprout')}<strong>${s.stats.harvests}</strong><small>Vụ thu hoạch</small></span><span>${icon('waypoints')}<strong>${s.stats.pulses}</strong><small>Mạch sống</small></span><span>${icon('heart-handshake')}<strong>${s.reputation}</strong><small>Tín nhiệm</small></span></div><div class="subheading"><h3>Chuyện của khu vườn</h3><span>${s.quest}/${QUESTS.length}</span></div><div class="chapters">${QUESTS.map(
        (q, i) => {
          const done = i < s.quest,
            active = i === s.quest,
            ready = active && s.stats[q.stat] >= q.target;
          return `<div class="chapter ${active ? 'current' : ''} ${done ? 'completed' : ''}"><span class="chapter-number">${done ? icon('check') : String(i + 1).padStart(2, '0')}</span><div><strong>${q.title}</strong><p>${q.text}</p>${active ? `${progress(s.stats[q.stat], q.target)}<small>${Math.min(s.stats[q.stat], q.target)}/${q.target} · ${q.coins} xu · ${q.xp} XP</small>${ready ? btn('claim', `${icon('gift')}Nhận quà`, '', 'button primary compact') : ''}` : ''}</div></div>`;
        }
      ).join(
        ''
      )}</div><div class="subheading"><h3>Những mùa phía trước</h3>${icon('route')}</div><div class="level-road">${LEVELS.map((l, i) => `<div class="level-stop ${level >= i + 1 ? 'unlocked' : ''}"><span>${level > i + 1 ? icon('check') : i + 1}</span><div><strong>${l.name}</strong><p>${l.unlock}</p><small>${l.xp} XP</small></div></div>`).join('')}</div>`
    );
  }
  updateTimers() {
    document.querySelectorAll('[data-deadline]').forEach((el) => {
      const text = formatTime(Number(el.dataset.deadline) - this.state.clock);
      if (el.textContent !== text) el.textContent = text;
    });
    document.querySelectorAll('[data-progress-end]').forEach((el) => {
      const end = Number(el.dataset.progressEnd),
        start = Number(el.dataset.progressStart);
      el.style.width = `${Math.max(0, Math.min(100, ((this.state.clock - start) / (end - start)) * 100))}%`;
    });
  }
  toast(message, type = 'success') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    const mark = document.createElement('span');
    mark.innerHTML = icon(type === 'error' ? 'circle-alert' : type === 'level' ? 'sparkles' : 'check');
    const text = document.createElement('span');
    text.textContent = message;
    el.append(mark, text);
    const holder = document.querySelector('#toasts');
    holder.append(el);
    while (holder.children.length > 1) holder.firstChild.remove();
    setTimeout(() => el.remove(), type === 'level' ? 6500 : 3600);
  }
  showDialog(title, body, cls = '') {
    const dialog = document.querySelector('#dialog');
    dialog.className = cls;
    dialog.innerHTML = `<div class="dialog-header"><h2 id="dialog-title">${title}</h2>${iconButton('close', 'x', 'Đóng')}</div>${body}`;
    if (!dialog.open) dialog.showModal();
  }
  closeDialog() {
    document.querySelector('#dialog').close();
  }
  help() {
    this.showDialog(
      'Một lá thư từ Miên',
      `<div class="help-intro"><span>${portrait(2, '#96a582')}</span><p>“Đất ở đây nhớ những mùa đã qua.<br>Chăm một cây, cả khu vườn cùng lớn.”</p></div><div class="help-cycle"><span>${itemArt('radish')}<strong>Rễ</strong></span>${icon('arrow-right')}<span>${itemArt('mint')}<strong>Lá</strong></span>${icon('arrow-right')}<span>${itemArt('wheat')}<strong>Hoa</strong></span>${icon('arrow-right')}<span>${itemArt('radish')}<strong>Rễ</strong></span></div><div class="help-rules"><p><b>Thu hoạch, rồi tiếp sức.</b> Cây đang lớn cạnh một cạnh ô, thuộc nhóm kế tiếp, nhận +1 sản lượng và lớn nhanh thêm 20%. Mỗi vụ nhận tối đa 2 nhịp.</p><p><b>Đất nhớ mùa trước.</b> Trồng nhóm kế tiếp trên cùng ô nhận thêm 1 sản lượng. Đường viền đất giữ màu của vụ trước.</p><p><b>Một ít nước, một chút kiên nhẫn.</b> Tưới một lần rút 25% thời gian gốc. Cây không héo khi bạn vắng mặt.</p><p><b>Gieo hạt ở đất trống. Chạm cây chín để thu.</b> Chạm đất mới để xới. Giữ nguyên liệu cho xưởng hoặc giao hàng, bán phần dư ở Kho & chợ.</p></div><div class="keyboard-note">${icon('keyboard')}Tab để chọn · Enter để thao tác · Phím mũi tên giữa các ô đất</div>${btn('close', `${icon('sprout')}Về với vườn`, '', 'button primary full')}`,
      'help-dialog'
    );
  }
  settings() {
    const s = this.state;
    this.showDialog(
      'Góc nhỏ của bạn',
      `<div class="settings-list">${[
        ['sound', 'Âm thanh khu vườn', 'volume-2'],
        ['motion', 'Chuyển động nhẹ', 'wind'],
        ['circuits', 'Đường mạch sống', 'waypoints'],
      ]
        .map(
          ([id, label, symbol]) =>
            `<label class="setting-row"><span>${icon(symbol)}${label}</span><input type="checkbox" data-setting="${id}" ${s.settings[id] ? 'checked' : ''}></label>`
        )
        .join(
          ''
        )}</div><div class="save-tools"><h3>Bản lưu của khu vườn</h3><p>Tiến độ tự lưu trên trình duyệt này. Xuất bản lưu để mang vườn sang thiết bị khác.</p><div>${btn('export', `${icon('download')}Xuất bản lưu`, '', 'button')}${btn('import', `${icon('upload')}Nhập bản lưu`, '', 'button')}<input id="import-file" type="file" accept="application/json,.json" hidden></div><span id="save-feedback" class="muted">${this.saveStatus}</span></div><div class="reset-row"><span>Khởi đầu một khu vườn mới</span>${btn('reset-confirm', icon('rotate-ccw') + 'Làm lại', '', 'button danger')}</div>`
    );
    document
      .querySelectorAll('[data-setting]')
      .forEach((el) =>
        el.addEventListener('change', () =>
          this.onAction('setting', { setting: el.dataset.setting, value: el.checked })
        )
      );
  }
  resetConfirm() {
    this.showDialog(
      'Bắt đầu lại khu vườn?',
      `<p class="dialog-copy">Tiến độ hiện tại trong trình duyệt này sẽ bị xóa. Bạn có thể xuất bản lưu trước khi làm lại.</p><div class="dialog-buttons">${btn('export', `${icon('download')}Xuất bản lưu`)}${btn('reset', `${icon('rotate-ccw')}Xóa và bắt đầu lại`, '', 'button danger')}</div>`
    );
  }
  setSaveStatus(ok) {
    this.saveStatus = ok ? 'Đã lưu' : 'Chưa lưu được';
    const el = document.querySelector('#save-status');
    el.innerHTML = icon(ok ? 'save' : 'cloud-off') + `<span class="sr-only">${this.saveStatus}</span>`;
    el.title = `${this.saveStatus} · Lưu ngay`;
    el.setAttribute('aria-label', `${this.saveStatus} · Lưu ngay`);
    el.classList.toggle('save-failed', !ok);
  }
}

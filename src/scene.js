import { CROPS, FAMILIES, BUILDINGS, AREAS } from './data.js';
import { isUnlocked, isReady, neighbors, levelOf } from './state.js';
import { cropYield, weatherOf } from './simulation.js';
import { cropArt, tree, buildingArt, duck } from './art.js';

const NS = 'http://www.w3.org/2000/svg';
export const point = (id) => ({
  x: 500 + ((id % 5) - Math.floor(id / 5)) * 55,
  y: 235 + ((id % 5) + Math.floor(id / 5)) * 28,
});
const diamond = 'M0-25 51 0 0 25-51 0Z';
const positions = { mill: [269, 242], coop: [748, 340], kitchen: [630, 187], press: [230, 441] };
export const formatTime = (ms) => {
  const s = Math.ceil(Math.max(0, ms) / 1000);
  return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s}s`;
};

export function createScene(container, onPlot, onBuilding) {
  let grasses = '';
  for (let i = 0; i < 130; i++) {
    const x = 130 + ((i * 137 + 41) % 760),
      y = 135 + ((i * 89 + 13) % 460);
    if (Math.abs(x - 500) / 270 + Math.abs(y - 345) / 155 < 1.15) continue;
    grasses += `<path d="m${x} ${y} -2-5m2 5 3-4" stroke="${i % 3 ? '#9dbb86' : '#e0d899'}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;
  }
  const trees = [
    [164, 201, 1.15, 0],
    [150, 296, 0.7, 1],
    [817, 241, 1.1, 2],
    [867, 303, 0.85, 0],
    [850, 453, 0.7, 1],
    [690, 569, 0.72, 2],
    [147, 466, 0.9, 0],
    [304, 575, 0.65, 2],
    [354, 137, 0.65, 1],
    [771, 157, 0.85, 0],
  ]
    .map((t) => tree(...t))
    .join('');
  container.innerHTML = `<svg id="farm-world" class="farm-world" viewBox="80 75 840 570" role="group" aria-label="Vườn bên suối, 25 ô đất. Dùng Tab và Enter để chăm cây.">
    <defs>
      <pattern id="water-lines" width="70" height="34" patternUnits="userSpaceOnUse"><path d="M7 13h20m15 13h18" stroke="#d5e9df" stroke-width="2" opacity=".4" stroke-linecap="round"/></pattern>
      <filter id="soft-shadow" x="-30%" y="-40%" width="160%" height="190%"><feDropShadow dx="0" dy="5" stdDeviation="4" flood-color="#345b44" flood-opacity=".10"/></filter>
      <pattern id="soil-lines" width="18" height="18" patternUnits="userSpaceOnUse" patternTransform="rotate(27)"><path d="M0 0v18" stroke="#806247" stroke-width="2" opacity=".18"/></pattern>
    </defs>
    <path d="M80 0H920V680H80Z" fill="#e8eee0"/>
    <path d="M60 160q128-51 238-22t203-15q172-63 292 49t160 86v363H60Z" fill="#dce8cd"/>
    <path d="M85 351q131-81 279 110t313 40q147-85 262-11v161H80Z" fill="#d4e3c4"/>
    <path d="M959 92Q685 25 810 178q125 130-4 205t-93 146q5 103-192 111" fill="none" stroke="#b8d3c0" stroke-width="99"/>
    <path d="M959 92Q685 25 810 178q125 130-4 205t-93 146q5 103-192 111" fill="none" stroke="#88b8ba" stroke-width="75"/>
    <path d="M959 92Q685 25 810 178q125 130-4 205t-93 146q5 103-192 111" fill="none" stroke="#a8cdcc" stroke-width="62"/>
    <path d="M959 92Q685 25 810 178q125 130-4 205t-93 146q5 103-192 111" fill="none" stroke="url(#water-lines)" stroke-width="62"/>
    <path d="M254 256q47 21 74 4t80-52q104-83 208-5M297 278Q174 327 267 430t165 124q167 72 283-17" fill="none" stroke="#cdd4ae" stroke-width="28"/>
    <path d="M254 253q47 21 74 4t80-52q104-83 208-5M297 275Q174 324 267 427t165 124q167 72 283-17" fill="none" stroke="#eee6c9" stroke-width="23"/>
    <g class="bridge" transform="translate(721 536) rotate(-8)"><path d="M-48-22H40V21H-48Z" fill="#ae9672"/><path d="M-46-19H39V16H-46Z" fill="#dbc29a"/><path d="M-37-19v35m11-35v35m11-35v35m11-35v35m11-35v35m11-35v35m11-35v35" stroke="#b69d79" stroke-width="2"/><path d="M-48-24H41M-48 17H41" stroke="#eddbb7" stroke-width="4"/><path d="M-44-24v-14m40 14v-14m41 14v-14m-80 54V7m40 10V7m40 10V7" stroke="#ac936d" stroke-width="4"/></g>
    ${grasses}
    <g class="flowers" fill="#f6efd7"><circle cx="330" cy="190" r="3"/><circle cx="337" cy="194" r="3"/><circle cx="179" cy="387" r="3"/><circle cx="186" cy="379" r="3"/><circle cx="606" cy="568" r="3"/><circle cx="615" cy="573" r="3"/></g>
    <g class="flowers" fill="#db9998"><circle cx="300" cy="480" r="3"/><circle cx="308" cy="478" r="3"/><circle cx="746" cy="235" r="3"/><circle cx="753" cy="242" r="3"/></g>
    ${trees}
    <g transform="translate(399 173)"><ellipse cy="6" rx="23" ry="9" fill="#789279" opacity=".15"/><path d="M-16-16v22q16 12 32 0v-22" fill="#a1aaa0"/><ellipse cy="-16" rx="16" ry="8" fill="#d3d8c6"/><ellipse cy="-16" rx="11" ry="5" fill="#79a0a6"/><path d="M-22-17v-24m44 24v-24m-25-1 28-12 25 12Z" fill="#c19572" stroke="#aa8a6d" stroke-width="3"/></g>
    <g id="plots"></g><g id="circuits" pointer-events="none"></g>
    <g id="buildings"></g>
    <g id="farm-ducks"></g>
    <g transform="translate(371 539)"><path d="M0 0v-36" stroke="#a5916f" stroke-width="5"/><path d="M-29-45H26v24h-55Z" fill="#efe5ca" stroke="#bca783" stroke-width="2" rx="2"/><text y="-29" text-anchor="middle" fill="#6c7961" font-size="10" font-weight="700">MẠCH VƯỜN</text></g>
    <g id="weather-fx" pointer-events="none"></g><g id="scene-fx" pointer-events="none"></g>
  </svg>`;
  const svg = container.querySelector('svg');
  let zoom = 1;
  let center = { x: 500, y: 350 };
  let frame = { width: 840, height: 570 };
  let drag = null;
  let dragged = false;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  function updateCamera() {
    const width = frame.width / zoom;
    const height = frame.height / zoom;
    center.x = clamp(center.x, 60 + width / 2, 940 - width / 2);
    center.y = clamp(center.y, 60 + height / 2, 660 - height / 2);
    svg.setAttribute('viewBox', `${center.x - width / 2} ${center.y - height / 2} ${width} ${height}`);
    svg.dataset.zoom = String(zoom);
  }
  const resize = new ResizeObserver(([entry]) => {
    const { width, height } = entry.contentRect;
    if (!width || !height) return;
    frame =
      height < 280
        ? { width: 560, height: 310 }
        : width < 500
          ? { width: 560, height: 440 }
          : height < 420
            ? { width: 660, height: 360 }
            : { width: 840, height: 570 };
    updateCamera();
  });
  resize.observe(container);
  function setZoom(value) {
    zoom = value;
    if (zoom === 1) center = { x: 500, y: 350 };
    updateCamera();
  }
  // Pan the SVG camera, never a scroll container or the document.
  svg.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    dragged = false;
    const matrix = svg.getScreenCTM();
    drag = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      center: { ...center },
      scale: matrix.a,
    };
  });
  svg.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!dragged && Math.hypot(dx, dy) < 6) return;
    dragged = true;
    svg.setPointerCapture(event.pointerId);
    center = { x: drag.center.x - dx / drag.scale, y: drag.center.y - dy / drag.scale };
    updateCamera();
  });
  const endDrag = () => {
    drag = null;
  };
  svg.addEventListener('pointerup', endDrag);
  svg.addEventListener('pointercancel', endDrag);
  svg.addEventListener(
    'click',
    (event) => {
      if (dragged) {
        event.preventDefault();
        event.stopImmediatePropagation();
        dragged = false;
      }
    },
    true
  );
  svg.addEventListener('focusin', (event) => {
    const target = event.target.closest('[data-plot], [data-building]');
    if (!target) return;
    const bounds = target.getBoundingClientRect();
    const viewport = svg.getBoundingClientRect();
    if (
      bounds.left >= viewport.left &&
      bounds.right <= viewport.right &&
      bounds.top >= viewport.top &&
      bounds.bottom <= viewport.bottom
    )
      return;
    const position = target.dataset.plot !== undefined ? point(Number(target.dataset.plot)) : null;
    if (position) {
      center = position;
      updateCamera();
    }
  });
  const plotNodes = new Map(),
    signatures = new Map();
  for (let i = 0; i < 25; i++) {
    const p = point(i),
      g = document.createElementNS(NS, 'g');
    g.setAttribute('transform', `translate(${p.x} ${p.y})`);
    g.setAttribute('class', 'plot');
    g.setAttribute('role', 'button');
    g.setAttribute('tabindex', '0');
    g.dataset.plot = i;
    g.addEventListener('click', () => onPlot(i));
    g.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onPlot(i);
      }
      const delta = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 5, ArrowUp: -5 }[e.key];
      if (delta) {
        e.preventDefault();
        plotNodes.get(Math.max(0, Math.min(24, i + delta)))?.focus();
      }
    });
    svg.querySelector('#plots').append(g);
    plotNodes.set(i, g);
  }
  for (const [id, [x, y]] of Object.entries(positions)) {
    const g = document.createElementNS(NS, 'g');
    g.dataset.building = id;
    g.setAttribute('transform', `translate(${x} ${y})`);
    g.setAttribute('role', 'button');
    g.setAttribute('tabindex', '0');
    g.setAttribute('class', 'world-building');
    g.addEventListener('click', () => onBuilding(id));
    g.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onBuilding(id);
      }
    });
    svg.querySelector('#buildings').append(g);
  }
  let buildingSignature = '',
    circuitSignature = '',
    weather = '',
    ducks = '';
  function render(state, selected, mode) {
    for (const p of state.plots) {
      const unlocked = isUnlocked(state, p),
        ready = isReady(state, p),
        c = p.crop,
        d = c ? CROPS[c.type] : null;
      const progress = c ? Math.min(1, Math.max(0, 1 - (c.readyAt - state.clock) / c.duration)) : 0;
      const stage = ready ? 3 : Math.min(2, Math.floor(progress * 3));
      const sig = JSON.stringify([
        unlocked,
        ready,
        c?.type,
        c?.pulses,
        c?.rotation,
        c?.watered,
        stage,
        p.soil,
        p.prepared,
        p.marker,
        selected === p.id,
        mode,
      ]);
      const g = plotNodes.get(p.id);
      if (signatures.get(p.id) !== sig) {
        signatures.set(p.id, sig);
        let content = '';
        if (!unlocked) {
          content = `<path d="${diamond}" fill="#c8d8b7" fill-opacity=".46" stroke="#b4c8a1" stroke-dasharray="3 5" stroke-width="1.5"/><path d="M-6 1h12v8H-6Zm2 0v-4a4 4 0 0 1 8 0v4" fill="none" stroke="#8ca17d" stroke-width="2" stroke-linejoin="round"/>`;
          g.setAttribute('aria-label', `${AREAS[p.area].name}, chưa mở, cấp ${AREAS[p.area].level}`);
        } else {
          content = `<path d="M-51 0 0 25 51 0v7L0 32-51 7Z" fill="${p.prepared ? '#987755' : '#a8ba88'}"/><path d="${diamond}" fill="${p.prepared ? '#bd9b72' : '#b6cb99'}" stroke="${ready ? '#f4e8a3' : '#d2b389'}" stroke-width="${ready ? 2.5 : 1}"/>`;
          if (p.prepared) content += `<path d="${diamond}" fill="url(#soil-lines)"/>`;
          else
            content +=
              '<path d="m-17 5-3-10m3 10 5-7m17 9 3-8m-3 8-5-5" stroke="#6f976b" stroke-width="2" fill="none"/>';
          if (p.soil)
            content += `<path d="M-39 5 0 24 39 5" fill="none" stroke="${FAMILIES[p.soil].color}" stroke-width="4" opacity=".9"/>`;
          if (c) {
            for (const [x, y, s] of [
              [-19, -8, 0.48],
              [15, -7, 0.48],
              [-1, 9, 0.58],
            ])
              content += `<g class="crop-art ${ready ? 'ripe' : ''}" transform="translate(${x - 40 * s} ${y - 65 * s}) scale(${s})">${cropArt(c.type, stage)}</g>`;
            if (c.watered)
              content +=
                '<path d="M34-5q-7 9 0 10 7-1 0-10Z" fill="#9bcfd1" stroke="#eff8ea" stroke-width="1"/>';
            if (c.pulses)
              content += `<circle cx="-34" cy="-1" r="7" fill="#356e56"/><text x="-34" y="2.7" text-anchor="middle" font-size="9" font-weight="700" fill="#fff5ce">${c.pulses}</text>`;
            if (ready)
              content +=
                '<g class="ready-spark"><path d="M25-34v-8m-4 4h8" stroke="#fffae0" stroke-width="2.4" stroke-linecap="round"/></g>';
            content += `<rect x="-17" y="15" width="34" height="3" rx="1.5" fill="#856d51" opacity=".45"/><rect class="plot-progress" x="-17" y="15" width="${progress * 34}" height="3" rx="1.5" fill="${ready ? '#f6e6a3' : '#c3dda0'}"/>`;
          }
          if (p.marker)
            content += `<path d="M38 6v-24" stroke="#978162" stroke-width="2"/><path d="m38-19 10 4-10 5Z" fill="${['', '#d48687', '#8399bd', '#e1be5d'][p.marker]}"/>`;
          g.setAttribute(
            'aria-label',
            `Ô ${p.id + 1}: ${c ? `${d.name}, ${ready ? `sẵn sàng, ${cropYield(p)} sản phẩm` : 'đang lớn'}` : p.prepared ? `đất trống${p.soil ? ', dấu ' + FAMILIES[p.soil].name : ''}` : 'đất cần xới'}`
          );
        }
        if (selected === p.id)
          content += `<path d="M0-28 55 0 0 28-55 0Z" fill="none" stroke="${mode === 'water' ? '#5d9faf' : '#faf9e9'}" stroke-width="3" pointer-events="none"/>`;
        g.innerHTML = content;
        g.classList.toggle('locked', !unlocked);
        g.classList.toggle('ready', ready);
      }
      const bar = g.querySelector('.plot-progress');
      if (bar) bar.setAttribute('width', String(progress * 34));
    }
    const cs = JSON.stringify([
      state.settings.circuits,
      state.plots.map((p) => [p.crop?.type, p.crop?.pulses, isReady(state, p)]),
    ]);
    if (cs !== circuitSignature) {
      circuitSignature = cs;
      let lines = '';
      if (state.settings.circuits)
        for (const p of state.plots) {
          if (!p.crop) continue;
          for (const n of neighbors(state, p.id))
            if (
              n.crop &&
              !isReady(state, n) &&
              n.crop.pulses < 2 &&
              FAMILIES[CROPS[p.crop.type].family].next === CROPS[n.crop.type].family
            ) {
              const a = point(p.id),
                b = point(n.id);
              lines += `<path d="M${a.x} ${a.y + 7} ${b.x} ${b.y + 7}" class="circuit-line"/><circle cx="${a.x + (b.x - a.x) * 0.72}" cy="${a.y + (b.y - a.y) * 0.72 + 7}" r="2.7" fill="#f9f1bf"/>`;
            }
        }
      svg.querySelector('#circuits').innerHTML = lines;
    }
    const bs = JSON.stringify([
      state.buildings,
      state.clock >= 0 &&
        Object.values(state.buildings).map((b) => b.queue.filter((j) => j.readyAt <= state.clock).length),
      levelOf(state),
    ]);
    if (bs !== buildingSignature) {
      buildingSignature = bs;
      for (const [id, data] of Object.entries(BUILDINGS)) {
        const b = state.buildings[id],
          n = b.queue.filter((j) => j.readyAt <= state.clock).length;
        const g = svg.querySelector(`[data-building="${id}"]`);
        const label = n
          ? `${data.short} · ${n} xong`
          : b.owned
            ? data.short
            : `${data.short} · ${levelOf(state) >= data.level ? data.cost + ' xu' : 'cấp ' + data.level}`;
        g.innerHTML =
          buildingArt(id, b.owned) +
          `<g class="building-label" transform="translate(0 41)"><rect x="-61" y="-12" width="122" height="25" rx="5" fill="${n ? '#336d56' : '#fffdf2'}" stroke="${n ? '#336d56' : '#d5ddc9'}"/><text text-anchor="middle" y="4" font-size="11" font-weight="650" fill="${n ? '#fffbe5' : '#637461'}">${label}</text>${b.queue.length && !n ? '<circle cx="52" cy="-9" r="4" fill="#dfb861"/>' : ''}</g>`;
        g.setAttribute('aria-label', label);
      }
    }
    if (ducks !== String(state.buildings.coop.owned)) {
      ducks = String(state.buildings.coop.owned);
      svg.querySelector('#farm-ducks').innerHTML = state.buildings.coop.owned
        ? duck(756, 403, 0.9) + duck(787, 420, 0.7, true) + duck(733, 436, 0.75)
        : duck(767, 481, 0.65);
    }
    const w = weatherOf(state).id;
    if (weather !== w) {
      weather = w;
      let rain = '';
      if (w === 'rain')
        for (let i = 0; i < 30; i++) {
          const x = 140 + ((i * 79) % 730),
            y = 110 + ((i * 67) % 460);
          rain += `<path d="m${x} ${y} -4 9" stroke="#87afb3" stroke-width="1.5" opacity=".4"/>`;
        }
      svg.querySelector('#weather-fx').innerHTML = rain;
      svg.dataset.weather = w;
    }
    svg.classList.toggle('no-motion', !state.settings.motion);
  }
  function effect(result) {
    if (result.plot === undefined) return;
    const p = point(result.plot),
      g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'floating-reward');
    g.innerHTML = `<text x="${p.x}" y="${p.y - 43}" text-anchor="middle" fill="${result.item ? '#2a674f' : '#568f91'}" stroke="#fffdf0" stroke-width="3" paint-order="stroke" font-size="16" font-weight="800">${result.item ? '+' + result.quantity : result.sound === 'water' ? '−25%' : '+'}</text>`;
    for (const id of result.pulseTargets || []) {
      const n = point(id);
      g.innerHTML += `<path d="M${p.x} ${p.y} ${n.x} ${n.y}" stroke="#f5edab" stroke-width="5" class="pulse-flash"/>`;
    }
    svg.querySelector('#scene-fx').append(g);
    setTimeout(() => g.remove(), 1300);
  }
  return { render, effect, setZoom };
}

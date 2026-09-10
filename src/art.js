// Original scalable game artwork. All shapes are authored for Mach Vuon.
const wrap = (body, viewBox = '0 0 80 80', cls = '') =>
  `<svg class="art ${cls}" viewBox="${viewBox}" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
const leaf = (x, y, angle = 0, color = '#639b64') =>
  `<ellipse cx="${x}" cy="${y}" rx="6" ry="13" fill="${color}" transform="rotate(${angle} ${x} ${y})"/><path d="M${x} ${y + 8}v-14" stroke="#477b50" stroke-width="1.4" transform="rotate(${angle} ${x} ${y})"/>`;
const stem = '<path d="M40 65V25" stroke="#528454" stroke-width="3" stroke-linecap="round"/>';

export function cropArt(type, stage = 3) {
  if (stage === 0)
    return (
      '<ellipse cx="40" cy="62" rx="13" ry="4" fill="#624e3b" opacity=".17"/><path d="M40 62v-8" stroke="#538653" stroke-width="2"/>' +
      leaf(35, 51, -50) +
      leaf(45, 49, 45, '#87b976')
    );
  const scale = stage === 1 ? '.64' : stage === 2 ? '.83' : '1';
  let body = '';
  if (type === 'radish')
    body =
      '<path d="M39 60q-6 10 1 14" fill="none" stroke="#e3cfb4" stroke-width="2"/><path d="M24 45c0-15 33-17 33 0 0 14-13 23-18 23S23 56 24 45" fill="#da7985"/><path d="M27 54q10 18 22 6l-10 8Z" fill="#f7ddcd"/><ellipse cx="32" cy="43" rx="4" ry="7" fill="#ef9aa1"/>' +
      leaf(34, 22, -28) +
      leaf(47, 20, 27, '#80a862') +
      leaf(40, 19, 0, '#518254');
  if (type === 'carrot')
    body =
      '<path d="M27 32q15-10 27 3L35 72q-4 4-4-2Z" fill="#e79250"/><path d="m31 41 12 3m-11 8 7 2m-5 8 5 1" stroke="#c77740" stroke-width="2" stroke-linecap="round"/>' +
      leaf(32, 19, -29) +
      leaf(47, 18, 28, '#81a761') +
      leaf(40, 16, 0, '#5a8b52');
  if (type === 'mint')
    body =
      stem +
      leaf(30, 51, -50) +
      leaf(50, 43, 52, '#7faf72') +
      leaf(30, 33, -48, '#6ba571') +
      leaf(49, 24, 45, '#97bc7a') +
      leaf(39, 16, -8, '#659862');
  if (type === 'wheat') {
    body = '<path d="m31 68-6-39m15 39V15m7 53 12-38" stroke="#af9450" fill="none" stroke-width="2.4"/>';
    for (const [x, y, a] of [
      [25, 32, -12],
      [40, 17, 0],
      [57, 32, 18],
    ]) {
      body += `<g transform="translate(${x} ${y}) rotate(${a})">`;
      for (let i = 0; i < 4; i++)
        body += `<ellipse cx="-4" cy="${i * 6}" rx="3" ry="5" transform="rotate(-35 -4 ${i * 6})" fill="#e0b65a"/><ellipse cx="4" cy="${i * 6 + 2}" rx="3" ry="5" transform="rotate(35 4 ${i * 6 + 2})" fill="#f0cf79"/>`;
      body += '</g>';
    }
  }
  if (type === 'blueberry')
    body =
      stem +
      leaf(25, 39, -60) +
      leaf(51, 25, 50, '#79a174') +
      leaf(32, 21, -35, '#659166') +
      '<g fill="#787cae" stroke="#626b98" stroke-width="1.3"><circle cx="30" cy="49" r="9"/><circle cx="48" cy="43" r="10"/><circle cx="42" cy="59" r="9"/><circle cx="55" cy="58" r="8"/></g><g fill="#bdc1dd"><circle cx="27" cy="45" r="2.5"/><circle cx="45" cy="39" r="2.5"/><circle cx="39" cy="56" r="2.5"/></g>';
  if (type === 'sunflower') {
    body = stem + leaf(28, 49, -55) + leaf(52, 43, 55, '#87ac61');
    for (let i = 0; i < 10; i++)
      body += `<ellipse cx="40" cy="13" rx="5" ry="10" fill="${i % 2 ? '#edc24e' : '#f5d671'}" transform="rotate(${i * 36} 40 28)"/>`;
    body +=
      '<circle cx="40" cy="28" r="11" fill="#8c6848"/><circle cx="40" cy="28" r="7" fill="#ad8654"/><g fill="#725d41"><circle cx="37" cy="25" r="1"/><circle cx="43" cy="26" r="1"/><circle cx="39" cy="31" r="1"/></g>';
  }
  return `<g transform="translate(${40 - 40 * Number(scale)} ${70 - 70 * Number(scale)}) scale(${scale})">${body}</g>`;
}
export function itemArt(id, cls = '') {
  if (['radish', 'mint', 'wheat', 'carrot', 'blueberry', 'sunflower'].includes(id))
    return wrap(cropArt(id), undefined, cls);
  const jars = {
    jam: ['#8185b0', '#b9abc9'],
    oil: ['#d2b451', '#e8d38a'],
    tea: ['#84a88b', '#c0d1ac'],
    berrytea: ['#8b93b9', '#b7c9d3'],
  };
  let b = '';
  if (jars[id]) {
    const [c, l] = jars[id];
    b = `<path d="M26 22h28v8l6 9v27q0 6-7 6H27q-7 0-7-6V39l6-9Z" fill="${c}" stroke="#ffffff" stroke-opacity=".6" stroke-width="2"/><rect x="24" y="18" width="32" height="9" rx="3" fill="${l}"/><rect x="23" y="42" width="34" height="20" rx="2" fill="#f4efd9"/><path d="M32 53q8-12 15-4-3 13-15 4" fill="${c}"/><path d="M27 32v7" stroke="white" opacity=".5" stroke-width="3" stroke-linecap="round"/>`;
  } else if (id === 'flour' || id === 'feed') {
    b = `<path d="m27 17 27 1-5 12q15 15 12 36-20 12-41-1-3-18 13-35Z" fill="${id === 'flour' ? '#e5d6ad' : '#97ac83'}"/><path d="M29 29h22" stroke="#9e865e" stroke-width="4"/><ellipse cx="40" cy="51" rx="14" ry="16" fill="#f8f1d9"/>${id === 'flour' ? '<path d="M40 61V42m0 5-6-5m6 11 6-5m-6 11-6-5" stroke="#bc9e57" fill="none" stroke-width="3"/>' : '<path d="M31 56q1-16 17-14-1 18-17 14" fill="#739666"/>'}`;
  } else if (id === 'egg')
    b =
      '<path d="M40 12c-11 0-22 28-22 39a22 22 0 0 0 44 0c0-11-11-39-22-39" fill="#f0e4c9" stroke="#cebd9f" stroke-width="1.5"/><ellipse cx="33" cy="38" rx="7" ry="13" fill="#fff9e9" transform="rotate(20 33 38)"/>';
  else if (id === 'bread')
    b =
      '<path d="M12 49C9 22 62 16 69 45l-1 15q-28 15-55-1Z" fill="#bc854b"/><path d="M12 46C13 21 62 20 69 44q1 17-28 18T12 46" fill="#e2b76d"/><path d="m28 33-7 14m24-17-9 18m23-13-8 15" stroke="#f8deb0" stroke-width="5" stroke-linecap="round"/>';
  else if (id === 'basket')
    b =
      '<path d="M24 36q0-35 32 0" fill="none" stroke="#9f7853" stroke-width="5"/><path d="m15 38 7 32h36l8-32Z" fill="#bd9768"/><path d="M18 46h46M20 55h42m-34-17 3 31m10-31v31m11-31-3 31" fill="none" stroke="#e0bb83" stroke-width="3"/><circle cx="30" cy="32" r="11" fill="#d88486"/><circle cx="49" cy="30" r="10" fill="#848cb2"/><path d="m39 34 10-20 9 24" fill="#84a776"/>';
  return wrap(b, undefined, cls);
}
export function tree(x, y, size = 1, variant = 0) {
  const colors = [
    ['#72986b', '#8baa79', '#a2ba87'],
    ['#a7ad70', '#bcc17f', '#d0cf90'],
    ['#6d9b83', '#89b397', '#a6c5a5'],
  ][variant % 3];
  return `<g transform="translate(${x} ${y}) scale(${size})"><ellipse cx="3" cy="10" rx="28" ry="10" fill="#547b64" opacity=".15"/><path d="M-5 7 0-44 7 8Z" fill="#937c5d"/><path d="m0-15-15-18m18 9 15-20" stroke="#937c5d" stroke-width="5"/><path d="M-30-37q-14-32 12-39-3-28 24-26 27-2 27 27 28 11 14 38-4 13-30 11-29 7-47-11" fill="${colors[0]}"/><ellipse cx="-5" cy="-71" rx="27" ry="24" fill="${colors[1]}"/><ellipse cx="-12" cy="-81" rx="15" ry="12" fill="${colors[2]}" opacity=".7"/></g>`;
}
export function buildingArt(id, owned = true) {
  const muted = owned ? '' : 'opacity=".48"';
  let body = '';
  if (id === 'mill')
    body =
      '<path d="m-52 2 55 28 57-29-57-29Z" fill="#769589" opacity=".18"/><path d="m-30-59 33 16v68l-33-17Z" fill="#f1e6c9"/><path d="m3-43 33-17v68L3 25Z" fill="#d5ceb0"/><path d="m-42-63 45-31 42 29L3-42Z" fill="#759ba3"/><path d="m3-94 42 29L3-42Z" fill="#547b89"/><path d="m-13 16 0-26 14 7v27" fill="#927859"/><path d="m13-24 12-6v17l-12 6Z" fill="#86aaae"/><g class="windmill-blades" transform="translate(3 -52)"><g class="blades"><path d="M0 0-7-47 6-49 3-8 47-9 50 4 10 3 8 45-5 48-3 10-45 9-48-4-10-3Z" fill="#f4edda" stroke="#a49576" stroke-width="2"/><path d="M0-40V40M-40 0h80" stroke="#c4b696" stroke-width="2"/><circle r="6" fill="#9a8161"/></g></g>';
  if (id === 'kitchen')
    body =
      '<ellipse cy="10" rx="71" ry="22" fill="#527961" opacity=".14"/><path d="m-53-52 50 24V25L-53 0Z" fill="#eedaba"/><path d="m-3-28 56-30V-1L-3 25Z" fill="#d0c5a8"/><path d="m-65-56 38-51L7-84-3-25Z" fill="#c77769"/><path d="m-27-107 72 34 23 16L-3-25 7-84Z" fill="#df9480"/><path d="m25-87 0-34 15 7v36" fill="#ddc7ac"/><path d="m-34-21 20 10v29l-20-10Z" fill="#779b8e"/><path d="m13-22 26-14v20L13-2Z" fill="#8cb5b4"/><path d="M-52-45-8-24M-54-35-8-14" stroke="#ddc7a8" stroke-width="2"/><path d="m21-35 0 26" stroke="#f0e8cf" stroke-width="2"/><g class="smoke" fill="#fff" opacity=".6"><circle cx="33" cy="-132" r="7"/><circle cx="29" cy="-149" r="10"/><circle cx="36" cy="-170" r="12"/></g>';
  if (id === 'coop')
    body =
      '<ellipse cy="11" rx="70" ry="23" fill="#527961" opacity=".14"/><path d="m-40-40 38 19V20L-40 1Z" fill="#d6ae7e"/><path d="m-2-21 45-23V-3L-2 20Z" fill="#bd986d"/><path d="m-49-44 30-31L7-63-2-17Z" fill="#89a59c"/><path d="m-19-75 50 24 24 8L-2-17 7-63Z" fill="#b1c2ae"/><path d="m9-16 17-9V6L9 15Z" fill="#746748"/><path d="m11 16 26 13 17-9L26 6" fill="#ddbc89"/><path d="m-44-10 38 19" stroke="#c39867" stroke-width="3"/><path d="m-69 7 0-24m0 8 36 18m-18-20v25m-18-10 36 18" stroke="#e8d6ab" stroke-width="4" stroke-linecap="round"/>';
  if (id === 'press')
    body =
      '<ellipse cy="10" rx="65" ry="22" fill="#527961" opacity=".14"/><path d="m-47-49 44 22V24L-47 2Z" fill="#e7d7bd"/><path d="m-3-27 47-24V0L-3 24Z" fill="#d2c6b0"/><path d="m-57-53 41-42 27 14L-3-23Z" fill="#9d98ad"/><path d="m-16-95 58 29 17 16L-3-23 11-81Z" fill="#bab0bf"/><path d="m-33-19 18 9v27l-18-9Z" fill="#927757"/><path d="m8-26 23-12v19L8-7Z" fill="#9bbab8"/><ellipse cx="40" cy="0" rx="14" ry="7" fill="#baa57a"/><path d="M26-20v20q14 12 28 0v-20" fill="#c8ac7a"/><ellipse cx="40" cy="-20" rx="14" ry="7" fill="#e4ce99"/><path d="M28-16v13m7-12v16m10-16V1m7-18v13" stroke="#a99066" stroke-width="2"/>';
  return `<g ${muted}>${body}</g>`;
}
export function duck(x, y, scale = 1, flipped = false) {
  return `<g class="duck" transform="translate(${x} ${y}) scale(${flipped ? -scale : scale} ${scale})"><ellipse cy="6" rx="15" ry="5" fill="#567e68" opacity=".15"/><path d="m-7 7 0 4m10-4v4" stroke="#c59647" stroke-width="2"/><ellipse cy="0" rx="13" ry="9" fill="#fcf4d9"/><path d="M-10-3-18-10-15 0" fill="#eee4c5"/><circle cx="10" cy="-12" r="8" fill="#fff8e4"/><path d="m16-13 9 3-9 3Z" fill="#d8a34d"/><circle cx="12" cy="-14" r="1.4" fill="#4e6359"/><path d="M-6-1q8-7 12 2" stroke="#dfd4b5" stroke-width="2" fill="none"/></g>`;
}
export function portrait(index, color) {
  const hair = ['#5f4c42', '#55584b', '#686355', '#675243'][index];
  const skin = ['#e4b391', '#d4a47e', '#e6be9a', '#c99776'][index];
  return wrap(
    `<circle cx="40" cy="40" r="39" fill="${color}" opacity=".18"/><path d="M12 80q0-32 28-32t28 32" fill="${color}"/><ellipse cx="40" cy="32" rx="21" ry="23" fill="${hair}"/><path d="M23 28q17-23 34 0v17q-17 23-34 0Z" fill="${skin}"/><path d="M20 28q-1-26 23-23 23 2 19 27-10-2-16-14-7 14-26 10" fill="${hair}"/><circle cx="32" cy="34" r="1.5" fill="#50463b"/><circle cx="49" cy="34" r="1.5" fill="#50463b"/><path d="M36 46q5 4 9-1" fill="none" stroke="#a47460" stroke-width="1.5" stroke-linecap="round"/>${index === 1 ? '<path d="M12 20q28-12 56 0l-6-6H19Z" fill="#d3be89"/><path d="M24 15 28 2h24l7 13" fill="#e1cb96"/>' : ''}${index === 2 ? '<path d="M51 10q15-12 20 3-2 13-14 10" fill="#686355"/>' : ''}`
  );
}

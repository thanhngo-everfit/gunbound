// Loads the painted art (Gamma-generated) and cuts xe sprites out of their flat magenta/green backgrounds.
import { XE_LIST } from '/shared/xe.js';
import { MAP_IDS, registerMask } from '/shared/physics.js';
import { parseLook, ITEMS } from '/shared/outfits.js';

const GREEN_BG = new Set(['bachtuoc', 'tethien', 'phuong']);
const PILOT_GREEN = { m: false, f: true };

// Saddle point on each rider-less sprite, as fractions of its trimmed box (image faces right),
// and the pilot's height relative to the animal.
export const SEATS = {
  rong: [0.5, 0.5, 0.5], kylan: [0.4, 0.5, 0.5], kimquy: [0.28, 0.16, 0.44], phuong: [0.48, 0.38, 0.42],
  voi: [0.47, 0.44, 0.42], bachtuoc: [0.74, 0.36, 0.42], bocap: [0.47, 0.45, 0.42], cu: [0.5, 0.16, 0.44],
  camap: [0.44, 0.26, 0.52], tethien: [0.3, 0.37, 0.4],
  gau: [0.38, 0.36, 0.5], canhcut: [0.36, 0.2, 0.55], tho: [0.43, 0.5, 0.44],
};

export const ASSETS = { xe: {}, pilot: {}, bg: {}, proj: {}, terrain: {}, icons: {}, outfit: { h: {}, g: {}, s: {} }, ready: false };
const composites = new Map();
export const resetComposites = () => composites.clear();
// Pilot layering (user feedback 2026-10-01: arms and legs pasted over the animal looked clumsy).
// 'behind' draws the pilot BEHIND the animal, so the saddle, basket or tower hides the hips and legs and
// only the upper body shows, like Gunbound's riders sitting inside their mobile.
export const SEAT_BEHIND = new Set();
// OCCLUDE: the part of the animal drawn IN FRONT of the pilot (its back, saddle, basket rim, tower wall), as
// a polygon in animal-image fractions. The pilot's hips and legs sink behind it, so rider and animal read as
// one piece, while cannons and crossbows above stay behind the pilot.
export const OCCLUDE = {
  rong: [[0.3, 0.52], [0.68, 0.52], [0.68, 0.88], [0.3, 0.88]],
  kylan: [[0.26, 0.49], [0.56, 0.49], [0.56, 0.72], [0.26, 0.72]],
  kimquy: [[0.1, 0.17], [0.62, 0.14], [0.62, 0.26], [0.1, 0.3]],
  phuong: [[0.38, 0.38], [0.62, 0.38], [0.62, 0.62], [0.38, 0.62]],
  voi: [[0.22, 0.46], [0.64, 0.46], [0.64, 0.78], [0.22, 0.78]],
  bachtuoc: [[0.6, 0.32], [0.98, 0.3], [0.98, 0.52], [0.6, 0.56]],
  bocap: [[0.26, 0.42], [0.56, 0.42], [0.56, 0.52], [0.26, 0.52]],
  cu: [[0.46, 0.16], [0.72, 0.16], [0.72, 0.48], [0.46, 0.48]],
  camap: [[0.3, 0.27], [0.62, 0.27], [0.62, 0.52], [0.3, 0.52]],
  // Hầu Ca carries the pilot piggyback: its back and shoulder hide the pilot's legs
  tethien: [[0.28, 0.37], [0.48, 0.37], [0.5, 0.62], [0.28, 0.62]],
  gau: [[0.22, 0.44], [0.62, 0.44], [0.62, 0.78], [0.22, 0.78]],
  canhcut: [[0.2, 0.2], [0.62, 0.2], [0.62, 0.6], [0.2, 0.6]],
  tho: [[0.36, 0.52], [0.8, 0.52], [0.8, 0.8], [0.36, 0.8]],
};
const occPath = (xe, x0, y0, w, h) => {
  const poly = OCCLUDE[xe];
  if (!poly) return null;
  const p = new Path2D();
  poly.forEach(([x, y], i) => (i ? p.lineTo(x0 + x * w, y0 + y * h) : p.moveTo(x0 + x * w, y0 + y * h)));
  p.closePath();
  return p;
};
export { occPath };

const loadImg = src => new Promise(res => {
  const img = new Image();
  img.onload = () => res(img);
  img.onerror = () => res(null);
  img.src = src;
});

// How strongly a pixel looks like the key color (0..255).
const keyness = (r, g, b, green) => (green ? g - Math.max(r, b) : Math.min(r, b) - g);

// Flood-fill the background from the image border so pink/purple details inside the sprite survive,
// then soften the one-pixel fringe and trim to the sprite's bounding box.
function cutOut(img, green, trim = true, holes = false) {
  const w = img.width, h = img.height;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, w, h);
  const d = data.data;
  const bg = new Uint8Array(w * h);
  const isKey = i => keyness(d[i * 4], d[i * 4 + 1], d[i * 4 + 2], green) > 70;
  const stack = [];
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
  while (stack.length) {
    const i = stack.pop();
    if (bg[i] || !isKey(i)) continue;
    bg[i] = 1;
    const x = i % w, y = (i / w) | 0;
    if (x > 0) stack.push(i - 1);
    if (x < w - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - w);
    if (y < h - 1) stack.push(i + w);
  }
  // sheets with no pink subjects can also key enclosed pockets (trophy handles, hammer gaps)
  if (holes) for (let i = 0; i < w * h; i++) if (!bg[i] && keyness(d[i * 4], d[i * 4 + 1], d[i * 4 + 2], green) > 140) bg[i] = 1;
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x, o = i * 4;
      if (bg[i]) { d[o + 3] = 0; continue; }
      const edge = (x > 0 && bg[i - 1]) || (x < w - 1 && bg[i + 1]) || (y > 0 && bg[i - w]) || (y < h - 1 && bg[i + w]);
      if (edge) {
        const k = Math.max(0, Math.min(1, keyness(d[o], d[o + 1], d[o + 2], green) / 90));
        d[o + 3] = 255 * (1 - k * 0.85);
        const dark = 1 - k * 0.8;
        d[o] *= dark; d[o + 1] *= dark; d[o + 2] *= dark;
      }
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  ctx.putImageData(data, 0, 0);
  if (!trim) return c;
  const out = document.createElement('canvas');
  out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
  out.getContext('2d').drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

// Split a cut-out sprite sheet into its separate figures, ordered row by row, left to right.
// Works on a coarse block grid; small loose bits (sparks, drops) join the nearest big figure.
function sliceSheet(sheet, count, rows) {
  const B = 4;
  const gw = Math.ceil(sheet.width / B), gh = Math.ceil(sheet.height / B);
  const alpha = sheet.getContext('2d').getImageData(0, 0, sheet.width, sheet.height).data;
  const occ = new Uint8Array(gw * gh);
  for (let y = 0; y < sheet.height; y += 2) {
    for (let x = 0; x < sheet.width; x += 2) {
      if (alpha[(y * sheet.width + x) * 4 + 3] > 60) occ[((y / B) | 0) * gw + ((x / B) | 0)] = 1;
    }
  }
  const label = new Int32Array(gw * gh).fill(-1);
  const comps = [];
  for (let i = 0; i < occ.length; i++) {
    if (!occ[i] || label[i] >= 0) continue;
    const c = { x0: 1e9, y0: 1e9, x1: -1, y1: -1, n: 0 };
    const stack = [i];
    label[i] = comps.length;
    while (stack.length) {
      const j = stack.pop();
      const x = j % gw, y = (j / gw) | 0;
      c.n++; c.x0 = Math.min(c.x0, x); c.x1 = Math.max(c.x1, x); c.y0 = Math.min(c.y0, y); c.y1 = Math.max(c.y1, y);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
        const k = ny * gw + nx;
        if (occ[k] && label[k] < 0) { label[k] = comps.length; stack.push(k); }
      }
    }
    comps.push(c);
  }
  comps.sort((a, b) => b.n - a.n);
  const big = comps.slice(0, count), small = comps.slice(count);
  const cx = c => (c.x0 + c.x1) / 2, cy = c => (c.y0 + c.y1) / 2;
  // distance from a point to a figure's box (0 when inside)
  const gap = (c, x, y) => Math.hypot(Math.max(c.x0 - x, 0, x - c.x1), Math.max(c.y0 - y, 0, y - c.y1));
  for (const sm of small) {
    if (sm.n < 3) continue;
    const near = big.reduce((a, b) => (gap(b, cx(sm), cy(sm)) < gap(a, cx(sm), cy(sm)) ? b : a));
    if (gap(near, cx(sm), cy(sm)) > 12) continue;
    near.x0 = Math.min(near.x0, sm.x0); near.x1 = Math.max(near.x1, sm.x1);
    near.y0 = Math.min(near.y0, sm.y0); near.y1 = Math.max(near.y1, sm.y1);
  }
  big.sort((a, b) => cy(a) - cy(b));
  const perRow = Math.ceil(count / rows);
  const ordered = [];
  for (let r = 0; r < rows; r++) ordered.push(...big.slice(r * perRow, (r + 1) * perRow).sort((a, b) => cx(a) - cx(b)));
  return ordered.map(c => {
    const x0 = Math.max(0, c.x0 * B - 2), y0 = Math.max(0, c.y0 * B - 2);
    const w = Math.min(sheet.width, (c.x1 + 1) * B + 2) - x0, h = Math.min(sheet.height, (c.y1 + 1) * B + 2) - y0;
    const out = document.createElement('canvas');
    out.width = w; out.height = h;
    out.getContext('2d').drawImage(sheet, x0, y0, w, h, 0, 0, w, h);
    return out;
  });
}

// Sprite sheets (one Gamma image per set, so the style matches). Individual files are the fallback.
// Redesign 2026-10-01 (user: redo the first 10 "như 3 xe mới"): anime, one weapon themed to each xe's mechanic,
// everything facing right, a saddle seat, no treads. Two banner sheets of 5, boxes on a 1400x781 view.
const XE_SHEETS = [
  { src: '/assets/sheets/xe4.jpg', green: false, view: [1400, 781], holes: true, order: ['rong', 'kylan', 'kimquy', 'bocap', 'camap'],
    boxes: { rong: [28, 32, 488, 382], kylan: [532, 38, 932, 378], kimquy: [952, 88, 1368, 380], bocap: [516, 418, 872, 718], camap: [932, 455, 1362, 722] },
    // the sheet drew an extra armoured beast left of the scorpion; its edge pokes into the box
    erase: { bocap: [[516, 558, 531, 720]] }, despill: ['kimquy'] },
  { src: '/assets/sheets/xe5.jpg', green: true, view: [1400, 781], holes: true, order: ['phuong', 'voi', 'bachtuoc', 'cu', 'tethien'],
    boxes: { phuong: [48, 38, 502, 422], voi: [492, 12, 938, 422], bachtuoc: [902, 76, 1372, 412], cu: [98, 448, 594, 752], tethien: [646, 412, 1104, 758] },
    erase: { tethien: [[646, 412, 730, 428]], phuong: [[486, 300, 502, 422]], voi: [[492, 12, 506, 220], [890, 240, 938, 422], [792, 411, 938, 422]], bachtuoc: [[902, 76, 940, 210]] } },
];
const PILOT_SHEET = { src: '/assets/sheets/pilot.jpg', rows: 1, order: ['m', 'f', 'm2', 'f2'] };

// Crop one figure out of a cut-out sheet and trim it to its visible pixels.
function cropBox(sheet, [x0, y0, x1, y1], erase = [], [vw, vh]) {
  const sx = sheet.width / vw, sy = sheet.height / vh;
  const w = Math.round((x1 - x0) * sx), h = Math.round((y1 - y0) * sy);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(sheet, Math.round(x0 * sx), Math.round(y0 * sy), w, h, 0, 0, w, h);
  for (const [ex0, ey0, ex1, ey1] of erase) ctx.clearRect((ex0 - x0) * sx, (ey0 - y0) * sy, (ex1 - ex0) * sx, (ey1 - ey0) * sy);
  const d = ctx.getImageData(0, 0, w, h).data;
  let tx0 = w, ty0 = h, tx1 = 0, ty1 = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (d[(y * w + x) * 4 + 3] > 40) { if (x < tx0) tx0 = x; if (x > tx1) tx1 = x; if (y < ty0) ty0 = y; if (y > ty1) ty1 = y; }
  }
  const out = document.createElement('canvas');
  out.width = tx1 - tx0 + 1; out.height = ty1 - ty0 + 1;
  out.getContext('2d').drawImage(c, tx0, ty0, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

// Projectile sheets: one row per xe, columns Shot 1 / Shot 2 / SS.
// Redesign 2026-10-01: one portrait sheet per 5 xe, a 3x5 grid (row = xe, columns S1 / S2 / SS), cells on a 1536x2752 view.
const PROJ_GRIDS = [
  { src: '/assets/sheets/proj-f.jpg', green: false, xe: ['rong', 'kylan', 'kimquy', 'bocap', 'camap'] },
  { src: '/assets/sheets/proj-g.jpg', green: true, xe: ['phuong', 'voi', 'bachtuoc', 'cu', 'tethien'] },
];

// UI icons (items, gold). Gamma drew English captions under each icon despite the prompt,
// so the boxes stop above the captions.
const ICON_SHEET = { src: '/assets/sheets/icons.jpg', view: [1000, 558], boxes: {
  dual: [20, 55, 190, 215], tele: [220, 50, 385, 220], heal: [430, 50, 585, 215], power: [610, 50, 785, 215], gold: [812, 50, 975, 212],
} };
const iconUrls = {};
// data: URL for an icon, usable in <img>; empty string until the sheet has loaded
export function iconUrl(name) {
  if (iconUrls[name]) return iconUrls[name];
  const c = ASSETS.icons[name];
  if (!c) return '';
  const out = document.createElement('canvas');
  const k = 96 / Math.max(c.width, c.height);
  out.width = Math.round(c.width * k); out.height = Math.round(c.height * k);
  drawSmooth(out.getContext('2d'), c, 0, 0, out.width, out.height);
  return (iconUrls[name] = out.toDataURL('image/png'));
}

// Rank art: one Gamma sheet of 16 objects on a 4x4 grid (ranks.jpg). The badge is built in code: a round
// medallion in the tier's colours with the object on it, and "Đôi" ranks show two copies crossed, like Gunbound.
const RANK_SHEET = { src: '/assets/sheets/ranks.jpg', cells: [
  'chick', 'wood', 'stone', 'iron', 'silver', 'gold', 'violet', 'sapphire', 'ruby', 'diamond', 'dragonB', 'dragonR', 'dragonW', 'random', 'trophy', 'crown'] };
// rank id → [object, double?, glow, ring]. Dark navy medallion like Gunbound M, so every object reads,
// with a glow and ring in the tier's colour.
const RANK_STYLE = {
  chick: ['chick', 0, '#ffe07a', '#f3b93a'],
  wood: ['wood', 0, '#e0a868', '#b98347'], wood2: ['wood', 1, '#e0a868', '#b98347'],
  stone: ['stone', 0, '#c4ccd8', '#8f97a3'], stone2: ['stone', 1, '#c4ccd8', '#8f97a3'],
  iron: ['iron', 0, '#8fa4c4', '#6b7c96'], iron2: ['iron', 1, '#8fa4c4', '#6b7c96'],
  silver: ['silver', 0, '#e8f0ff', '#b8c8e0'], silver2: ['silver', 1, '#e8f0ff', '#b8c8e0'],
  gold: ['gold', 0, '#ffe46a', '#f0b81c'], gold2: ['gold', 1, '#ffe46a', '#f0b81c'],
  violet: ['violet', 0, '#c890ff', '#9a55e0'], sapphire: ['sapphire', 0, '#7ab4ff', '#3f7fe0'],
  ruby: ['ruby', 0, '#ff7a8e', '#e0405a'], diamond: ['diamond', 0, '#b8f6ff', '#7fe0f0'],
  dragonB: ['dragonB', 0, '#5a9cff', '#f0b81c'], dragonR: ['dragonR', 0, '#ff6a50', '#f0b81c'], dragonW: ['dragonW', 0, '#ffffff', '#f0b81c'],
};
export function rankBadge(canvas, rankId) {
  const [obj, dbl, glow, ring] = RANK_STYLE[rankId] || RANK_STYLE.chick;
  const c = canvas.getContext('2d'), S = canvas.width, r = S / 2;
  c.clearRect(0, 0, S, S);
  const g = c.createRadialGradient(r, r * 0.9, r * 0.05, r, r, r * 0.9);
  g.addColorStop(0, glow); g.addColorStop(0.45, '#23407e'); g.addColorStop(1, '#0d1f47');
  c.beginPath(); c.arc(r, r, r * 0.9, 0, Math.PI * 2);
  c.fillStyle = g; c.fill();
  c.lineWidth = S * 0.08; c.strokeStyle = ring; c.stroke();
  c.lineWidth = S * 0.035; c.strokeStyle = '#0b1633';
  c.beginPath(); c.arc(r, r, r * 0.97, 0, Math.PI * 2); c.stroke();
  c.beginPath(); c.arc(r, r, r * 0.82, 0, Math.PI * 2); c.stroke();
  const img = ASSETS.icons['r-' + obj];
  if (!img) return;
  const k = (S * (dbl ? 0.6 : 0.74)) / Math.max(img.width, img.height), w = img.width * k, h = img.height * k;
  if (dbl) {
    // two copies crossed in an X: heads apart at the top corners, handles crossing below
    c.save(); c.translate(r + S * 0.1, r - S * 0.02); drawSmooth(c, img, -w / 2, -h / 2, w, h); c.restore();
    c.save(); c.translate(r - S * 0.1, r - S * 0.02); c.scale(-1, 1); drawSmooth(c, img, -w / 2, -h / 2, w, h); c.restore();
  } else drawSmooth(c, img, r - w / 2, r - h / 2, w, h);
}
const rankUrls = {};
export function rankIcon(rankId) {
  if (rankUrls[rankId]) return rankUrls[rankId];
  if (!ASSETS.icons['r-chick']) return '';
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  rankBadge(cv, rankId);
  return (rankUrls[rankId] = cv.toDataURL('image/png'));
}

// Weather icons (round badges): w-clear, w-tornado, w-thunder, plus spares for future weathers.
const WEATHER_SHEET = { src: '/assets/sheets/weather.jpg', view: [1000, 558], boxes: {
  'w-clear': [25, 35, 250, 265], 'w-tornado': [268, 35, 492, 265], 'w-thunder': [510, 35, 735, 265],
  'w-blackhole': [752, 35, 978, 265], 'w-moon': [268, 292, 492, 522], 'w-force': [510, 292, 735, 522],
} };

async function loadIcons() {
  await Promise.all([ICON_SHEET, WEATHER_SHEET].map(async sh => {
    const img = await loadImg(sh.src);
    if (!img) return;
    const sheet = cutOut(img, false, false);
    for (const [id, box] of Object.entries(sh.boxes)) ASSETS.icons[id] = cropBox(sheet, box, [], sh.view);
  }));
  const img = await loadImg(RANK_SHEET.src);
  if (img) {
    const sheet = cutOut(img, false, false, true), n = 4;
    RANK_SHEET.cells.forEach((id, i) => {
      const cx = i % n, cy = Math.floor(i / n), cw = 1000 / n;
      ASSETS.icons['r-' + id] = cropBox(sheet, [cx * cw + 6, cy * cw + 6, (cx + 1) * cw - 6, (cy + 1) * cw - 6], [], [1000, 1000]);
    });
  }
}

// Gấu Bắc Cực, Chim Cánh Cụt, Thỏ Ngọc (one Gamma sheet on green). Boxes skip the "(1)(2)(3)" captions.
const XE2_SHEET = { src: '/assets/sheets/xe2.jpg', view: [1400, 781], order: ['gau', 'canhcut', 'tho'], flip: ['canhcut'], holes: true,
  boxes: { gau: [30, 92, 480, 690], canhcut: [492, 250, 930, 645], tho: [935, 112, 1360, 648] },
  erase: { gau: [[40, 80, 115, 132]], canhcut: [[575, 205, 645, 258]], tho: [[985, 80, 1065, 132]] } };
// User feedback 2026-10-01: the first bear and rabbit looked left (sled front and face) while their cannons
// pointed right. Both were redrawn facing right on xe3.jpg (rabbit version A: crouching on the moon with a
// saddle on its back). Its captions sit below the boxes.
const XE3_SHEET = { src: '/assets/sheets/xe3.jpg', view: [1400, 781], order: ['tho', 'gau'], holes: true,
  boxes: { tho: [30, 150, 495, 565], gau: [955, 125, 1372, 600] } };
const mirror = c => { const m = document.createElement('canvas'); m.width = c.width; m.height = c.height; const x = m.getContext('2d'); x.translate(c.width, 0); x.scale(-1, 1); x.drawImage(c, 0, 0); return m; };

// Graphics review 2026-10-01: sprites that didn't match their shot were redrawn on two grid sheets.
// cells: [xe, shot] replaces that shot's sprite now; a plain string is kept in ASSETS.projNew for the
// redesigned shots that aren't wired up yet.
const PROJ_FIXES = [
  { src: '/assets/sheets/proj-e.jpg', green: false, n: 3, cells: [
    ['gau', 's1'], ['gau', 's2'], ['gau', 'ss'], // snowball, ice cube, blizzard orb
    ['canhcut', 's1'], ['canhcut', 's2'], ['canhcut', 'ss'], // frozen fish, belly-sliding penguin, ice billiard ball
    ['tho', 's1'], ['tho', 's2'], ['tho', 'ss']] }, // mochi, jade pestle, full moon
  // Bọ Cạp S1 keeps the venom stinger: the new sheet drew whole scorpions for both S1 and SS
  { src: '/assets/sheets/proj-d.jpg', green: false, n: 2, cells: [['bocap', 's1'], null, null, null] },
];
// bronze copy of a sprite (Kim Quy's Tên Đồng reuses the golden Vạn Tiễn arrow; the sheet drew S1 with its bow)
function bronze(src) {
  const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
  const x = c.getContext('2d'); x.filter = 'sepia(0.7) saturate(1.3) hue-rotate(-12deg) brightness(0.85)'; x.drawImage(src, 0, 0);
  return c;
}

async function loadProjectiles() {
  await Promise.all(PROJ_GRIDS.map(async sh => {
    const img = await loadImg(sh.src);
    if (!img) return;
    const sheet = cutOut(img, sh.green, false, true), cw = 1536 / 3, ch = 2752 / 5, m = 16;
    sh.xe.forEach((id, r) => {
      const cell = c => cropBox(sheet, [c * cw + m, r * ch + m, (c + 1) * cw - m, (r + 1) * ch - m], [], [1536, 2752]);
      ASSETS.proj[id] = { s1: cell(0), s2: cell(1), ss: cell(2) };
    });
  }));
  ASSETS.projNew = {};
  if (ASSETS.proj.kimquy) { ASSETS.proj.kimquy.s1 = bronze(ASSETS.proj.kimquy.ss); unPink(ASSETS.proj.kimquy.s2); }
  await Promise.all(PROJ_FIXES.map(async sh => {
    const img = await loadImg(sh.src);
    if (!img) return;
    const sheet = cutOut(img, sh.green, false, true), cw = 1000 / sh.n;
    sh.cells.forEach((cell, i) => {
      if (!cell) return;
      const cx = i % sh.n, cy = Math.floor(i / sh.n);
      const m = 18, sprite = cropBox(sheet, [cx * cw + m, cy * cw + m, (cx + 1) * cw - m, (cy + 1) * cw - m], [], [1000, 1000]);
      if (Array.isArray(cell)) { const [xe, shot] = cell; (ASSETS.proj[xe] ||= {})[shot] = sprite; }
      else ASSETS.projNew[cell] = sprite;
    });
  }));
}

async function loadSheet({ src, rows, order, boxes, erase = {}, view, holes = false, green: g = null, despill = [] }, green = false) {
  if (g !== null) green = g;
  const img = await loadImg(src);
  if (!img) return null;
  const sheet = cutOut(img, green, false, holes);
  if (boxes) return Object.fromEntries(order.map(id => [id, (despill.includes(id) ? unPink : c => c)(cropBox(sheet, boxes[id], erase[id], view))]));
  const parts = sliceSheet(sheet, order.length, rows);
  return Object.fromEntries(order.map((id, i) => [id, parts[i]]));
}

// Kim Quy's pink hexagon shield glow only half-keyed on the magenta sheet: fade out magenta-tinted pixels
function unPink(c) {
  const x = c.getContext('2d', { willReadFrequently: true }), im = x.getImageData(0, 0, c.width, c.height), d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2], pink = Math.min(r, b) - g;
    if (pink > 12 && b > 80) d[i + 3] = Math.round(d[i + 3] * Math.max(0, 1 - (pink - 12) / 22));
  }
  x.putImageData(im, 0, 0);
  return c;
}

// Halve repeatedly so big sprites shrink cleanly (one big downscale aliases badly).
export function mips(src) {
  const levels = [src];
  let cur = src;
  while (cur.height > 48) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(cur.width / 2)); c.height = Math.max(1, Math.round(cur.height / 2));
    const x = c.getContext('2d');
    x.imageSmoothingQuality = 'high';
    x.drawImage(cur, 0, 0, c.width, c.height);
    levels.push(c);
    cur = c;
  }
  return levels;
}

// Draw a sprite with its mip chain, picking the smallest level still at least as big as the device pixels needed.
export function drawSmooth(ctx, img, x, y, w, h) {
  const levels = img.mips || (img.mips = mips(img));
  const t = ctx.getTransform();
  const need = h * Math.hypot(t.a, t.b);
  let lv = levels[0];
  for (const l of levels) if (l.height >= need) lv = l;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(lv, x, y, w, h);
}

// ---------- trang phục (outfits) ----------
// Items from outfits.jpg (5 columns × 3 rows: hats, glasses, tops) are fitted to each base pilot with anchors
// measured on the pilot sprites (fractions of the pilot image, facing right):
//   hat: brim line (y), centre and width · glasses: eye-line centre and width · top: torso box
//   arms: the reaching arms, redrawn over a top so the vest sits under the sleeves like real clothes
const PILOT_FIT = {
  m: { hat: [0.56, 0.27, 0.86], eyes: [0.68, 0.41, 0.5], top: [0.27, 0.55, 0.72, 0.84],
    arms: [[0.44, 0.57], [0.62, 0.57], [0.9, 0.6], [0.99, 0.62], [0.99, 0.74], [0.8, 0.76], [0.62, 0.75], [0.5, 0.72], [0.44, 0.66]] },
  f: { hat: [0.55, 0.28, 0.86], eyes: [0.67, 0.43, 0.48], top: [0.27, 0.56, 0.72, 0.84],
    arms: [[0.44, 0.58], [0.62, 0.58], [0.9, 0.6], [0.99, 0.62], [0.99, 0.74], [0.8, 0.76], [0.62, 0.75], [0.5, 0.72], [0.44, 0.66]] },
  m2: { hat: [0.6, 0.25, 0.88], eyes: [0.64, 0.42, 0.56], top: [0.26, 0.54, 0.7, 0.82],
    arms: [[0.42, 0.57], [0.6, 0.6], [0.85, 0.6], [0.99, 0.62], [0.99, 0.73], [0.6, 0.74], [0.48, 0.72], [0.42, 0.66]] },
  f2: { hat: [0.6, 0.28, 0.7], eyes: [0.63, 0.42, 0.44], top: [0.36, 0.56, 0.74, 0.82],
    arms: [[0.5, 0.58], [0.7, 0.6], [0.98, 0.6], [0.98, 0.72], [0.72, 0.73], [0.55, 0.72], [0.5, 0.66]] },
};
// per item: where its own "sits here" line is, as a fraction of the sprite height (the non lá's straps hang below its brim),
// and tops worn behind the body (the cape)
// the nón lá's chin ribbon is cut off (it crossed the face); its brim is the bottom of what's left
const HAT_BASE = {}, HAT_BASE_DEFAULT = 0.9, HAT_CROP = { 1: 0.6 };
const TOP_BEHIND = new Set([2]);
const OUTFIT_SHEET = { src: '/assets/sheets/outfits.jpg', green: true, cols: 5, rows: 3, slots: ['h', 'g', 's'] };

async function loadOutfits() {
  const img = await loadImg(OUTFIT_SHEET.src);
  if (!img) return;
  const sheet = cutOut(img, OUTFIT_SHEET.green, false, true), cw = 1000 / OUTFIT_SHEET.cols, ch = 1000 / OUTFIT_SHEET.rows, m = 10;
  OUTFIT_SHEET.slots.forEach((slot, r) => ITEMS[slot].forEach(it => {
    const c = it.n - 1;
    let img = cropBox(sheet, [c * cw + m, r * ch + m, (c + 1) * cw - m, (r + 1) * ch - m], [], [1000, 1000]);
    const keep = slot === 'h' && HAT_CROP[it.n];
    if (keep) { const k = document.createElement('canvas'); k.width = img.width; k.height = Math.round(img.height * keep); k.getContext('2d').drawImage(img, 0, 0); img = k; }
    ASSETS.outfit[slot][it.n] = img;
  }));
}

// The base pilot wearing the items in a look string ("f2.h3.g1"). The canvas is padded for hats and capes;
// baseW/baseH and padL/padT say where the pilot itself sits so riders stay the same size.
const dressed = new Map();
export function pilotImage(look) {
  const L = parseLook(look), base = ASSETS.pilot[L.pilot] || ASSETS.pilot.m;
  if (!base || (!L.h && !L.g && !L.s)) return base;
  const key = look;
  if (dressed.has(key)) return dressed.get(key);
  const fit = PILOT_FIT[L.pilot] || PILOT_FIT.m, W = base.width, H = base.height;
  const padT = Math.round(H * 0.4), padL = Math.round(W * 0.2), padR = Math.round(W * 0.1);
  const c = document.createElement('canvas');
  c.width = W + padL + padR; c.height = H + padT;
  const x = c.getContext('2d');
  const at = (img, cx, cy, w, baseFrac = 0.5) => { const h = (img.height / img.width) * w; x.drawImage(img, padL + cx - w / 2, padT + cy - h * baseFrac, w, h); };
  const top = L.s && ASSETS.outfit.s[L.s], hat = L.h && ASSETS.outfit.h[L.h], glasses = L.g && ASSETS.outfit.g[L.g];
  const [tx0, ty0, tx1, ty1] = fit.top;
  // a cape hangs behind the back, from the shoulders
  if (top && TOP_BEHIND.has(L.s)) { const w = (tx1 - tx0) * W * 1.15; at(top, tx0 * W + w * 0.12, ty0 * H - w * 0.08, w, 0); }
  x.drawImage(base, padL, padT);
  if (top && !TOP_BEHIND.has(L.s)) {
    const w = (tx1 - tx0) * W, h = (ty1 - ty0) * H;
    x.drawImage(top, padL + tx0 * W, padT + ty0 * H, w, h);
    // the sleeves go back on top of the vest
    x.save(); x.beginPath();
    fit.arms.forEach(([ax, ay], i) => (i ? x.lineTo : x.moveTo).call(x, padL + ax * W, padT + ay * H));
    x.closePath(); x.clip(); x.drawImage(base, padL, padT); x.restore();
  }
  if (glasses) at(glasses, fit.eyes[0] * W, fit.eyes[1] * H, fit.eyes[2] * W);
  if (hat) at(hat, fit.hat[0] * W, fit.hat[1] * H, fit.hat[2] * W, HAT_BASE[L.h] ?? HAT_BASE_DEFAULT);
  Object.assign(c, { baseW: W, baseH: H, padL, padT });
  dressed.set(key, c);
  return c;
}

// Animal + pilot merged into one canvas. animalH lets callers size by the animal, not the rider.
export function xeSprite(xe, gender = 'm') {
  const animal = ASSETS.xe[xe];
  if (!animal) return null;
  const pilot = gender === null ? null : pilotImage(gender);
  const seat = SEATS[xe];
  if (!pilot || !seat) return Object.assign(animal, { animalH: animal.height, footY: animal.height, ax: 0, ay: 0, pilotRect: null });

  const key = xe + gender;
  if (composites.has(key)) return composites.get(key);
  // size and seat by the bare pilot; a dressed pilot's canvas is just padded around it
  const bw = pilot.baseW || pilot.width, bh = pilot.baseH || pilot.height, k = (animal.height * seat[2]) / bh;
  const px = animal.width * seat[0] - bw * k * 0.42 - (pilot.padL || 0) * k, py = animal.height * seat[1] - bh * k * 0.8 - (pilot.padT || 0) * k;
  const pw = pilot.width * k, ph = pilot.height * k;
  const top = Math.min(0, py), left = Math.min(0, px), right = Math.max(animal.width, px + pw);
  const c = document.createElement('canvas');
  c.width = Math.ceil(right - left); c.height = Math.ceil(animal.height - top);
  const ctx = c.getContext('2d');
  if (SEAT_BEHIND.has(xe)) { ctx.drawImage(pilot, px - left, py - top, pw, ph); ctx.drawImage(animal, -left, -top); }
  else {
    ctx.drawImage(animal, -left, -top);
    ctx.drawImage(pilot, px - left, py - top, pw, ph);
    const occ = occPath(xe, -left, -top, animal.width, animal.height);
    if (occ) { ctx.save(); ctx.clip(occ); ctx.drawImage(animal, -left, -top); ctx.restore(); }
  }
  c.behind = SEAT_BEHIND.has(xe);
  c.animalH = animal.height;
  c.footY = c.height;
  // where the animal and the pilot sit inside the composite, so a rigged animal can be redrawn under the pilot
  c.ax = -left; c.ay = -top; c.pilot = pilot; c.pilotRect = [px - left, py - top, pw, ph];
  composites.set(key, c);
  return c;
}

// ---------- rigs: moving body parts cut out of the one-image animal sprites ----------
// Each part is a polygon on the animal image (fractions, facing right) that turns around a pivot.
// The part is erased from the base picture and the hole is painted `hole` (e.g. the inside of the mouth),
// so when the jaw opens you see a mouth, not a second jaw.
// Measured on the 2026-10-01 redesign sheets (xe4/xe5), in fractions of each trimmed sprite.
export const RIGS = {
  rong: [
    { name: 'wing', pivot: [0.45, 0.52], hole: '#a8323a', poly: [[0.195, 0.585], [0.26, 0.53], [0.33, 0.5], [0.41, 0.47], [0.46, 0.48], [0.47, 0.56], [0.45, 0.63], [0.4, 0.645], [0.34, 0.655], [0.29, 0.62], [0.24, 0.6]] },
    { name: 'tail', pivot: [0.33, 0.72], poly: [[0.02, 0.45], [0.06, 0.33], [0.11, 0.3], [0.16, 0.4], [0.15, 0.5], [0.13, 0.58], [0.18, 0.64], [0.28, 0.65], [0.33, 0.66], [0.34, 0.78], [0.26, 0.78], [0.16, 0.74], [0.1, 0.66], [0.07, 0.55], [0.03, 0.5]] },
    { name: 'jaw', pivot: [0.77, 0.56], hole: '#6a0f08', poly: [[0.76, 0.54], [0.8, 0.56], [0.85, 0.555], [0.89, 0.56], [0.9, 0.6], [0.88, 0.645], [0.84, 0.675], [0.79, 0.67], [0.75, 0.63], [0.74, 0.58]] },
  ],
  kylan: [{ name: 'tail', pivot: [0.28, 0.46], poly: [[0.28, 0.42], [0.22, 0.3], [0.12, 0.23], [0.04, 0.27], [0.03, 0.38], [0.08, 0.5], [0.15, 0.57], [0.24, 0.55], [0.28, 0.5]] }],
  kimquy: [{ name: 'head', pivot: [0.75, 0.58], poly: [[0.74, 0.42], [0.82, 0.34], [0.92, 0.36], [0.96, 0.48], [0.94, 0.62], [0.86, 0.72], [0.78, 0.7], [0.73, 0.6]] }],
  phuong: [
    { name: 'wingL', pivot: [0.47, 0.5], poly: [[0.47, 0.52], [0.4, 0.35], [0.32, 0.18], [0.16, 0.03], [0.09, 0.15], [0.1, 0.3], [0.2, 0.45], [0.3, 0.58], [0.4, 0.62], [0.47, 0.6]] },
    { name: 'wingR', pivot: [0.66, 0.5], poly: [[0.64, 0.52], [0.7, 0.3], [0.78, 0.15], [0.97, 0.02], [0.98, 0.3], [0.92, 0.45], [0.82, 0.56], [0.72, 0.6], [0.65, 0.58]] },
  ],
  voi: [{ name: 'trunk', pivot: [0.7, 0.63], poly: [[0.68, 0.6], [0.72, 0.59], [0.74, 0.52], [0.77, 0.44], [0.8, 0.4], [0.84, 0.37], [0.9, 0.33], [0.95, 0.31], [0.995, 0.33], [0.995, 0.37], [0.93, 0.39], [0.87, 0.42], [0.84, 0.46], [0.81, 0.53], [0.8, 0.6], [0.77, 0.66], [0.72, 0.69], [0.68, 0.68]] }],
  bocap: [{ name: 'tail', pivot: [0.17, 0.45], poly: [[0.19, 0.46], [0.12, 0.42], [0.07, 0.34], [0.04, 0.24], [0.05, 0.14], [0.1, 0.06], [0.18, 0.02], [0.27, 0.02], [0.33, 0.05], [0.4, 0.07], [0.44, 0.14], [0.5, 0.2], [0.44, 0.27], [0.36, 0.27], [0.3, 0.2], [0.26, 0.14], [0.2, 0.1], [0.14, 0.13], [0.11, 0.2], [0.13, 0.3], [0.17, 0.37], [0.22, 0.4]] }],
  cu: [
    { name: 'wingL', pivot: [0.42, 0.45], poly: [[0.44, 0.52], [0.38, 0.34], [0.3, 0.24], [0.18, 0.1], [0.01, 0.0], [0.0, 0.18], [0.02, 0.32], [0.06, 0.44], [0.14, 0.53], [0.24, 0.6], [0.34, 0.63], [0.42, 0.62]] },
    { name: 'wingR', pivot: [0.68, 0.45], poly: [[0.66, 0.5], [0.7, 0.3], [0.74, 0.24], [0.83, 0.22], [0.87, 0.35], [0.84, 0.5], [0.78, 0.58], [0.7, 0.6]] },
  ],
  tethien: [{ name: 'cape', pivot: [0.33, 0.4], poly: [[0.02, 0.54], [0.03, 0.47], [0.1, 0.42], [0.2, 0.4], [0.3, 0.38], [0.34, 0.42], [0.3, 0.5], [0.28, 0.58], [0.2, 0.6], [0.12, 0.56], [0.05, 0.53]] }],
};
const rigCache = new Map();
export function rigFor(xe) {
  if (rigCache.has(xe)) return rigCache.get(xe);
  const img = ASSETS.xe[xe], parts = RIGS[xe];
  if (!img || !parts) return null;
  const W0 = img.width, H0 = img.height;
  const base = document.createElement('canvas');
  base.width = W0; base.height = H0;
  const b = base.getContext('2d');
  b.drawImage(img, 0, 0);
  // the outline ink sits just outside the measured polygon, so grow it a little around its centre
  // (otherwise a ghost of the old outline stays behind when the part moves)
  const path = poly => {
    const cx = poly.reduce((a, q) => a + q[0], 0) / poly.length, cy = poly.reduce((a, q) => a + q[1], 0) / poly.length;
    const p = new Path2D();
    poly.forEach(([x, y], i) => { const X = (cx + (x - cx) * 1.06) * W0, Y = (cy + (y - cy) * 1.06) * H0; i ? p.lineTo(X, Y) : p.moveTo(X, Y); });
    p.closePath();
    return p;
  };
  const out = parts.map(pt => {
    const pp = path(pt.poly);
    const c = document.createElement('canvas');
    c.width = W0; c.height = H0;
    const x = c.getContext('2d');
    x.save(); x.clip(pp); x.drawImage(img, 0, 0); x.restore();
    // cut the part out of the base and paint the hole
    b.save(); b.globalCompositeOperation = 'destination-out'; b.fill(pp); b.restore();
    b.save(); b.clip(pp);
    if (pt.hole) { b.fillStyle = pt.hole; b.fill(pp); }
    if (pt.tongue) {
      const [px, py] = pt.pivot;
      b.fillStyle = pt.tongue;
      b.beginPath(); b.ellipse((px + 0.13) * W0, (py + 0.06) * H0, 0.12 * W0, 0.04 * H0, -0.1, 0, Math.PI * 2); b.fill();
    }
    b.restore();
    return { ...pt, canvas: c };
  });
  const rig = { base, parts: out, w: W0, h: H0 };
  rigCache.set(xe, rig);
  return rig;
}

async function loadMask(src) {
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    const stream = res.body.pipeThrough(new DecompressionStream('deflate'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch { return null; }
}

let loading = null;
export function loadAssets() { return (loading ||= loadAll()); }

async function loadAll() {
  const [xeA, xeB, pilotSheet, xe2, xe3] = await Promise.all([...XE_SHEETS.map(sh => loadSheet(sh)), loadSheet(PILOT_SHEET), loadSheet(XE2_SHEET, true), loadSheet(XE3_SHEET, true), loadProjectiles(), loadIcons(), loadOutfits()]);
  const xeSheet = xeA && xeB;
  if (xeA) Object.assign(ASSETS.xe, xeA);
  if (xeB) Object.assign(ASSETS.xe, xeB);
  // the three newer xe (2026-10-01): the penguin was painted facing left, so mirror it
  if (xe2) for (const [id, c] of Object.entries(xe2)) ASSETS.xe[id] = XE2_SHEET.flip.includes(id) ? mirror(c) : c;
  if (xe3) Object.assign(ASSETS.xe, xe3);
  if (pilotSheet) Object.assign(ASSETS.pilot, pilotSheet);
  const jobs = [
    ...(pilotSheet ? [] : ['m', 'f']).map(async g => {
      const img = await loadImg(`/assets/pilot/${g}.jpg`);
      if (img) ASSETS.pilot[g] = cutOut(img, PILOT_GREEN[g]);
    }),
    ...XE_LIST.filter(x => !xeSheet && !XE2_SHEET.order.includes(x.id)).map(async x => {
      const img = await loadImg(`/assets/xe/${x.id}.jpg`);
      if (img) ASSETS.xe[x.id] = cutOut(img, GREEN_BG.has(x.id));
    }),
    ...MAP_IDS.map(async m => { ASSETS.bg[m] = await loadImg(`/assets/maps/bg-${m}.jpg`); }),
    ...MAP_IDS.map(async m => {
      const [img, mask] = await Promise.all([loadImg(`/assets/maps/terrain-${m}.jpg`), loadMask(`/assets/maps/mask-${m}.bin`)]);
      if (img && mask) { ASSETS.terrain[m] = img; registerMask(m, mask); }
    }),
  ];
  await Promise.all(jobs);
  ASSETS.ready = true;
  return ASSETS;
}

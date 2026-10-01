// All visuals are drawn in code: xe, projectiles, terrain and sky.
import { W, H, mulberry32 } from '/shared/physics.js';
import { ASSETS, xeSprite, drawSmooth, rigFor, occPath, drawReins } from './assets.js';

export const TEAM_COLORS = { A: '#ff4d4d', B: '#3fa9ff' };

export const THEMES = {
  'dong-co': {
    sky: ['#4f9cf0', '#a8dcff', '#e8f7ff'], far: '#7aa6d8', near: '#5f8f5a', stars: false, sun: '#fff6b0',
    top: [120, 214, 70], top2: [74, 168, 44], dirt: [150, 100, 58], dirt2: [112, 72, 40], rim: 'rgba(40,22,8,0.7)',
    water: ['rgba(60,150,230,0.85)', 'rgba(20,70,160,0.95)'], cloud: 'rgba(255,255,255,0.85)',
  },
  'sa-mac': {
    sky: ['#f08a3c', '#ffc27a', '#fff0c8'], far: '#d99a5a', near: '#c7843f', stars: false, sun: '#fff2c0',
    top: [250, 222, 140], top2: [232, 190, 105], dirt: [210, 156, 80], dirt2: [176, 122, 58], rim: 'rgba(90,50,10,0.6)',
    water: ['rgba(60,170,190,0.85)', 'rgba(20,90,120,0.95)'], cloud: 'rgba(255,240,220,0.6)',
  },
  'bang-gia': {
    sky: ['#0d1b3d', '#3b5c9c', '#9fc4ef'], far: '#8fb0dc', near: '#6e93c4', stars: true, sun: '#e8f6ff', aurora: true,
    top: [248, 252, 255], top2: [200, 228, 250], dirt: [130, 190, 230], dirt2: [96, 150, 200], rim: 'rgba(20,50,90,0.6)',
    water: ['rgba(60,120,200,0.8)', 'rgba(10,40,100,0.95)'], cloud: 'rgba(220,235,255,0.5)',
  },
  'nui-lua': {
    sky: ['#12060c', '#4a1418', '#b8401e'], far: '#3a1a1c', near: '#2a1214', stars: true, sun: '#ff9a4a', embers: true,
    top: [120, 70, 55], top2: [90, 50, 40], dirt: [70, 42, 34], dirt2: [48, 28, 24], rim: 'rgba(255,90,20,0.55)',
    water: ['rgba(255,110,20,0.95)', 'rgba(200,30,10,1)'], cloud: 'rgba(80,40,40,0.5)', lava: true,
  },
};

// ---------- terrain ----------
// Gunbound look: a thick black outline on every edge, a wavy lit top band, layered soil and buried pebbles.

const PAL = {
  'dong-co': { hl: [178, 240, 96], top: [104, 200, 56], edge: [52, 128, 36], soil: [176, 116, 66], deep: [104, 64, 38], peb: [214, 176, 132] },
  'sa-mac': { hl: [255, 244, 196], top: [250, 222, 146], edge: [206, 162, 84], soil: [226, 164, 88], deep: [168, 106, 52], peb: [246, 210, 150] },
  'bang-gia': { hl: [255, 255, 255], top: [236, 248, 255], edge: [160, 204, 238], soil: [132, 196, 236], deep: [70, 128, 196], peb: [214, 242, 255] },
  'nui-lua': { hl: [168, 92, 64], top: [118, 64, 50], edge: [58, 30, 24], soil: [84, 48, 40], deep: [38, 22, 20], peb: [128, 74, 58] },
};
const OUTLINE = [28, 16, 12];

// Painted map: the terrain painting cut exactly to the mask, with an ink line along every edge.
// The painting is taller than the world; the part above y=0 (tree tops, volcano smoke) is kept as
// decoration in a top pad so it isn't sliced off. canvas.pad tells callers where world y=0 sits.
function paintFromImage(mask, img, key, mirror) {
  const pad = Math.max(0, img.height - H);
  const c = document.createElement('canvas');
  c.width = W; c.height = H + pad;
  c.pad = pad;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (mirror) { ctx.save(); ctx.translate(W, 0); ctx.scale(-1, 1); ctx.drawImage(img, 0, 0, W, img.height); ctx.restore(); }
  else ctx.drawImage(img, 0, 0, W, img.height);
  const data = ctx.getImageData(0, 0, W, H + pad), d = data.data;
  const air = (x, y) => x < 0 || x >= W || y < 0 || y >= H || !mask[y * W + x];
  const keyed = o => (key === 'green' ? d[o + 1] - Math.max(d[o], d[o + 2]) : Math.min(d[o], d[o + 2]) - d[o + 1]) >= 70;
  for (let cy = 0; cy < H + pad; cy++) {
    const y = cy - pad;
    for (let x = 0; x < W; x++) {
      const o = (cy * W + x) * 4;
      if (y < 0) { if (keyed(o)) d[o + 3] = 0; continue; } // decoration strip: plain colour key
      const i = y * W + x;
      if (!mask[i]) { d[o + 3] = 0; continue; }
      if (air(x - 1, y) || air(x + 1, y) || (y > 0 && air(x, y - 1)) || air(x, y + 1)) { d[o] = OUTLINE[0]; d[o + 1] = OUTLINE[1]; d[o + 2] = OUTLINE[2]; d[o + 3] = 255; }
    }
  }
  ctx.putImageData(data, 0, 0);
  // everything else draws in world coordinates
  ctx.setTransform(1, 0, 0, 1, 0, pad);
  return c;
}

const KEY = { 'dong-co': 'magenta', 'sa-mac': 'magenta', 'bang-gia': 'green', 'nui-lua': 'green' };

export function paintTerrain(mask, mapId, mirror = false) {
  if (ASSETS.terrain[mapId]) return paintFromImage(mask, ASSETS.terrain[mapId], KEY[mapId], mirror);
  const pal = PAL[mapId] || PAL['dong-co'];
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(W, H);
  const d = img.data;
  const R = mulberry32(99);
  const noise = new Float32Array(8192);
  for (let i = 0; i < noise.length; i++) noise[i] = R();
  const air = (x, y) => x < 0 || x >= W || y < 0 || y >= H || !mask[y * W + x];
  for (let x = 0; x < W; x++) {
    // wavy "dripping" edge of the top band, like hand-drawn grass/snow
    const band = 10 + 4 * Math.sin(x * 0.13) + 3 * Math.sin(x * 0.041 + 1) + noise[x & 8191] * 3;
    let depth = 0;
    for (let y = 0; y < H; y++) {
      const i = y * W + x;
      if (!mask[i]) { depth = 0; continue; }
      depth++;
      const o = i * 4;
      let col;
      if (air(x - 2, y) || air(x + 2, y) || air(x, y - 2) || air(x, y + 2) || air(x - 1, y - 1) || air(x + 1, y - 1) || air(x - 1, y + 1) || air(x + 1, y + 1)) col = OUTLINE;
      else if (depth < 5) col = pal.hl;
      else if (depth < band) col = pal.top;
      else if (depth < band + 3) col = pal.edge;
      else {
        const n = noise[(x * 7 + y * 131) & 8191];
        const k = Math.min(1, (depth - band) / 420);
        const sv = Math.sin(y * 0.05 + Math.sin(x * 0.008) * 2.5);
        const strata = sv > 0.93 ? 0.9 : sv < -0.97 ? 1.06 : 1;
        const sh = (0.93 + n * 0.12) * strata;
        col = [
          (pal.soil[0] * (1 - k) + pal.deep[0] * k) * sh,
          (pal.soil[1] * (1 - k) + pal.deep[1] * k) * sh,
          (pal.soil[2] * (1 - k) + pal.deep[2] * k) * sh,
        ];
      }
      d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  // buried pebbles, only well inside the ground so they never cover the outline
  const deepInside = (x, y, r) => [[0, -1], [1, 0], [-1, 0], [0, 1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]]
    .every(([dx, dy]) => !air(Math.round(x + dx * (r + 22)), Math.round(y + dy * (r + 22))));
  ctx.lineWidth = 2;
  ctx.strokeStyle = `rgb(${OUTLINE.map(v => v + 30).join(',')})`;
  for (let i = 0; i < 420; i++) {
    const x = R() * W, y = 250 + R() * (H - 250), r = 2.5 + R() * R() * 12;
    if (!deepInside(x, y, r)) continue;
    const shade = 0.8 + R() * 0.35;
    ctx.fillStyle = `rgb(${pal.peb.map(v => Math.min(255, v * shade)).join(',')})`;
    ctx.beginPath(); ctx.ellipse(x, y, r, r * (0.55 + R() * 0.3), R() * 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.ellipse(x - r * 0.3, y - r * 0.25, r * 0.35, r * 0.2, 0, 0, Math.PI * 2); ctx.fill();
  }
  if (THEMES[mapId].lava) {
    ctx.strokeStyle = 'rgba(255,130,30,0.8)';
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 90; i++) {
      let x = R() * W, y = 450 + R() * 550;
      if (!deepInside(x, y, 10)) continue;
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let k = 0; k < 6; k++) { x += (R() - 0.5) * 36; y += R() * 22; ctx.lineTo(x, y); }
      ctx.stroke();
    }
  }
  return c;
}

export function carveTerrain(tctx, x, y, r, mapId) {
  tctx.save();
  tctx.globalCompositeOperation = 'destination-out';
  tctx.beginPath(); tctx.arc(x, y, r, 0, Math.PI * 2); tctx.fill();
  tctx.globalCompositeOperation = 'source-atop';
  const g = tctx.createRadialGradient(x, y, r, x, y, r + 12);
  g.addColorStop(0, THEMES[mapId].rim);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  tctx.fillStyle = g;
  tctx.beginPath(); tctx.arc(x, y, r + 12, 0, Math.PI * 2); tctx.fill();
  // thick comic outline on the crater edge
  tctx.strokeStyle = `rgb(${OUTLINE.join(',')})`;
  tctx.lineWidth = r > 14 ? 5 : 3;
  tctx.beginPath(); tctx.arc(x, y, r + 1, 0, Math.PI * 2); tctx.stroke();
  tctx.restore();
}

// Painted backdrop from Gamma, with gentle parallax. Returns false if it isn't loaded.
export function drawBackdrop(ctx, img, vw, vh, cam, zoom, viewW) {
  if (!img) return false;
  const bw = vw * 1.3, bh = Math.max(vh * 1.12, (bw * img.height) / img.width);
  const sw = Math.max(bw, (bh * img.width) / img.height);
  const px = Math.max(0, Math.min(1, cam.x / Math.max(1, W - viewW)));
  const py = Math.max(0, Math.min(1, (cam.y + 420) / (H + 450)));
  ctx.drawImage(img, -(sw - vw) * px, -(bh - vh) * py, sw, bh);
  return true;
}

// ---------- sky & parallax ----------

export function makeScenery(seed, mapId) {
  const R = mulberry32(seed + 7);
  const ridge = (n, base, amp) => {
    const pts = [];
    const ph = [R() * 6, R() * 6, R() * 6];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      pts.push(base - amp * (0.6 * Math.sin(t * 9 + ph[0]) + 0.3 * Math.sin(t * 23 + ph[1]) + 0.15 * Math.sin(t * 57 + ph[2])) - amp * 0.3 * R());
    }
    return pts;
  };
  const clouds = Array.from({ length: 14 }, () => ({ x: R() * W * 1.4, y: 60 + R() * 380, s: 0.6 + R() * 1.2, v: 4 + R() * 10 }));
  const stars = Array.from({ length: 140 }, () => ({ x: R(), y: R() * 0.6, r: R() * 1.6 + 0.3, tw: R() * 6 }));
  return { far: ridge(60, 640, 170), near: ridge(90, 760, 120), clouds, stars, mapId };
}

export function drawSky(ctx, vw, vh, cam, zoom, sc, time) {
  const th = THEMES[sc.mapId];
  const g = ctx.createLinearGradient(0, 0, 0, vh);
  g.addColorStop(0, th.sky[0]); g.addColorStop(0.6, th.sky[1]); g.addColorStop(1, th.sky[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, vw, vh);
  if (th.stars) {
    for (const s of sc.stars) {
      ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(time * 1.5 + s.tw));
      ctx.fillStyle = '#fff';
      ctx.fillRect(s.x * vw, s.y * vh, s.r, s.r);
    }
    ctx.globalAlpha = 1;
  }
  if (th.aurora) {
    for (let i = 0; i < 3; i++) {
      const ag = ctx.createLinearGradient(0, 0, 0, vh * 0.5);
      ag.addColorStop(0, 'rgba(80,255,180,0)');
      ag.addColorStop(0.5, `rgba(80,255,180,${0.12 + i * 0.03})`);
      ag.addColorStop(1, 'rgba(120,120,255,0)');
      ctx.fillStyle = ag;
      ctx.beginPath();
      ctx.moveTo(0, vh * 0.15);
      for (let x = 0; x <= vw; x += 40) ctx.lineTo(x, vh * (0.12 + i * 0.06) + Math.sin(x * 0.006 + time * 0.4 + i) * 40);
      ctx.lineTo(vw, vh * 0.45); ctx.lineTo(0, vh * 0.45);
      ctx.fill();
    }
  }
  // sun / moon
  const sx = vw * 0.78 - cam.x * zoom * 0.05, sy = vh * 0.18;
  const sg = ctx.createRadialGradient(sx, sy, 10, sx, sy, 140);
  sg.addColorStop(0, th.sun); sg.addColorStop(0.25, th.sun + 'aa'); sg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sg;
  ctx.beginPath(); ctx.arc(sx, sy, 140, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = th.sun;
  ctx.beginPath(); ctx.arc(sx, sy, 34, 0, Math.PI * 2); ctx.fill();

  const layer = (pts, color, factor, yoff) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    const wx = W * 1.2;
    const baseY = (y) => (y - cam.y * factor) * zoom + yoff;
    ctx.moveTo(-10, vh);
    for (let i = 0; i < pts.length; i++) {
      const x = ((i / (pts.length - 1)) * wx - cam.x * factor) * zoom;
      ctx.lineTo(x, baseY(pts[i]));
    }
    ctx.lineTo(vw + 10, vh);
    ctx.fill();
  };
  // clouds
  ctx.fillStyle = th.cloud;
  for (const c of sc.clouds) {
    const x = (((c.x + time * c.v) % (W * 1.4)) - 200 - cam.x * 0.3) * zoom;
    const y = (c.y - cam.y * 0.3) * zoom;
    cloud(ctx, x, y, 40 * c.s * zoom);
  }
  layer(sc.far, th.far, 0.25, -vh * 0.05);
  layer(sc.near, th.near, 0.5, 0);
}

function cloud(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.arc(x + r * 0.9, y + r * 0.2, r * 0.8, 0, Math.PI * 2);
  ctx.arc(x - r * 0.9, y + r * 0.25, r * 0.7, 0, Math.PI * 2);
  ctx.arc(x + r * 0.2, y - r * 0.5, r * 0.7, 0, Math.PI * 2);
  ctx.fill();
}

export function drawWater(ctx, mapId, waterY, time) {
  const th = THEMES[mapId];
  const g = ctx.createLinearGradient(0, waterY - 10, 0, H + 200);
  g.addColorStop(0, th.water[0]); g.addColorStop(1, th.water[1]);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-400, H + 400);
  for (let x = -400; x <= W + 400; x += 20) ctx.lineTo(x, waterY + Math.sin(x * 0.02 + time * 2) * 4 + Math.sin(x * 0.047 - time * 1.3) * 3);
  ctx.lineTo(W + 400, H + 400);
  ctx.fill();
  ctx.strokeStyle = th.lava ? 'rgba(255,230,120,0.8)' : 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = -400; x <= W + 400; x += 20) ctx.lineTo(x, waterY + Math.sin(x * 0.02 + time * 2) * 4 + Math.sin(x * 0.047 - time * 1.3) * 3);
  ctx.stroke();
}

// ---------- xe ----------
// Local space: origin at the feet, facing right, y up is negative. Barrel pivot at (0,-22), length 28.

const P2 = Math.PI * 2;
function ell(ctx, x, y, rx, ry, fill, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, P2); ctx.fillStyle = fill; ctx.fill(); }
function circ(ctx, x, y, r, fill) { ctx.beginPath(); ctx.arc(x, y, r, 0, P2); ctx.fillStyle = fill; ctx.fill(); }
function poly(ctx, pts, fill) { ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); }
function eye(ctx, x, y, r = 2.6, iris = '#111') { circ(ctx, x, y, r, '#fff'); circ(ctx, x + r * 0.3, y, r * 0.55, iris); circ(ctx, x + r * 0.5, y - r * 0.35, r * 0.2, '#fff'); }
function shade(ctx, x, y, r, col = 'rgba(255,255,255,0.35)') {
  const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.5, 1, x, y, r);
  g.addColorStop(0, col); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, P2); ctx.fill();
}

function chassis(ctx, team, t, style = 'tread') {
  const tc = TEAM_COLORS[team] || '#aaa';
  if (style === 'cloud') {
    ctx.fillStyle = '#fff';
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.arc(i * 9, -6 + Math.sin(t * 4 + i) * 1.2, 8, 0, P2); ctx.fill(); }
    ctx.fillStyle = 'rgba(180,200,255,0.6)';
    ctx.fillRect(-22, -3, 44, 3);
    ctx.fillStyle = tc; ctx.fillRect(-16, -14, 32, 3);
    return;
  }
  ctx.fillStyle = '#23252e';
  roundRect(ctx, -24, -12, 48, 12, 6); ctx.fill();
  ctx.fillStyle = '#3c404d';
  for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.arc(i * 6.5, -6, 3.6, 0, P2); ctx.fill(); }
  ctx.fillStyle = '#6d7285';
  for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.arc(i * 6.5, -6, 1.4, 0, P2); ctx.fill(); }
  ctx.fillStyle = tc;
  roundRect(ctx, -22, -15, 44, 5, 2.5); ctx.fill();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function barrel(ctx, angle, c1, c2, len = 28, w = 7) {
  ctx.save();
  ctx.translate(0, -22);
  ctx.rotate((-angle * Math.PI) / 180);
  const g = ctx.createLinearGradient(0, -w / 2, 0, w / 2);
  g.addColorStop(0, c2); g.addColorStop(0.5, c1); g.addColorStop(1, '#222');
  ctx.fillStyle = g;
  roundRect(ctx, 0, -w / 2, len, w, 2); ctx.fill();
  ctx.fillStyle = '#222';
  roundRect(ctx, len - 4, -w / 2 - 1.5, 6, w + 3, 2); ctx.fill();
  ctx.restore();
}

const BODIES = {
  rong(ctx, t) {
    // tail
    ctx.strokeStyle = '#b8261f'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-12, -20); ctx.quadraticCurveTo(-30, -22, -26, -36 + Math.sin(t * 3) * 2); ctx.stroke();
    poly(ctx, [-26, -40, -31, -34, -22, -33], '#f2b134');
    // wing
    const flap = Math.sin(t * 5) * 4;
    poly(ctx, [-6, -32, -24, -54 - flap, -18, -44, -26, -42 - flap * 0.6, -4, -36], '#8e1a14');
    ell(ctx, -2, -25, 16, 11, '#d8342a');
    ell(ctx, 2, -21, 11, 6, '#f2b134');
    for (let i = 0; i < 4; i++) poly(ctx, [-12 + i * 6, -34, -9 + i * 6, -40, -6 + i * 6, -34], '#f2b134');
    // head
    ell(ctx, 14, -36, 9, 8, '#d8342a');
    ell(ctx, 21, -33, 7, 4.5, '#e2493d');
    poly(ctx, [10, -42, 6, -54, 14, -44], '#f2d27a');
    poly(ctx, [15, -43, 16, -55, 19, -43], '#f2d27a');
    circ(ctx, 25, -35, 1.1, '#400');
    eye(ctx, 15, -38, 2.6, '#c07a00');
    shade(ctx, -2, -27, 14);
  },
  kylan(ctx, t) {
    ell(ctx, -2, -26, 15, 10, '#f4f1ff');
    ell(ctx, 13, -36, 9, 7, '#ffffff', -0.3);
    ell(ctx, 20, -32, 5, 4, '#f7e8ff');
    // rainbow mane
    const cols = ['#ff5a7a', '#ffb13a', '#ffe74a', '#5ae07a', '#5ac8ff', '#a77aff'];
    ctx.lineWidth = 2.6; ctx.lineCap = 'round';
    cols.forEach((c, i) => {
      ctx.strokeStyle = c;
      ctx.beginPath(); ctx.moveTo(8 - i * 1.5, -42 + i); ctx.quadraticCurveTo(-4 - i * 2, -44 + i * 2 + Math.sin(t * 4 + i) * 2, -16 - i, -30 + i * 1.5); ctx.stroke();
    });
    // horn
    const hg = ctx.createLinearGradient(14, -44, 24, -60);
    hg.addColorStop(0, '#fff3a0'); hg.addColorStop(1, '#b9f4ff');
    poly(ctx, [12, -42, 26, -62, 17, -41], hg);
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(13 + i * 3, -44 - i * 4); ctx.lineTo(16 + i * 3, -43 - i * 4); ctx.stroke(); }
    eye(ctx, 15, -37, 2.4, '#5a3aff');
    shade(ctx, 0, -28, 14, 'rgba(200,180,255,0.35)');
  },
  kimquy(ctx, t) {
    ell(ctx, 20, -16, 7, 6, '#6aa84a');
    eye(ctx, 22, -18, 2);
    // shell dome
    ctx.beginPath(); ctx.ellipse(0, -14, 24, 20, 0, Math.PI, P2); ctx.closePath();
    const g = ctx.createLinearGradient(0, -34, 0, -14);
    g.addColorStop(0, '#ffe07a'); g.addColorStop(1, '#b8860b');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#8a5a00'; ctx.lineWidth = 1.5;
    for (const [x, y] of [[-10, -22], [0, -27], [10, -22], [-4, -17], [6, -17]]) {
      ctx.beginPath();
      for (let k = 0; k < 6; k++) { const a = (k / 6) * P2; ctx.lineTo(x + Math.cos(a) * 5, y + Math.sin(a) * 4); }
      ctx.closePath(); ctx.stroke();
    }
    // fortress tower
    ctx.fillStyle = '#8f949e'; ctx.fillRect(-9, -44, 12, 12);
    ctx.fillStyle = '#6d727c';
    for (let i = 0; i < 3; i++) ctx.fillRect(-9 + i * 4.5, -47, 3, 3);
    ctx.fillStyle = '#2a2d33'; ctx.fillRect(-5, -40, 4, 6);
    ctx.fillStyle = '#d8342a'; ctx.fillRect(-3, -56, 1.5, 9);
    poly(ctx, [-1.5, -56, 6, -53.5 + Math.sin(t * 6), -1.5, -51], '#ff5a3a');
    shade(ctx, -4, -26, 16);
  },
  phuong(ctx, t) {
    const fl = Math.sin(t * 10) * 2;
    // flame tail
    for (let i = 0; i < 3; i++) poly(ctx, [-8, -24, -30 - i * 3, -30 + i * 6 + fl, -12, -20], ['#ff3a1a', '#ff7a1a', '#ffd23a'][i]);
    // wings
    const flap = Math.sin(t * 6) * 6;
    poly(ctx, [-2, -30, -22, -52 - flap, -12, -44, -20, -40 - flap, -2, -34], '#ff7a1a');
    poly(ctx, [-2, -31, -16, -48 - flap, -4, -36], '#ffd23a');
    ell(ctx, 0, -27, 11, 9, '#ff5a1a');
    ell(ctx, 3, -24, 7, 5, '#ffcf3a');
    // head + crest
    circ(ctx, 11, -38, 7, '#ff7a1a');
    for (let i = 0; i < 3; i++) poly(ctx, [8 + i * 2, -44, 4 + i * 4, -54 - fl + i, 11 + i * 2, -43], i === 1 ? '#ffe74a' : '#ff3a1a');
    poly(ctx, [16, -39, 23, -37, 16, -35], '#ffcf3a');
    eye(ctx, 12, -39, 2.2, '#700');
    const g = ctx.createRadialGradient(0, -30, 2, 0, -30, 34);
    g.addColorStop(0, 'rgba(255,200,80,0.35)'); g.addColorStop(1, 'rgba(255,120,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -30, 34, 0, P2); ctx.fill();
  },
  voi(ctx, t) {
    ell(ctx, -3, -27, 18, 13, '#8a8f99');
    // tower
    ctx.fillStyle = '#b87333'; ctx.fillRect(-16, -46, 18, 10);
    ctx.fillStyle = '#8a4f1d'; ctx.fillRect(-18, -48, 22, 3);
    ctx.fillStyle = '#ffd27a'; ctx.fillRect(-12, -43, 3, 4); ctx.fillRect(-5, -43, 3, 4);
    // armor blanket
    ctx.fillStyle = '#9e1f2a'; roundRect(ctx, -16, -34, 22, 12, 3); ctx.fill();
    ctx.fillStyle = '#ffcf3a'; ctx.fillRect(-16, -25, 22, 2);
    // head, ear, trunk
    circ(ctx, 14, -32, 10, '#9aa0aa');
    ell(ctx, 8, -32, 6, 9, '#767b85');
    ctx.strokeStyle = '#9aa0aa'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(22, -30); ctx.quadraticCurveTo(30, -22, 27 + Math.sin(t * 3) * 2, -14); ctx.stroke();
    ctx.strokeStyle = '#fffbea'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(19, -26); ctx.quadraticCurveTo(25, -20, 30, -24); ctx.stroke();
    eye(ctx, 16, -35, 2);
    shade(ctx, -4, -30, 16);
  },
  bachtuoc(ctx, t) {
    // tentacles
    ctx.strokeStyle = '#8e44ad'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const x0 = -12 + i * 8;
      ctx.beginPath(); ctx.moveTo(x0, -20);
      ctx.bezierCurveTo(x0 - 8, -14, x0 + 6 + Math.sin(t * 4 + i) * 4, -8, x0 - 4 + Math.sin(t * 3 + i) * 3, -2);
      ctx.stroke();
    }
    circ(ctx, 0, -30, 11, '#a24fc4');
    ell(ctx, 0, -34, 9, 7, '#b765d8');
    eye(ctx, -3, -30, 3, '#1a0030');
    eye(ctx, 5, -30, 3, '#1a0030');
    // glass bell
    ctx.beginPath(); ctx.arc(0, -30, 16, 0, P2);
    ctx.fillStyle = 'rgba(140,220,255,0.18)'; ctx.fill();
    ctx.strokeStyle = 'rgba(220,250,255,0.85)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, -30, 12, -2.6, -1.9); ctx.stroke();
    ctx.fillStyle = '#b87333'; ctx.fillRect(-9, -16, 18, 4);
    // bubbles
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (let i = 0; i < 3; i++) { const y = -24 - ((t * 20 + i * 8) % 18); ctx.beginPath(); ctx.arc(-6 + i * 5, y, 1.2, 0, P2); ctx.fill(); }
  },
  bocap(ctx, t) {
    // legs
    ctx.strokeStyle = '#111a16'; ctx.lineWidth = 2.5;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-8 + i * 7, -18); ctx.lineTo(-12 + i * 7, -10); ctx.stroke(); }
    ell(ctx, 0, -22, 16, 7, '#1d2b26');
    for (let i = 0; i < 4; i++) { ctx.fillStyle = '#39e07a'; ctx.fillRect(-10 + i * 6, -27, 3, 1.5); }
    // claws
    for (const s of [-1, 1]) {
      ell(ctx, 18, -22 + s * 5, 5, 3.5, '#26372f');
      poly(ctx, [21, -22 + s * 5, 30, -24 + s * 7, 27, -21 + s * 5], '#39e07a');
    }
    // tail arc
    const segs = [[-12, -26], [-18, -34], [-16, -44], [-8, -50], [2, -50]];
    segs.forEach(([x, y], i) => circ(ctx, x, y, 6 - i * 0.6, i % 2 ? '#26372f' : '#1d2b26'));
    poly(ctx, [4, -53, 13, -48 + Math.sin(t * 5) * 2, 4, -46], '#39e07a');
    circ(ctx, 12, -48 + Math.sin(t * 5) * 2, 1.8, '#b6ffcf');
    eye(ctx, 12, -25, 1.8, '#c00');
    shade(ctx, 0, -24, 12, 'rgba(120,255,180,0.25)');
  },
  cu(ctx, t) {
    circ(ctx, 0, -28, 14, '#7a5230');
    ell(ctx, 0, -24, 9, 9, '#c9a277');
    // wings
    ell(ctx, -12, -24, 5, 10, '#5a3a20', 0.3);
    ell(ctx, 12, -24, 5, 10, '#5a3a20', -0.3);
    // ear tufts
    poly(ctx, [-10, -38, -13, -48, -4, -40], '#5a3a20');
    poly(ctx, [10, -38, 13, -48, 4, -40], '#5a3a20');
    // face disc + eyes
    ell(ctx, 0, -32, 12, 8, '#e8cfa8');
    const blink = (Math.sin(t * 1.3) > 0.97) ? 0.2 : 1;
    for (const x of [-5, 5]) {
      ctx.save(); ctx.translate(x, -32); ctx.scale(1, blink);
      circ(ctx, 0, 0, 5, '#ffe14a');
      circ(ctx, 1, 0, 2.6, '#111');
      circ(ctx, 1.8, -1, 0.9, '#fff');
      ctx.restore();
    }
    poly(ctx, [-2, -28, 2, -28, 0, -24], '#e0a020');
    const g = ctx.createRadialGradient(0, -32, 2, 0, -32, 22);
    g.addColorStop(0, 'rgba(255,240,120,0.25)'); g.addColorStop(1, 'rgba(255,240,120,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -32, 22, 0, P2); ctx.fill();
  },
  camap(ctx, t) {
    // tail fin
    poly(ctx, [-18, -24, -32, -36 + Math.sin(t * 5) * 2, -28, -24, -32, -14 + Math.sin(t * 5) * 2], '#4a5c6e');
    ell(ctx, 0, -24, 22, 10, '#5b6f82');
    ell(ctx, 2, -20, 17, 5, '#e8eef2');
    // dorsal fin
    poly(ctx, [-6, -32, 2, -50, 10, -32], '#4a5c6e');
    // gills
    ctx.strokeStyle = '#3a4a5a'; ctx.lineWidth = 1.2;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(8 + i * 3, -28); ctx.lineTo(7 + i * 3, -21); ctx.stroke(); }
    // drill nose
    const g = ctx.createLinearGradient(20, -30, 34, -20);
    g.addColorStop(0, '#ffb86a'); g.addColorStop(1, '#b85a10');
    poly(ctx, [19, -31, 36, -24, 19, -17], g);
    ctx.strokeStyle = 'rgba(80,30,0,0.6)'; ctx.lineWidth = 1;
    const sp = (t * 20) % 4;
    for (let i = 0; i < 4; i++) { const x = 21 + i * 4 + sp; ctx.beginPath(); ctx.moveTo(x, -30 + i * 1.6); ctx.lineTo(x + 2, -18 - i * 1.6); ctx.stroke(); }
    // teeth
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 4; i++) poly(ctx, [10 + i * 2.5, -19, 11.2 + i * 2.5, -16, 12.5 + i * 2.5, -19], '#fff');
    eye(ctx, 12, -27, 2, '#000');
    shade(ctx, -2, -27, 16);
  },
  tethien(ctx, t) {
    // staff behind
    ctx.save(); ctx.translate(-10, -30); ctx.rotate(-0.45);
    ctx.fillStyle = '#c0392b'; ctx.fillRect(-1.5, -26, 3, 44);
    ctx.fillStyle = '#ffd700'; ctx.fillRect(-2, -28, 4, 5); ctx.fillRect(-2, 14, 4, 5);
    ctx.restore();
    // cape
    poly(ctx, [-6, -34, -20, -18 + Math.sin(t * 4) * 2, -2, -20], '#c0392b');
    ell(ctx, 0, -24, 10, 9, '#b5651d');
    ell(ctx, 0, -24, 7, 7, '#ffd700');
    // head
    circ(ctx, 4, -38, 9, '#b5651d');
    ell(ctx, 7, -36, 6, 5.5, '#f2c9a0');
    circ(ctx, -4, -38, 3.5, '#f2c9a0');
    // golden circlet
    ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(4, -38, 9, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
    circ(ctx, 4, -47, 2, '#ff3a3a');
    eye(ctx, 6, -38, 1.8, '#5a2a00');
    eye(ctx, 10, -38, 1.8, '#5a2a00');
    ctx.strokeStyle = '#6a3a10'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(8, -34, 2.5, 0.2, Math.PI - 0.2); ctx.stroke();
    shade(ctx, 2, -28, 12);
  },
};

// ---------- chibi pilot ----------

const HAIR = ['#3a2a1a', '#ffcf3a', '#ff5a8a', '#4ab8ff', '#8a4aff', '#ff7a1a', '#2a2a3a', '#f0f0ff', '#3ad07a', '#c0392b'];
export const hairFor = name => {
  let h = 0;
  for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return HAIR[h % HAIR.length];
};
// Where the pilot sits on each xe (feet point, local space).
const SEATS = { rong: [-7, -35], kylan: [-5, -34], kimquy: [8, -32], phuong: [-5, -34], voi: [-7, -46], bachtuoc: [0, -45], bocap: [5, -27], cu: [0, -41], camap: [-13, -32] };

function drawPilot(ctx, sx, sy, hair, team, t) {
  const jacket = team === 'B' ? '#2a7fe0' : '#e0343a';
  const jacket2 = team === 'B' ? '#bfe4ff' : '#ffd0d0';
  ctx.save();
  ctx.translate(sx, sy + Math.sin(t * 3 + 1) * 0.5);
  // body
  ctx.fillStyle = jacket; roundRect(ctx, -4.5, -9, 9, 9, 3); ctx.fill();
  ctx.fillStyle = jacket2; ctx.fillRect(-0.8, -9, 1.6, 9);
  // waving arm
  ctx.strokeStyle = jacket; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(3, -7); ctx.lineTo(7, -11 + Math.sin(t * 4) * 1.5); ctx.stroke();
  circ(ctx, 7.5, -11.5 + Math.sin(t * 4) * 1.5, 1.7, '#ffe0c8');
  // head
  const hy = -17;
  circ(ctx, 0, hy, 7.5, '#ffe0c8');
  // hair back + spikes
  ctx.fillStyle = hair;
  ctx.beginPath(); ctx.arc(0, hy - 1, 8, Math.PI * 0.95, Math.PI * 2.05); ctx.fill();
  poly(ctx, [-8, hy - 1, -11, hy - 6, -6, hy - 5], hair);
  poly(ctx, [-5, hy - 6, -6, hy - 12, -1, hy - 7], hair);
  poly(ctx, [0, hy - 7, 3, hy - 13, 4, hy - 7], hair);
  // bangs
  poly(ctx, [-7, hy - 3, -3, hy + 1, -2, hy - 4, 1, hy, 2, hy - 4, 5, hy + 1, 7, hy - 3, 6, hy - 6, -6, hy - 6], hair);
  // goggles on forehead
  ctx.fillStyle = '#5a3a20'; ctx.fillRect(-8, hy - 6, 16, 2);
  circ(ctx, -2.5, hy - 5, 2.4, '#8fe8ff'); circ(ctx, 3, hy - 5, 2.4, '#8fe8ff');
  circ(ctx, -3.2, hy - 5.8, 0.8, '#fff'); circ(ctx, 2.3, hy - 5.8, 0.8, '#fff');
  // big anime eyes
  for (const ex of [0.5, 4.5]) {
    ell(ctx, ex, hy + 1.2, 1.5, 2.3, '#1a1a3a');
    circ(ctx, ex + 0.4, hy + 0.3, 0.7, '#fff');
    circ(ctx, ex - 0.3, hy + 2.3, 0.35, '#fff');
  }
  // blush + mouth
  ell(ctx, -2, hy + 3.8, 1.5, 0.8, 'rgba(255,110,130,0.55)');
  ell(ctx, 6.5, hy + 3.8, 1.2, 0.8, 'rgba(255,110,130,0.55)');
  ctx.strokeStyle = '#8a3a3a'; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.arc(3, hy + 4, 1.2, 0.2, Math.PI - 0.2); ctx.stroke();
  // glossy hair highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(0, hy - 1, 6, Math.PI * 1.15, Math.PI * 1.45); ctx.stroke();
  ctx.restore();
}

// Glossy "toy plastic" highlight used on every xe.
function gloss(ctx, x, y, rx, ry) {
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, -0.3, 0, P2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath(); ctx.ellipse(x - rx * 0.3, y - ry * 0.2, rx * 0.35, ry * 0.4, -0.3, 0, P2); ctx.fill();
  ctx.restore();
}
const GLOSS = { rong: [-6, -31, 6, 3], kylan: [-6, -32, 6, 2.5], kimquy: [-8, -28, 7, 3], phuong: [-3, -32, 4, 2], voi: [-9, -34, 5, 2.2], bachtuoc: [-7, -39, 4, 2.5], bocap: [-5, -26, 5, 1.6], cu: [-6, -37, 3, 2], camap: [-6, -30, 7, 2.2], tethien: [1, -45, 3, 1.6] };

export const SPRITE_H = 80;
// tall pictures (the bear's fridge cannon) fit by height and came out small: scale them back up
const SIZE_K = { gau: 1.1 };
const HOVER = new Set(['phuong', 'tethien', 'tho']);

// Painted sprite (faces right in the source image). Feet sit on (x, y); tilt follows the ground slope.
// pose: extra squash/stretch and offsets around the feet, for breathing, recoil, hops and hit wobble
function drawSprite(ctx, img, xe, { x, y, facing = 1, t = 0, scale = 1, alpha = 1, tilt = 0, walk = null, pose = null, fx = false, fireAge = 9 }) {
  // size by the animal body so a tall rider doesn't shrink the xe
  scale *= SIZE_K[xe] || 1;
  let k = (SPRITE_H * 0.8 * scale) / (img.animalH || img.height);
  if (img.width * k > 118 * scale) k = (118 * scale) / img.width;
  const w = img.width * k, h = img.height * k;
  // hovering xe float; walking xe hop with each step
  const bob = HOVER.has(xe) ? Math.sin(t * 2.5) * 3 - 4 : walk !== null ? -Math.abs(Math.sin(walk)) * 4 * scale : Math.abs(Math.sin(t * 3)) * -0.8;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath(); ctx.ellipse(0, 0, w * 0.36, 4 * scale, 0, 0, P2); ctx.fill();
  if (pose) ctx.translate((pose.dx || 0) * scale, (pose.dy || 0) * scale);
  ctx.rotate(tilt + (pose?.rot || 0));
  ctx.scale(facing * (pose?.sx || 1), pose?.sy || 1);
  const x0 = -w / 2, y0 = -h + 3 * scale + bob;
  const moves = fx ? rigMotion(xe, t, fireAge) : null;
  if (moves && drawRigged(ctx, img, xe, x0, y0, w, h, moves)) { /* drawn with moving parts */ }
  else drawSmooth(ctx, img, x0, y0, w, h);
  if (fx) drawXeFx(ctx, xe, x0, y0, w, h, t, moves);
  ctx.restore();
}

// How each rigged part moves right now: part name → angle (radians, positive = clockwise when facing right).
// Rồng opens its jaw during each fire puff and wide when it fires.
export function rigMotion(xe, t, fireAge = 9) {
  const shot = fireAge < 0.7 ? Math.sin(Math.min(1, fireAge / 0.7) * Math.PI) : 0;
  const S = (f, ph = 0) => Math.sin(t * f + ph);
  switch (xe) {
    case 'rong': {
      const c = frac(t / 3), puff = c < 0.25 ? Math.sin((c / 0.25) * Math.PI) : 0;
      return { jaw: Math.max(puff * 0.22, shot * 0.36), wing: S(3.5) * 0.1 - shot * 0.12, tail: S(1.7) * 0.06 };
    }
    case 'kylan': return { tail: S(2.2) * 0.13 };
    case 'kimquy': return { head: S(1.3) * 0.07 - shot * 0.1 };
    case 'phuong': { const f = S(6) * 0.14 + shot * 0.25; return { wingL: f, wingR: -f }; }
    case 'voi': return { trunk: S(1.8) * 0.07 - shot * 0.22 };
    case 'bachtuoc': return { tentL: S(2) * 0.1, tentR: -S(2, 1) * 0.1 };
    case 'bocap': return { tail: S(1.5) * 0.05 + shot * 0.25 };
    case 'cu': {
      // a double flap every 4 s, and on firing
      const c = frac(t / 4), flap = c < 0.3 ? Math.abs(Math.sin((c / 0.3) * Math.PI * 2)) : 0, f = Math.max(flap, shot);
      return { wingL: f * 0.3, wingR: -f * 0.3 };
    }
    case 'camap': return { tail: S(3) * 0.12 };
    case 'tethien': return { cape: S(3) * 0.07 + S(7.3) * 0.02 };
  }
  return null;
}

// Redraw a composite xe sprite with its animal's parts turned: base (with holes painted), moving parts, then the pilot.
function drawRigged(ctx, img, xe, x0, y0, w, h, moves) {
  const rig = rigFor(xe);
  if (!rig) return false;
  const s = w / img.width, ax = x0 + (img.ax || 0) * s, ay = y0 + (img.ay || 0) * s, aw = rig.w * s, ah = rig.h * s;
  const pilot = () => { if (img.pilot && img.pilotRect) { const [px, py, pw, ph] = img.pilotRect; drawSmooth(ctx, img.pilot, x0 + px * s, y0 + py * s, pw * s, ph * s); } };
  const animal = () => {
    drawSmooth(ctx, rig.base, ax, ay, aw, ah);
    for (const p of rig.parts) {
      const a = moves[p.name] || 0, px = ax + p.pivot[0] * aw, py = ay + p.pivot[1] * ah;
      ctx.save();
      ctx.translate(px, py); ctx.rotate(a); ctx.translate(-px, -py);
      drawSmooth(ctx, p.canvas, ax, ay, aw, ah);
      ctx.restore();
    }
  };
  if (img.behind) { pilot(); animal(); return true; }
  animal();
  if (img.pilot) {
    pilot();
    // the animal's back/saddle goes back over the pilot's hips and legs
    const occ = occPath(xe, ax, ay, aw, ah);
    if (occ) { ctx.save(); ctx.clip(occ); animal(); ctx.restore(); }
    drawReins(ctx, img.reins, s, x0, y0);
  }
  return true;
}

// Where each animal's signature parts sit on its sprite (fractions of the sprite box, facing right).
// Measured on the pilot sprites; used by the per-xe signature effects below and by firing effects in game.js.
export const XE_PARTS = {
  rong: { mouth: [0.88, 0.56], cannon: [0.4, 0.2] },
  kylan: { horn: [0.95, 0.12], mane: [0.42, 0.2], tail: [0.12, 0.45] },
  kimquy: { shell: [0.45, 0.55], head: [0.8, 0.5], bow: [0.97, 0.15] },
  phuong: { wingL: [0.2, 0.3], wingR: [0.85, 0.28], tail: [0.15, 0.85], orb: [0.72, 0.8] },
  voi: { trunk: [0.97, 0.35], tower: [0.54, 0.12] },
  bachtuoc: { bell: [0.98, 0.42] },
  bocap: { sting: [0.36, 0.14] },
  cu: { eyeL: [0.56, 0.36], eyeR: [0.66, 0.36], scope: [0.97, 0.12] },
  camap: { drill: [0.99, 0.35] },
  tethien: { cloud: [0.4, 0.86], staff: [0.97, 0.41] },
  gau: { nozzle: [0.69, 0.12], face: [0.66, 0.41] },
  canhcut: { gun: [0.96, 0.36], board: [0.5, 0.92], glasses: [0.55, 0.3] },
  tho: { gun: [0.94, 0.16], moon: [0.64, 0.95], ears: [0.58, 0.34] },
};
// sprite box of a xe on the battlefield (same sizing as drawSprite), for placing effects in world space
export function spriteBox(xe, gender, scale = 1) {
  const img = xeSprite(xe, gender);
  if (!img) return null;
  scale *= SIZE_K[xe] || 1;
  let k = (SPRITE_H * 0.8 * scale) / (img.animalH || img.height);
  if (img.width * k > 118 * scale) k = (118 * scale) / img.width;
  return { w: img.width * k, h: img.height * k };
}
export function partWorld(xe, gender, part, x, y, facing) {
  const b = spriteBox(xe, gender), p = XE_PARTS[xe]?.[part];
  if (!b || !p) return [x, y - 40];
  return [x + facing * (p[0] - 0.5) * b.w, y - b.h + 3 + p[1] * b.h];
}
export function partPos(xe, part, x0, y0, w, h) {
  const p = XE_PARTS[xe]?.[part];
  return p ? [x0 + p[0] * w, y0 + p[1] * h] : [x0 + w / 2, y0 + h / 2];
}

// Signature idle effect per animal, drawn over the sprite in the sprite's own (facing-right) space.
// Deterministic from time t, so it needs no particle state and works on any canvas (battlefield or menus).
// Like Gunbound's mobiles, each one does its own thing instead of a generic bounce: the dragon puffs fire,
// the elephant sprays its trunk, the scorpion's tail drips venom, the owl's eyes glow.
const frac = v => v - Math.floor(v);
export function drawXeFx(ctx, xe, x0, y0, w, h, t, moves = null) {
  const u = w / 50, P = part => partPos(xe, part, x0, y0, w, h);
  ctx.save();
  if (xe === 'rong') {
    // every 3 s: a short burst of flame and smoke out of the mouth
    const [mx, my] = P('mouth'), c = frac(t / 3), on = c < 0.25;
    for (let i = 0; i < 14; i++) {
      const k = frac(t * 2.6 + i / 14);
      const sx = mx + k * 17 * u, sy = my - k * 5 * u + Math.sin(i * 3 + t * 11) * 1.2 * u * k;
      if (on) {
        const r = (1.5 + k * 3.5) * u;
        ctx.fillStyle = k < 0.35 ? 'rgba(255,245,170,0.95)' : k < 0.7 ? 'rgba(255,150,30,0.85)' : 'rgba(210,60,20,0.6)';
        ctx.beginPath(); ctx.arc(sx, sy, r * (1 - k * 0.3), 0, Math.PI * 2); ctx.fill();
      } else if (i < 3) {
        ctx.fillStyle = `rgba(90,90,100,${0.35 * (1 - k)})`;
        ctx.beginPath(); ctx.arc(mx + k * 5 * u, my - k * 14 * u, (1.2 + k * 2.5) * u, 0, Math.PI * 2); ctx.fill();
      }
    }
  } else if (xe === 'kylan') {
    const [hx, hy] = P('horn');
    const tw = 0.5 + 0.5 * Math.sin(t * 5);
    ctx.fillStyle = `rgba(255,255,255,${0.5 + 0.5 * tw})`;
    star(ctx, hx, hy, (2 + 2.5 * tw) * u);
    const cols = ['#bff8e0', '#ffe14a', '#ffffff', '#9ff0d0', '#ffd6f0'];
    for (let i = 0; i < 6; i++) {
      const k = frac(t * 0.5 + i / 6), [tx, ty] = P(i % 2 ? 'mane' : 'tail');
      ctx.globalAlpha = Math.sin(k * Math.PI) * 0.9;
      ctx.fillStyle = cols[i % cols.length];
      ctx.beginPath(); ctx.arc(tx - k * 8 * u + Math.sin(k * 7 + i) * 2 * u, ty - k * 14 * u, 1.3 * u, 0, Math.PI * 2); ctx.fill();
    }
  } else if (xe === 'kimquy') {
    // a gold gleam sweeps across the shell every 4 s
    const [sx, sy] = P('shell'), c = frac(t / 4);
    if (c < 0.3) {
      const k = c / 0.3, gx = sx - 22 * u + k * 44 * u;
      ctx.globalAlpha = Math.sin(k * Math.PI) * 0.8;
      ctx.fillStyle = 'rgba(255,250,210,0.9)';
      ctx.beginPath(); ctx.moveTo(gx - 3 * u, sy - 14 * u); ctx.lineTo(gx + 3 * u, sy - 14 * u); ctx.lineTo(gx - 3 * u, sy + 8 * u); ctx.lineTo(gx - 9 * u, sy + 8 * u); ctx.fill();
    }
  } else if (xe === 'phuong') {
    for (let i = 0; i < 10; i++) {
      const k = frac(t * 0.7 + i / 10), [ex, ey] = P(['wingL', 'wingR', 'tail'][i % 3]);
      ctx.globalAlpha = (1 - k) * 0.9;
      ctx.fillStyle = k < 0.4 ? '#fff3a0' : '#ff8a1a';
      ctx.beginPath(); ctx.arc(ex + Math.sin(k * 9 + i * 2) * 3 * u, ey - k * 22 * u, (1.6 - k) * u, 0, Math.PI * 2); ctx.fill();
    }
  } else if (xe === 'voi') {
    // every 3.5 s the trunk flicks out a little spray
    const [tx, ty] = P('trunk'), c = frac(t / 3.5);
    if (c < 0.35) for (let i = 0; i < 7; i++) {
      const k = Math.min(1, c / 0.35 + i * 0.04), a = -0.9 + i * 0.12;
      const px = tx + Math.cos(a) * k * 18 * u, py = ty + Math.sin(a) * k * 18 * u + k * k * 12 * u;
      ctx.globalAlpha = 1 - k * 0.7; ctx.fillStyle = i % 2 ? '#bfe8ff' : '#6fc8ff';
      ctx.beginPath(); ctx.arc(px, py, 1.4 * u, 0, Math.PI * 2); ctx.fill();
    }
  } else if (xe === 'bachtuoc') {
    const [bx, by] = P('bell');
    // ink drips from the bottle's mouth
    for (let i = 0; i < 3; i++) {
      const k = frac(t * 0.6 + i / 3);
      ctx.globalAlpha = 1 - k * 0.7; ctx.fillStyle = '#1a1030';
      ctx.beginPath(); ctx.ellipse(bx - (2 + i * 3) * u, by + 3 * u + k * k * 22 * u, 1.3 * u, 1.9 * u, 0, 0, Math.PI * 2); ctx.fill();
    }
    for (let i = 0; i < 5; i++) {
      const k = frac(t * 0.45 + i / 5);
      ctx.globalAlpha = Math.sin(k * Math.PI) * 0.85;
      ctx.strokeStyle = '#e6fbff'; ctx.lineWidth = 0.7 * u;
      ctx.beginPath(); ctx.arc(bx + Math.sin(k * 6 + i * 2.1) * 10 * u, by + 10 * u - k * 24 * u, (1 + (i % 3) * 0.6) * u, 0, Math.PI * 2); ctx.stroke();
    }
  } else if (xe === 'bocap') {
    // a venom drop swells at the sting and falls
    const [sx, sy] = P('sting'), c = frac(t / 2.2);
    ctx.fillStyle = '#7dff9a'; ctx.strokeStyle = '#0b1633'; ctx.lineWidth = 0.5 * u;
    if (c < 0.6) { const r = (c / 0.6) * 2.2 * u; ctx.beginPath(); ctx.arc(sx, sy + 2 * u + r, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    else { const k = (c - 0.6) / 0.4; ctx.globalAlpha = 1 - k * 0.6; ctx.beginPath(); ctx.ellipse(sx, sy + 4 * u + k * k * 40 * u, 1.8 * u, 2.6 * u, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t * 4); ctx.fillStyle = '#7dff9a';
    ctx.beginPath(); ctx.arc(sx, sy, 5 * u, 0, Math.PI * 2); ctx.fill();
  } else if (xe === 'cu') {
    // glowing eyes that blink every few seconds
    const c = frac(t / 3.8), open = c > 0.06 ? 1 : 0.15, glow = 0.55 + 0.35 * Math.sin(t * 2.5);
    for (const e of ['eyeL', 'eyeR']) {
      const [ex, ey] = P(e);
      const g = ctx.createRadialGradient(ex, ey, 0, ex, ey, 7 * u);
      g.addColorStop(0, `rgba(255,240,120,${glow * open})`); g.addColorStop(1, 'rgba(255,220,60,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(ex, ey, 7 * u, 7 * u * open, 0, 0, Math.PI * 2); ctx.fill();
    }
  } else if (xe === 'camap') {
    const [dx, dy] = P('drill');
    for (let i = 0; i < 6; i++) {
      const k = frac(t * 0.9 + i / 6);
      ctx.globalAlpha = 1 - k; ctx.fillStyle = i % 2 ? '#d8b878' : '#a8844a';
      ctx.fillRect(dx - (4 + i * 3) * u, dy + k * 26 * u, 1.4 * u, 1.4 * u);
    }
    const spin = frac(t * 3);
    ctx.globalAlpha = 0.6; ctx.strokeStyle = '#fff4d0'; ctx.lineWidth = 0.8 * u;
    ctx.beginPath(); ctx.moveTo(dx - 16 * u + spin * 10 * u, dy - 8 * u); ctx.lineTo(dx - 12 * u + spin * 10 * u, dy + 8 * u); ctx.stroke();
  } else if (xe === 'gau') {
    // cold mist curls out of the fridge cannon and a few snowflakes drift down
    const [nx, ny] = P('nozzle');
    for (let i = 0; i < 6; i++) {
      const k = frac(t * 0.5 + i / 6);
      ctx.globalAlpha = Math.sin(k * Math.PI) * 0.7; ctx.fillStyle = '#e8f6ff';
      ctx.beginPath(); ctx.arc(nx + k * 10 * u, ny - k * 8 * u + Math.sin(k * 6 + i) * 2 * u, (1.5 + k * 3) * u, 0, Math.PI * 2); ctx.fill();
    }
    for (let i = 0; i < 4; i++) { const k = frac(t * 0.25 + i / 4); ctx.globalAlpha = 1 - k; ctx.fillStyle = '#ffffff'; star(ctx, x0 + w * (0.15 + 0.2 * i) + Math.sin(k * 5 + i) * 3 * u, y0 + h * (0.1 + k * 0.8), 1.3 * u); }
  } else if (xe === 'canhcut') {
    // a glint sweeps the sunglasses, and ice sparkles fly off the surfboard
    const [gx, gy] = P('glasses'), c = frac(t / 2.6);
    if (c < 0.25) { ctx.globalAlpha = Math.sin((c / 0.25) * Math.PI); ctx.fillStyle = '#ffffff'; star(ctx, gx + (c / 0.25 - 0.5) * 6 * u, gy - u, 2.4 * u); }
    const [bx, by] = P('board');
    for (let i = 0; i < 5; i++) { const k = frac(t * 0.9 + i / 5); ctx.globalAlpha = 1 - k; ctx.fillStyle = i % 2 ? '#bff4ff' : '#6fd0ff'; ctx.beginPath(); ctx.arc(bx - 14 * u - k * 14 * u, by - k * 6 * u, 1.2 * u, 0, Math.PI * 2); ctx.fill(); }
  } else if (xe === 'tho') {
    // golden stars orbit the moon rabbit and its halo breathes
    const [mx, my] = P('moon'), [ex, ey] = P('ears');
    ctx.globalAlpha = 0.25 + 0.2 * Math.sin(t * 2.2);
    const hg = ctx.createRadialGradient(ex, ey + 8 * u, 0, ex, ey + 8 * u, 26 * u); hg.addColorStop(0, 'rgba(255,240,170,0.9)'); hg.addColorStop(1, 'rgba(255,240,170,0)');
    ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(ex, ey + 8 * u, 26 * u, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 5; i++) { const a = t * 1.3 + (i * Math.PI * 2) / 5; ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 4 + i); ctx.fillStyle = '#ffe14a'; star(ctx, (x0 + x0 + w) / 2 + Math.cos(a) * w * 0.45, y0 + h * 0.5 + Math.sin(a) * h * 0.25, 2 * u); }
  } else if (xe === 'tethien') {
    const [cx, cy] = P('cloud');
    for (let i = 0; i < 4; i++) {
      const k = frac(t * 0.35 + i / 4);
      // golden wisps trailing off the back of the nimbus
      ctx.globalAlpha = Math.sin(k * Math.PI) * 0.55; ctx.fillStyle = '#ffe6a0';
      ctx.beginPath(); ctx.arc(cx - 14 * u - k * 12 * u, cy - 2 * u + i * 1.5 * u, (1.2 + k * 1.4) * u, 0, Math.PI * 2); ctx.fill();
    }
    const tw = frac(t * 0.8);
    ctx.globalAlpha = Math.sin(tw * Math.PI); ctx.fillStyle = '#ffe14a';
    star(ctx, x0 + w * (0.3 + 0.4 * frac(t * 0.13)), y0 + h * 0.35, 1.6 * u);
  }
  ctx.restore();
}
function star(ctx, x, y, r) {
  ctx.beginPath();
  for (let j = 0; j < 8; j++) { const a = (j * Math.PI) / 4, rr = j % 2 ? r * 0.35 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill();
}

// Idle life for menus: breathing squash, a slow sway, and an occasional happy hop (every few seconds,
// staggered by seed so a row of xe doesn't move in lockstep).
export function idlePose(t, seed = 0, hover = false) {
  const b = Math.sin(t * 2.4 + seed * 1.7);
  const cyc = (t + seed * 1.37) % 5.2, hop = cyc < 0.45 ? Math.sin((cyc / 0.45) * Math.PI) : 0;
  const land = cyc >= 0.45 && cyc < 0.6 ? Math.sin(((cyc - 0.45) / 0.15) * Math.PI) : 0;
  return {
    sx: 1 - 0.018 * b + 0.06 * land - 0.03 * hop,
    sy: 1 + 0.028 * b - 0.08 * land + 0.05 * hop,
    dy: (hover ? Math.sin(t * 2.2 + seed) * 3 : 0) - hop * 10,
    rot: Math.sin(t * 1.1 + seed) * 0.025,
  };
}
export const isHover = xe => HOVER.has(xe);

export function drawXe(ctx, xe, opts) {
  const sprite = xeSprite(xe, opts.gender);
  if (sprite) return drawSprite(ctx, sprite, xe, opts);
  const { x, y, facing = 1, angle = 45, team = 'A', t = 0, scale = 1, alpha = 1, colors, hair = '#3a2a1a' } = opts;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(facing * scale, scale);
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(0, 0, 26, 4, 0, 0, P2); ctx.fill();
  const bob = Math.sin(t * 3) * 0.6;
  ctx.translate(0, bob);
  barrel(ctx, angle, colors?.[1] || '#aaa', '#fff', 30, 6);
  chassis(ctx, team, t, xe === 'tethien' ? 'cloud' : 'tread');
  BODIES[xe]?.(ctx, t);
  if (GLOSS[xe]) gloss(ctx, ...GLOSS[xe]);
  if (SEATS[xe]) drawPilot(ctx, SEATS[xe][0], SEATS[xe][1], hair, team, t);
  ctx.restore();
}

// gender null = vehicle only, no pilot. The canvas is resized to its on-screen size × devicePixelRatio.
// fxT: pass a time to overlay the animal's signature effect (menus animate only the rider-on-xe picture)
export function drawPortrait(canvas, xe, team = 'A', angle = 40, hair, gender = 'm', pose = null, fxT = null) {
  const dpr = window.devicePixelRatio || 1;
  // size to the laid-out box × dpr; a canvas with no layout yet (hidden) keeps its size
  // (falling back to canvas.width × dpr here doubled a hidden canvas every frame and froze the room)
  if (canvas.clientWidth) {
    const cw = Math.round(canvas.clientWidth * dpr), ch = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
  }
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const sprite = xeSprite(xe, gender);
  if (sprite) {
    // leave headroom for the idle hop when animated
    const k = Math.min(canvas.width / sprite.width, canvas.height / sprite.height) * (pose ? 0.84 : 0.94);
    const w = sprite.width * k, h = sprite.height * k;
    if (!pose) {
      const px0 = (canvas.width - w) / 2, py0 = canvas.height - h;
      const moves = fxT !== null ? rigMotion(xe, fxT) : null;
      if (!(moves && drawRigged(ctx, sprite, xe, px0, py0, w, h, moves))) drawSmooth(ctx, sprite, px0, py0, w, h);
      if (fxT !== null) drawXeFx(ctx, xe, px0, py0, w, h, fxT, moves);
      return;
    }
    const u = canvas.height / 100;
    ctx.save();
    ctx.translate(canvas.width / 2 + (pose.dx || 0) * u, canvas.height - 2 * u + (pose.dy || 0) * u);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.ellipse(0, 0, w * 0.34 * (1 - (pose.dy || 0) * -0.02), 3 * u, 0, 0, P2); ctx.fill();
    ctx.rotate(pose.rot || 0);
    ctx.scale(pose.sx || 1, pose.sy || 1);
    drawSmooth(ctx, sprite, -w / 2, -h, w, h);
    ctx.restore();
    return;
  }
  const s = canvas.height / 80;
  drawXe(ctx, xe, { x: canvas.width / 2 - 2 * s, y: canvas.height - 5 * s, scale: 1.05 * s, team, angle, t: 0.3, hair });
}

// ---------- projectiles ----------

export const LOOKS = {
  fire: { c: '#ffd24a', g: '#ff6a00', r: 6, trail: '#ff8a2a', boom: ['#fff3a0', '#ffb030', '#ff5a10', '#8a2a00'] },
  crystal: { c: '#ffffff', g: '#6fe0ff', r: 5, trail: '#9fefff', boom: ['#ffffff', '#b9f4ff', '#6fe0ff', '#3a8aff'] },
  rainbow: { c: '#ffffff', g: '#ff7ad9', r: 6, trail: 'rainbow', boom: ['#ff5a7a', '#ffe74a', '#5ae07a', '#5ac8ff', '#a77aff'] },
  light: { c: '#ffffff', g: '#fff3a0', r: 8, trail: '#fff8c0', boom: ['#ffffff', '#fff6c4', '#ffe16a', '#ffc83a'] },
  shell: { c: '#ffe07a', g: '#b8860b', r: 7, trail: '#e0b040', boom: ['#fff3a0', '#ffcf3a', '#b8860b', '#5a3a10'] },
  goldshield: { c: '#fff3a0', g: '#ffcf3a', r: 6, trail: '#ffe16a', boom: ['#ffffff', '#ffe16a', '#ffcf3a', '#b8860b'] },
  bolt: { c: '#fff3a0', g: '#ffcf3a', r: 4, trail: '#ffe16a', shape: 'bolt', boom: ['#ffffff', '#ffe16a', '#ffcf3a', '#b8860b'] },
  feather: { c: '#ffe74a', g: '#ff5a1a', r: 5, trail: '#ff9a3a', shape: 'dart', boom: ['#fff3a0', '#ffb030', '#ff5a10', '#8a2a00'] },
  phoenix: { c: '#fff3a0', g: '#ff5a1a', r: 12, trail: '#ff7a1a', shape: 'bird', boom: ['#ffffff', '#ffd23a', '#ff5a10', '#a01a00'] },
  tusk: { c: '#fffbea', g: '#c8b890', r: 5, trail: '#d8d0b8', shape: 'dart', boom: ['#fffbea', '#d8b890', '#8a6a4a', '#4a3a2a'] },
  water: { c: '#e0f8ff', g: '#3aa8ff', r: 7, trail: '#6fc8ff', boom: ['#ffffff', '#b0e8ff', '#5ac8ff', '#1a6ad8'] },
  rock: { c: '#b0a090', g: '#6a5a4a', r: 8, trail: '#8a7a6a', boom: ['#e0d0b0', '#a08a6a', '#6a5a4a', '#3a2e24'] },
  quake: { c: '#b0a090', g: '#6a5a4a', r: 0, trail: '#8a7a6a' },
  ink: { c: '#3a1450', g: '#8e44ad', r: 7, trail: '#2a0a3a', boom: ['#b765d8', '#8e44ad', '#3a1450', '#10001a'] },
  tentacle: { c: '#b765d8', g: '#8e44ad', r: 9, trail: '#8e44ad', boom: ['#ffb0ff', '#b765d8', '#8e44ad', '#3a1450'] },
  poison: { c: '#b6ffcf', g: '#39e07a', r: 6, trail: '#39e07a', boom: ['#e0ffe8', '#7dff9a', '#39e07a', '#0a5a2a'] },
  claw: { c: '#39e07a', g: '#1d2b26', r: 6, trail: '#39e07a', boom: ['#b6ffcf', '#39e07a', '#1d6b3a', '#0a2a1a'] },
  sting: { c: '#e0ffe8', g: '#39e07a', r: 7, trail: '#7dff9a', shape: 'dart', boom: ['#ffffff', '#7dff9a', '#39e07a', '#0a5a2a'] },
  dart: { c: '#fff', g: '#ffe14a', r: 4, trail: '#fff8c0', shape: 'dart', boom: ['#ffffff', '#fff3a0', '#ffe14a', '#a07a30'] },
  eye: { c: '#fff', g: '#ffe14a', r: 6, trail: '#ffe14a', boom: ['#ffffff', '#ffe14a', '#ffa02a', '#7a5230'] },
  owl: { c: '#ffe14a', g: '#7a5230', r: 9, trail: '#ffe14a', shape: 'owl', boom: ['#ffffff', '#ffe14a', '#c9a277', '#5a3a20'] },
  dragon: { c: '#ffd24a', g: '#ff3a1a', r: 18, trail: '#ff5a1a', shape: 'dragon', boom: ['#ffffff', '#ffd23a', '#ff5a10', '#a01a00'] },
  drill: { c: '#ffb86a', g: '#b85a10', r: 6, trail: '#c8a080', shape: 'dart', boom: ['#ffe0b0', '#ffb86a', '#b85a10', '#4a2a10'] },
  fin: { c: '#8aa0b4', g: '#4a5c6e', r: 7, trail: '#c8b8a0', shape: 'fin', boom: ['#ffffff', '#b0c4d4', '#5b6f82', '#2a3a4a'] },
  jaw: { c: '#fff', g: '#5b6f82', r: 7, trail: '#8aa0b4', boom: ['#ffffff', '#e0d0b0', '#5b6f82', '#2a3a4a'] },
  banana: { c: '#ffe74a', g: '#c8a010', r: 7, trail: '#fff3a0', shape: 'banana', boom: ['#ffffff', '#ffe74a', '#ffb030', '#8a5a10'] },
  staff: { c: '#ffd700', g: '#c0392b', r: 5, trail: '#ffd700', shape: 'staff', boom: ['#ffffff', '#ffd700', '#ff5a3a', '#8a1a10'] },
  // Phượng's rebirth embers: gold and white, never Rồng's red
  ember: { c: '#fffbe0', g: '#ffd23a', r: 7, trail: '#fff3a0', boom: ['#ffffff', '#fff3a0', '#ffd23a', '#e09a00'] },
  cloud: { c: '#ffffff', g: '#ffe14a', r: 9, trail: '#ffffff', boom: ['#ffffff', '#fff8d0', '#ffe14a', '#c89a20'] },
  // Gấu Băng: powder snow, hard blue ice and a white-out blizzard
  snow: { c: '#ffffff', g: '#cfeaff', r: 7, trail: '#eaf6ff', boom: ['#ffffff', '#eaf6ff', '#bfe4ff', '#7fb8e0'] },
  ice: { c: '#e6fbff', g: '#6fd0ff', r: 7, trail: '#bff4ff', boom: ['#ffffff', '#bff4ff', '#6fd0ff', '#2a7fc0'] },
  blizzard: { c: '#ffffff', g: '#9fd8ff', r: 10, trail: '#ffffff', boom: ['#ffffff', '#e0f6ff', '#9fd8ff', '#4a90c8'] },
  // Cánh Cụt: frozen fish, a sliding board and ice billiard balls, all cyan
  fish: { c: '#bfe8ff', g: '#3aa8e0', r: 6, trail: '#9fe0ff', boom: ['#ffffff', '#bff4ff', '#3aa8e0', '#1a5a90'] },
  slide: { c: '#e6fbff', g: '#00c8ff', r: 7, trail: '#9fe0ff', boom: ['#ffffff', '#9fe0ff', '#00c8ff', '#0060a0'] },
  iceball: { c: '#ffffff', g: '#6fe0ff', r: 7, trail: '#bff4ff', boom: ['#ffffff', '#d8faff', '#6fe0ff', '#2a8fc0'] },
  // Thỏ Ngọc: pink mochi, the golden pestle and moonlight
  mochi: { c: '#fff0f6', g: '#ff9ac8', r: 8, trail: '#ffd0e6', boom: ['#ffffff', '#ffe0ef', '#ff9ac8', '#c05a8a'] },
  pestle: { c: '#fff3c0', g: '#e0a030', r: 6, trail: '#ffe14a', boom: ['#ffffff', '#fff3a0', '#e0a030', '#8a5a10'] },
  moon: { c: '#fffbe0', g: '#b8a8ff', r: 9, trail: '#fff3a0', boom: ['#ffffff', '#fff8d0', '#d8c8ff', '#7a60c8'] },
};

export function drawProjectile(ctx, look, x, y, vx, vy, t) {
  const L = LOOKS[look] || LOOKS.fire;
  if (!L.r) return;
  const ang = Math.atan2(vy, vx);
  const g = ctx.createRadialGradient(x, y, 0, x, y, L.r * 3);
  g.addColorStop(0, L.g + 'cc'); g.addColorStop(1, L.g + '00');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, L.r * 3, 0, P2); ctx.fill();
  ctx.save();
  ctx.translate(x, y);
  switch (L.shape) {
    case 'bolt':
      ctx.rotate(ang);
      ctx.fillStyle = L.c; ctx.fillRect(-16, -1.5, 18, 3);
      poly(ctx, [2, -5, 10, 0, 2, 5], '#fff');
      poly(ctx, [-16, -1.5, -20, -5, -14, -1.5], '#ffcf3a'); poly(ctx, [-16, 1.5, -20, 5, -14, 1.5], '#ffcf3a');
      break;
    case 'dart':
      ctx.rotate(ang);
      poly(ctx, [10, 0, -6, -4, -3, 0, -6, 4], L.c);
      ctx.fillStyle = L.g; ctx.fillRect(-10, -1, 6, 2);
      break;
    case 'staff':
      ctx.rotate(ang);
      ctx.fillStyle = '#c0392b'; ctx.fillRect(-60, -2.5, 64, 5);
      ctx.fillStyle = '#ffd700'; ctx.fillRect(-2, -3.5, 8, 7); ctx.fillRect(-62, -3.5, 6, 7);
      break;
    case 'banana':
      ctx.rotate(t * 14);
      ctx.beginPath(); ctx.arc(0, 0, 8, 0.3, Math.PI - 0.3); ctx.arc(0, -4, 7, Math.PI - 0.4, 0.4, true); ctx.closePath();
      ctx.fillStyle = L.c; ctx.fill();
      ctx.fillStyle = '#6a4a10'; ctx.fillRect(6, -2, 3, 3);
      break;
    case 'bird': {
      ctx.rotate(ang);
      const fl = Math.sin(t * 20) * 6;
      poly(ctx, [4, 0, -10, -16 - fl, -4, 0], '#ff7a1a');
      poly(ctx, [4, 0, -10, 16 + fl, -4, 0], '#ff7a1a');
      poly(ctx, [-6, 0, -26, -6, -22, 0, -26, 6], '#ff3a1a');
      ell(ctx, 0, 0, 10, 5, '#ffd23a');
      circ(ctx, 9, 0, 4, '#fff3a0');
      break;
    }
    case 'owl': {
      const fl = Math.sin(t * 24) * 5;
      poly(ctx, [0, -2, -14, -10 - fl, -6, 2], '#5a3a20');
      poly(ctx, [0, -2, 14, -10 - fl, 6, 2], '#5a3a20');
      circ(ctx, 0, 0, 7, '#7a5230');
      circ(ctx, -2.5, -1, 2.4, '#ffe14a'); circ(ctx, 2.5, -1, 2.4, '#ffe14a');
      poly(ctx, [-1, 2, 1, 2, 0, 5], '#e0a020');
      break;
    }
    case 'dragon': {
      // falling dragon head, facing down
      ctx.rotate(Math.PI / 2);
      ctx.scale(1.8, 1.8);
      for (let i = 0; i < 5; i++) circ(ctx, -20 - i * 12, Math.sin(t * 12 + i) * 5, 10 - i, i % 2 ? '#d8342a' : '#b8261f');
      ell(ctx, 0, 0, 18, 12, '#d8342a');
      ell(ctx, 12, 0, 12, 8, '#e2493d');
      poly(ctx, [-6, -10, -22, -22, -10, -6], '#f2d27a');
      poly(ctx, [-6, 10, -22, 22, -10, 6], '#f2d27a');
      circ(ctx, 2, -6, 3, '#ffe14a'); circ(ctx, 2, 6, 3, '#ffe14a');
      poly(ctx, [20, -5, 30, 0, 20, 5], '#fff3a0');
      break;
    }
    case 'fin':
      poly(ctx, [-8, 2, 0, -14, 8, 2], L.c);
      break;
    default:
      circ(ctx, 0, 0, L.r, L.g);
      circ(ctx, -L.r * 0.25, -L.r * 0.25, L.r * 0.6, L.c);
  }
  ctx.restore();
}

// ---------- Ổ Bọ Con: an animated baby scorpion, drawn in code so every part can move ----------
// state: 'fly' (curled into a ball, legs tucked), 'idle' (legs fidget, tail sways, claws snap now and then),
// 'walk' (legs step in turn), 'sting' (tail whips forward over its head; k = 0..1 through the strike).
// Facing right; (x, y) is where its feet touch the ground. size ≈ body length in px.
export function drawBabyScorpion(ctx, x, y, { t = 0, state = 'idle', k = 0, facing = 1, size = 34, rot = 0, seed = 0 } = {}) {
  const u = size / 40, INK = '#0b1633', SHELL = '#1e4a3b', SHELL_HI = '#2f7a5c', RIM = '#6dffa6', GLOW = '#5dff9a';
  const ph = t + seed * 1.7, fly = state === 'fly', walk = state === 'walk', sting = state === 'sting';
  const outlined = (path, fill, lw = 2.4) => { ctx.fillStyle = fill; ctx.fill(path); ctx.strokeStyle = INK; ctx.lineWidth = lw; ctx.stroke(path); };
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(facing * u, u);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const bob = walk ? Math.abs(Math.sin(ph * 16)) * 1.5 : Math.sin(ph * 2.4) * 0.5;
  if (!fly) { ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(0, 1, 19, 3.5, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.translate(0, fly ? 0 : -bob);
  // legs: 3 per side; near side drawn after the body, far side before it
  // legs hang under the belly: attach at the underside, a knee bent outward, the foot on the ground
  const leg = (i, near) => {
    const bx = -10 + i * 7 + (near ? 1.5 : -1.5), by = -3.5;
    const step = fly ? 0 : walk ? Math.sin(ph * 16 + i * 2.1 + (near ? 0 : Math.PI)) : Math.sin(ph * 2.5 + i * 1.3) * 0.15;
    const kx = bx + (i - 1) * 2.5 + step * 2, ky = fly ? by + 1 : -5.5 - Math.max(0, step) * 2.5;
    const fx = bx + (i - 1) * 5 + (fly ? 0 : step * 4), fy = fly ? by + 3 : 0;
    const path = new Path2D(); path.moveTo(bx, by); path.lineTo(kx, ky); path.lineTo(fx, fy);
    ctx.strokeStyle = INK; ctx.lineWidth = 5.2; ctx.stroke(path);
    ctx.strokeStyle = near ? SHELL_HI : SHELL; ctx.lineWidth = 2.6; ctx.stroke(path);
  };
  for (let i = 0; i < 3; i++) { leg(i, false); leg(i, true); }
  // tail: five segments that rise from the rear and curl FORWARD over the back (a scorpion's C shape)
  // a strike whips the tail over the head, and the body leans into it
  const strike = sting ? Math.sin(Math.min(1, k) * Math.PI) : 0;
  if (strike) { ctx.translate(strike * 3, 0); ctx.rotate(strike * 0.12); }
  const curl = fly ? 0.95 : sting ? 0.62 + strike * 0.75 : 0.62 + Math.sin(ph * 2) * 0.05;
  let tx = -14, ty = -10, ang = -Math.PI * 0.72;
  const segs = [];
  for (let i = 0; i < 5; i++) { const len = 7.2 - i * 0.5; tx += Math.cos(ang) * len; ty += Math.sin(ang) * len; segs.push([tx, ty, 5.2 - i * 0.55]); ang += curl * 0.6; }
  for (const [sx, sy, r] of segs) { const pp = new Path2D(); pp.arc(sx, sy, r, 0, Math.PI * 2); outlined(pp, SHELL, 2.2); ctx.fillStyle = 'rgba(109,255,166,0.5)'; ctx.beginPath(); ctx.arc(sx - r * 0.3, sy - r * 0.35, r * 0.35, 0, Math.PI * 2); ctx.fill(); }
  // venom bulb + curved barb pointing down-forward, with a pulsing glow (bright during a strike)
  const [lx, ly] = segs[segs.length - 1], bx = lx + Math.cos(ang) * 5, by = ly + Math.sin(ang) * 5;
  const hot = sting ? Math.sin(Math.min(1, k) * Math.PI) : 0.35 + 0.25 * Math.sin(ph * 4);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(bx, by, 0, bx, by, 12);
  g.addColorStop(0, `rgba(93,255,154,${0.5 * hot + 0.25})`); g.addColorStop(1, 'rgba(93,255,154,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx, by, 12, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  const bulb = new Path2D(); bulb.arc(bx, by, 4.4, 0, Math.PI * 2); outlined(bulb, GLOW, 2);
  const barb = new Path2D(), ba = ang + 0.9;
  barb.moveTo(bx + Math.cos(ba - 1.4) * 3.5, by + Math.sin(ba - 1.4) * 3.5);
  barb.quadraticCurveTo(bx + Math.cos(ba) * 7, by + Math.sin(ba) * 7, bx + Math.cos(ba + 0.5) * 10, by + Math.sin(ba + 0.5) * 10);
  barb.lineTo(bx + Math.cos(ba + 1.4) * 3.5, by + Math.sin(ba + 1.4) * 3.5); barb.closePath();
  outlined(barb, '#e8fff0', 1.8);
  // body: a chunky segmented shell with a bright rim light
  const body = new Path2D(); body.ellipse(-3, -9, 14, 7.5, 0, 0, Math.PI * 2); outlined(body, SHELL, 2.6);
  ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
  for (const sx of [-10, -4, 2]) { ctx.beginPath(); ctx.moveTo(sx, -15.5); ctx.quadraticCurveTo(sx + 1.5, -9, sx, -2.5); ctx.stroke(); }
  ctx.strokeStyle = RIM; ctx.lineWidth = 1.6; ctx.globalAlpha = 0.7;
  ctx.beginPath(); ctx.ellipse(-3, -9, 11.5, 5, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); ctx.globalAlpha = 1;
  // claws: rounded pincers that open, then snap shut every few seconds (or pump while walking)
  const open = walk ? 0.5 + 0.5 * Math.sin(ph * 10) : sting ? 0.15 : ((ph * 0.7 + seed) % 3.2) < 0.18 ? 0.05 : 0.75;
  for (const [cy, far] of [[-5, true], [-10, false]]) {
    ctx.globalAlpha = far ? 0.75 : 1;
    const arm = new Path2D(); arm.moveTo(12, cy); arm.lineTo(18, cy - 3);
    ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.stroke(arm); ctx.strokeStyle = SHELL_HI; ctx.lineWidth = 2.6; ctx.stroke(arm);
    const hx = 19 + (walk ? Math.sin(ph * 16) : 0), hy = cy - 3;
    const palm = new Path2D(); palm.ellipse(hx + 2, hy, 4.2, 3.4, 0, 0, Math.PI * 2); outlined(palm, SHELL_HI, 2);
    for (const sgn of [-1, 1]) {
      const f = new Path2D(); f.moveTo(hx + 4, hy + sgn * 1);
      f.quadraticCurveTo(hx + 8, hy + sgn * (2 + open * 3), hx + 10, hy + sgn * open * 1.2);
      f.quadraticCurveTo(hx + 7, hy + sgn * 0.5, hx + 4, hy + sgn * 1); outlined(f, SHELL_HI, 1.6);
    }
  }
  ctx.globalAlpha = 1;
  // head: big chibi head with two large glowing eyes that blink
  const head = new Path2D(); head.ellipse(11, -10, 6.6, 6, 0, 0, Math.PI * 2); outlined(head, SHELL_HI, 2.4);
  const blink = ((ph * 0.8 + seed) % 3) < 0.12 ? 0.2 : 1;
  for (const ex of [10, 14]) {
    ctx.fillStyle = GLOW; ctx.beginPath(); ctx.ellipse(ex, -11, 1.9, 2.4 * blink, 0, 0, Math.PI * 2); ctx.fill();
    if (blink > 0.5) { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(ex + 0.6, -12, 0.7, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.restore();
}

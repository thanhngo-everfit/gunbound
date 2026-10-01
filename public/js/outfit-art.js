// Hats and glasses drawn in code on each base pilot's measured head, so they fit like Gunbound avatar items:
// the head is seen three-quarters from the right, so hat bands are ellipses in that perspective, with a BACK layer
// drawn before the pilot (it disappears behind the head) and a FRONT layer after it. Glasses sit on the two
// measured eyes (the far lens narrower) with an arm back to the ear. Outline width matches the pilot's ink.
//
// head geometry g (pixels): { cx, by (brim / hairline y), rx (half head width), top (skull top y), lw (outline) }
// eye geometry e (pixels): { nx, ny (near eye), fx, fy (far eye), ex, ey (ear), r (lens radius), lw }

const INK = '#1a1410';
const P2 = Math.PI * 2;

function outlined(ctx, lw, fill, path) {
  ctx.beginPath(); path(); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke();
}
const shade = (ctx, x0, y0, x1, y1, a, b) => { const gr = ctx.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, a); gr.addColorStop(1, b); return gr; };
// point on the band ellipse at angle t (0 = right/front side, PI/2 = nearest the viewer, PI = back-left)
const onBand = (g, t, lift = 0) => [g.cx + g.rx * Math.cos(t), g.by - lift + g.ry * Math.sin(t)];

// ---------- hats ----------
const HATS = {
  // 1 Nón Lá: a wide palm-leaf cone over the head, ribs fanning out
  1(ctx, g, layer) {
    const R = g.rx * 1.55, ry = g.ry * 1.35, apexY = g.top - g.rx * 0.6, cx = g.cx + g.rx * 0.05, by = g.by - g.rx * 0.12;
    if (layer === 'back') {
      // the far rim shows above the shoulders behind the head
      outlined(ctx, g.lw, '#c9a560', () => ctx.ellipse(cx, by, R, ry, 0, Math.PI, P2));
      return;
    }
    outlined(ctx, g.lw, shade(ctx, cx - R, apexY, cx + R, by, '#f4dca0', '#c7a259'), () => {
      ctx.moveTo(cx, apexY);
      ctx.lineTo(cx + R, by);
      ctx.ellipse(cx, by, R, ry, 0, 0, Math.PI);
    });
    ctx.strokeStyle = 'rgba(120,80,30,0.55)'; ctx.lineWidth = g.lw * 0.6;
    for (let i = 1; i < 8; i++) { const t = (i / 8) * Math.PI, [x, y] = [cx + R * Math.cos(t), by + ry * Math.sin(t)]; ctx.beginPath(); ctx.moveTo(cx, apexY); ctx.lineTo(x, y); ctx.stroke(); }
  },
  // 2 Vương Miện: a gold band hugging the head with five points; the back points peek out behind
  2(ctx, g, layer) {
    const hb = g.rx * 0.4, spike = g.rx * 0.62, n = 5;
    const band = (from, to, col) => outlined(ctx, g.lw, col, () => {
      for (let i = 0; i <= 24; i++) { const t = from + ((to - from) * i) / 24, [x, y] = onBand(g, t); ctx.lineTo(x, y); }
      for (let i = 24; i >= 0; i--) { const t = from + ((to - from) * i) / 24, [x, y] = onBand(g, t, hb); ctx.lineTo(x, y); }
    });
    const spikes = (from, to, col, ball) => {
      for (let i = 0; i < n; i++) {
        const t = from + ((to - from) * (i + 0.5)) / n, w = ((to - from) / n) * 0.42;
        const [x0, y0] = onBand(g, t - w, hb), [x1, y1] = onBand(g, t + w, hb), [xm, ym] = onBand(g, t, hb);
        const tip = ym - spike * (0.75 + 0.25 * Math.abs(Math.sin(t)));
        outlined(ctx, g.lw, col, () => { ctx.moveTo(x0, y0); ctx.lineTo(xm, tip); ctx.lineTo(x1, y1); });
        outlined(ctx, g.lw * 0.8, ball, () => ctx.arc(xm, tip, g.rx * 0.07, 0, P2));
      }
    };
    if (layer === 'back') { spikes(Math.PI, P2, '#c8961e', '#d9a826'); band(Math.PI, P2, '#b98a1a'); return; }
    band(0, Math.PI, shade(ctx, g.cx - g.rx, 0, g.cx + g.rx, 0, '#f2c43a', '#ffe68a'));
    spikes(0, Math.PI, '#ffd23a', '#ffe68a');
    // jewels along the front of the band
    for (const t of [0.75, 1.55, 2.35]) { const [x, y] = onBand(g, t, hb * 0.5); outlined(ctx, g.lw * 0.7, '#d4202a', () => { ctx.moveTo(x, y - hb * 0.3); ctx.lineTo(x + hb * 0.22, y); ctx.lineTo(x, y + hb * 0.3); ctx.lineTo(x - hb * 0.22, y); }); }
  },
  // 3 Mũ Phù Thuỷ: a wide brim around the head and a tall bent cone with stars
  3(ctx, g, layer) {
    const R = g.rx * 1.45, ry = g.ry * 1.25;
    if (layer === 'back') { outlined(ctx, g.lw, '#4a2a8a', () => ctx.ellipse(g.cx, g.by, R, ry, 0, Math.PI, P2)); return; }
    const baseL = onBand(g, Math.PI * 0.98), baseR = onBand(g, 0.02), apex = [g.cx - g.rx * 0.55, g.top - g.rx * 1.35];
    outlined(ctx, g.lw, shade(ctx, baseL[0], 0, baseR[0], 0, '#6a3cc0', '#8f5ae0'), () => {
      ctx.moveTo(baseL[0], baseL[1]);
      ctx.quadraticCurveTo(g.cx - g.rx * 0.6, g.top - g.rx * 0.2, apex[0], apex[1]);
      ctx.quadraticCurveTo(g.cx + g.rx * 0.05, g.top - g.rx * 0.55, g.cx + g.rx * 0.2, g.top - g.rx * 0.95);
      ctx.quadraticCurveTo(g.cx + g.rx * 0.45, g.top - g.rx * 0.1, baseR[0], baseR[1]);
    });
    outlined(ctx, g.lw, shade(ctx, g.cx - R, 0, g.cx + R, 0, '#5b31a8', '#7c4cd0'), () => ctx.ellipse(g.cx, g.by, R, ry, 0, 0, Math.PI));
    ctx.fillStyle = '#ffd23a';
    for (const [fx, fy, s] of [[-0.25, -0.35, 0.13], [0.15, -0.7, 0.1], [-0.42, -0.95, 0.08]]) star(ctx, g.cx + g.rx * fx, g.top + g.rx * fy, g.rx * s, g.lw * 0.6);
  },
  // 4 Mũ Cướp Biển: a black tricorn with upturned sides, gold trim and a skull
  4(ctx, g, layer) {
    if (layer === 'back') return;
    const w = g.rx * 1.25, top = g.top - g.rx * 0.45;
    outlined(ctx, g.lw, '#22222a', () => {
      ctx.moveTo(g.cx - w, g.by - g.rx * 0.05);
      ctx.quadraticCurveTo(g.cx - w * 1.05, top + g.rx * 0.1, g.cx - w * 0.55, top + g.rx * 0.2);
      ctx.quadraticCurveTo(g.cx, top - g.rx * 0.35, g.cx + w * 0.55, top + g.rx * 0.2);
      ctx.quadraticCurveTo(g.cx + w * 1.05, top + g.rx * 0.1, g.cx + w, g.by - g.rx * 0.05);
      ctx.quadraticCurveTo(g.cx, g.by + g.ry * 0.9, g.cx - w, g.by - g.rx * 0.05);
    });
    ctx.strokeStyle = '#e8b630'; ctx.lineWidth = g.lw * 1.1;
    ctx.beginPath(); ctx.moveTo(g.cx - w * 0.92, g.by - g.rx * 0.08); ctx.quadraticCurveTo(g.cx, g.by + g.ry * 0.7, g.cx + w * 0.92, g.by - g.rx * 0.08); ctx.stroke();
    // skull and crossbones
    const sx = g.cx + g.rx * 0.05, sy = top + g.rx * 0.42, s = g.rx * 0.2;
    ctx.strokeStyle = '#f4f4f4'; ctx.lineWidth = g.lw * 1.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(sx - s * 1.2, sy + s * 1.3); ctx.lineTo(sx + s * 1.2, sy + s * 0.2); ctx.moveTo(sx + s * 1.2, sy + s * 1.3); ctx.lineTo(sx - s * 1.2, sy + s * 0.2); ctx.stroke();
    outlined(ctx, g.lw * 0.7, '#f4f4f4', () => ctx.arc(sx, sy, s * 0.75, 0, P2));
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(sx - s * 0.28, sy, s * 0.17, 0, P2); ctx.arc(sx + s * 0.28, sy, s * 0.17, 0, P2); ctx.fill();
  },
  // 5 Mũ Len Tai Mèo: a knitted beanie covering the top of the head, ribbed cuff, cat ears
  5(ctx, g, layer) {
    if (layer === 'back') return;
    const cuff = g.rx * 0.3, dome = (g.by - g.top) * 1.5 + g.rx * 0.2;
    const ty = g.by - dome * 0.7; // the dome's crown, where the ears stand
    const ear = (ex, s) => {
      outlined(ctx, g.lw, '#f2a06a', () => { ctx.moveTo(ex - g.rx * 0.28 * s, ty + g.rx * 0.18); ctx.lineTo(ex - g.rx * 0.05 * s, ty - g.rx * 0.42 * s); ctx.lineTo(ex + g.rx * 0.22 * s, ty + g.rx * 0.12); });
      ctx.fillStyle = '#ffb8c8'; ctx.beginPath(); ctx.moveTo(ex - g.rx * 0.16 * s, ty + g.rx * 0.12); ctx.lineTo(ex - g.rx * 0.05 * s, ty - g.rx * 0.22 * s); ctx.lineTo(ex + g.rx * 0.1 * s, ty + g.rx * 0.1); ctx.fill();
    };
    ear(g.cx - g.rx * 0.5, 1.35); ear(g.cx + g.rx * 0.45, 1.15);
    outlined(ctx, g.lw, shade(ctx, g.cx - g.rx, g.top, g.cx + g.rx, g.by, '#ffbe8a', '#ec8e58'), () => {
      const [l] = onBand(g, Math.PI), [r] = onBand(g, 0);
      ctx.moveTo(l - g.rx * 0.04, g.by - cuff);
      ctx.bezierCurveTo(l - g.rx * 0.02, g.by - dome, r + g.rx * 0.02, g.by - dome, r + g.rx * 0.04, g.by - cuff);
      ctx.ellipse(g.cx, g.by - cuff, g.rx * 1.04, g.ry, 0, 0, Math.PI);
    });
    outlined(ctx, g.lw, '#e98a55', () => { for (let i = 0; i <= 24; i++) { const [x, y] = onBand(g, (i / 24) * Math.PI, 0); ctx.lineTo(x + (x - g.cx) * 0.06, y + g.rx * 0.02); } for (let i = 24; i >= 0; i--) { const [x, y] = onBand(g, (i / 24) * Math.PI, cuff); ctx.lineTo(x + (x - g.cx) * 0.06, y); } });
    ctx.strokeStyle = 'rgba(150,70,30,0.6)'; ctx.lineWidth = g.lw * 0.55;
    for (let i = 1; i < 12; i++) { const t = (i / 12) * Math.PI, [x, y] = onBand(g, t, 0); ctx.beginPath(); ctx.moveTo(x + (x - g.cx) * 0.06, y); ctx.lineTo(x + (x - g.cx) * 0.06, y - cuff * 0.9); ctx.stroke(); }
  },
};

function star(ctx, x, y, r, lw) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill();
  if (lw) { ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.stroke(); }
}

// ---------- glasses ----------
// lens shapes around a centre (x, y) with half-width w (the far lens is narrower)
const LENS = {
  aviator: (ctx, x, y, w) => { ctx.moveTo(x - w, y - w * 0.55); ctx.quadraticCurveTo(x, y - w * 0.75, x + w, y - w * 0.55); ctx.quadraticCurveTo(x + w * 1.05, y + w * 0.75, x + w * 0.1, y + w * 0.85); ctx.quadraticCurveTo(x - w * 1.05, y + w * 0.75, x - w, y - w * 0.55); },
  heart: (ctx, x, y, w) => { ctx.moveTo(x, y + w * 0.9); ctx.bezierCurveTo(x - w * 1.5, y - w * 0.1, x - w * 0.6, y - w * 1.2, x, y - w * 0.35); ctx.bezierCurveTo(x + w * 0.6, y - w * 1.2, x + w * 1.5, y - w * 0.1, x, y + w * 0.9); },
  round: (ctx, x, y, w) => ctx.ellipse(x, y, w, w * 0.95, 0, 0, P2),
  rect: (ctx, x, y, w) => ctx.rect(x - w, y - w * 0.55, w * 2, w * 1.1),
};
const GLASSES = {
  1: { lens: 'aviator', fill: ['#2b2f38', '#5a6270'], frame: '#d8a630', shine: true },
  2: { lens: 'heart', fill: ['#ff7ab5', '#ff3f8f'], frame: '#ff3f8f', shine: true },
  3: { pixel: true },
  4: { lens: 'round', fill: ['rgba(200,235,255,0.35)', 'rgba(150,210,255,0.45)'], frame: '#d8a630', shine: true },
  5: { lens: 'rect', fill: null, frame: '#f4f4f4', threeD: true },
};

export function drawGlasses(ctx, n, e) {
  const G = GLASSES[n];
  if (!G) return;
  const lw = e.lw, rn = e.r * 1.15, rf = e.r * 0.95;
  // the arm runs back from the near lens to the ear
  ctx.strokeStyle = G.pixel ? INK : G.frame; ctx.lineWidth = lw * 1.3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(e.nx - rn, e.ny - rn * 0.2); ctx.lineTo(e.ex, e.ey); ctx.stroke();
  ctx.strokeStyle = INK; ctx.lineWidth = lw * 0.5; ctx.stroke();
  if (G.pixel) {
    // "deal with it" pixel shades: stepped black blocks with white glints
    const px = rn * 0.36;
    const block = (x, y, cols, rows) => { ctx.fillStyle = INK; for (let r = 0; r < rows.length; r++) for (let c = 0; c < cols; c++) if (rows[r][c] === '1') ctx.fillRect(x + c * px, y + r * px, px + 0.5, px + 0.5); };
    const lens = ['111111', '111111', '011110'], bridge = ['111'];
    const y = e.ny - px * 1.2;
    block(e.nx - px * 3, y, 6, lens); block(e.fx - px * 2.6, e.fy - px * 1.2, 6, lens);
    block(e.nx + px * 2.8, y, 3, bridge);
    ctx.fillStyle = '#ffffff'; for (const [x, yy] of [[e.nx - px * 2, y + px], [e.fx - px * 1.6, e.fy - px * 0.2]]) { ctx.fillRect(x, yy, px, px); ctx.fillRect(x + px, yy - px, px, px); }
    return;
  }
  // bridge between the lenses
  ctx.strokeStyle = G.frame; ctx.lineWidth = lw * 1.4;
  ctx.beginPath(); ctx.moveTo(e.nx + rn * 0.9, e.ny - rn * 0.1); ctx.quadraticCurveTo((e.nx + e.fx) / 2, e.ny - rn * 0.45, e.fx - rf * 0.9, e.fy - rf * 0.1); ctx.stroke();
  if (G.threeD) {
    // a white card band with a red and a cyan lens
    outlined(ctx, lw, '#f4f4f4', () => { ctx.rect(e.nx - rn * 1.25, e.ny - rn * 0.8, (e.fx - e.nx) + rn * 1.25 + rf * 1.2, rn * 1.6); });
    outlined(ctx, lw * 0.7, '#e8343c', () => LENS.rect(ctx, e.nx, e.ny, rn * 0.85));
    outlined(ctx, lw * 0.7, '#2fb4e8', () => LENS.rect(ctx, e.fx, e.fy, rf * 0.85));
    return;
  }
  for (const [x, y, w] of [[e.nx, e.ny, rn], [e.fx, e.fy, rf]]) {
    ctx.beginPath(); LENS[G.lens](ctx, x, y, w); ctx.closePath();
    ctx.fillStyle = shade(ctx, x, y - w, x, y + w, G.fill[0], G.fill[1]); ctx.fill();
    ctx.lineWidth = lw * 2.2; ctx.strokeStyle = INK; ctx.stroke();
    ctx.lineWidth = lw * 1.2; ctx.strokeStyle = G.frame; ctx.stroke();
    if (G.shine) { ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.ellipse(x - w * 0.35, y - w * 0.25, w * 0.22, w * 0.13, -0.6, 0, P2); ctx.fill(); }
  }
}

export function drawHat(ctx, n, g, layer) { HATS[n]?.(ctx, g, layer); }

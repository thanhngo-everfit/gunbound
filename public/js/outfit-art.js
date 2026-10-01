// Glasses drawn in code on each base pilot's measured eyes (the far lens narrower, an arm back to the ear), in the
// pilot's own ink width. (Hats were drawn here too, and removed 2026-10-01: they still looked stuck on, and the head
// slot became the hairstyle.)
//
// eye geometry e (pixels): { nx, ny (near eye), fx, fy (far eye), ex, ey (ear), r (lens radius), lw }

const INK = '#1a1410';
const P2 = Math.PI * 2;

function outlined(ctx, lw, fill, path) {
  ctx.beginPath(); path(); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke();
}
const shade = (ctx, x0, y0, x1, y1, a, b) => { const gr = ctx.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, a); gr.addColorStop(1, b); return gr; };

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


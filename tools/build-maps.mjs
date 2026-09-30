// Builds the destructible-terrain masks from the painted terrain images.
// Run after changing public/assets/maps/terrain-*.jpg:  node tools/build-maps.mjs
// Output: public/assets/maps/mask-<map>.bin (deflated, one byte per world pixel, 1 = ground).
import fs from 'node:fs';
import zlib from 'node:zlib';
import jpeg from 'jpeg-js';
import { W, H } from '../shared/physics.js';

// Which flat background colour each painting was drawn on.
const MAPS = { 'dong-co': 'magenta', 'sa-mac': 'magenta', 'bang-gia': 'green', 'nui-lua': 'green' };

for (const [id, key] of Object.entries(MAPS)) {
  const img = jpeg.decode(fs.readFileSync(`public/assets/maps/terrain-${id}.jpg`), { useTArray: true });
  // the painting spans the full world width and sits on the bottom edge
  const oy = H - img.height;
  const mask = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    const sy = y - oy;
    if (sy < 0 || sy >= img.height) continue;
    for (let x = 0; x < W && x < img.width; x++) {
      const o = (sy * img.width + x) * 4;
      const r = img.data[o], g = img.data[o + 1], b = img.data[o + 2];
      const k = key === 'green' ? g - Math.max(r, b) : Math.min(r, b) - g;
      if (k < 70) mask[y * W + x] = 1;
    }
  }
  // drop specks of JPEG noise left floating in the background (tiny solid islands)
  const seen = new Uint8Array(W * H);
  let removed = 0;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || seen[i]) continue;
    const comp = [i]; seen[i] = 1;
    for (let c = 0; c < comp.length && comp.length <= 400; c++) {
      const j = comp[c], x = j % W, y = (j / W) | 0;
      for (const n of [x > 0 ? j - 1 : -1, x < W - 1 ? j + 1 : -1, y > 0 ? j - W : -1, y < H - 1 ? j + W : -1]) {
        if (n >= 0 && mask[n] && !seen[n]) { seen[n] = 1; comp.push(n); }
      }
    }
    if (comp.length <= 400) { for (const j of comp) mask[j] = 0; removed += comp.length; }
    else {
      // big component: finish marking it so we don't walk it again
      for (let c = 0; c < comp.length; c++) {
        const j = comp[c], x = j % W, y = (j / W) | 0;
        for (const n of [x > 0 ? j - 1 : -1, x < W - 1 ? j + 1 : -1, y > 0 ? j - W : -1, y < H - 1 ? j + W : -1]) {
          if (n >= 0 && mask[n] && !seen[n]) { seen[n] = 1; comp.push(n); }
        }
      }
    }
  }
  const solid = mask.reduce((a, v) => a + v, 0);
  const out = zlib.deflateSync(mask, { level: 9 });
  fs.writeFileSync(`public/assets/maps/mask-${id}.bin`, out);
  console.log(id, `${img.width}x${img.height}`, 'ground', ((solid / mask.length) * 100).toFixed(1) + '%', 'specks removed', removed, 'bytes', out.length);
}

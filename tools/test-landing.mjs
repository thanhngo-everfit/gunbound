// Stress test: 400 random Ổ Bọ Con shots on the real painted maps; no baby may end up inside rock or under a ledge (run: node tools/test-landing.mjs).
import fs from 'node:fs'; import zlib from 'node:zlib';
import { registerMask, genTerrain, simulateShot, spawnPositions, mulberry32, MAP_IDS, W } from '../shared/physics.js';
import { XE } from '../shared/xe.js';
let bad = 0, total = 0, samples = [];
for (const id of MAP_IDS) {
  try { registerMask(id, new Uint8Array(zlib.inflateSync(fs.readFileSync(new URL(`../public/assets/maps/mask-${id}.bin`, import.meta.url))))); } catch { continue; }
  const rand = mulberry32(7);
  for (let n = 0; n < 100; n++) {
    const mask = genTerrain(n, id, n % 2 === 1);
    const spots = spawnPositions(mask, 2, rand);
    const me = { id: 'me', x: spots[0].x, y: spots[0].y, team: 'A', xe: 'bocap', facing: spots[1].x > spots[0].x ? 1 : -1, hp: 1000, maxHp: 1000, armor: 0, alive: true };
    const e = { id: 'e', x: spots[1].x, y: spots[1].y, team: 'B', xe: 'rong', facing: -me.facing, hp: 1150, maxHp: 1150, armor: 0, alive: true };
    const r = simulateShot({ mask, tanks: [me, e], wind: { s: Math.floor(rand() * 20), a: Math.floor(rand() * 360) }, shooter: me, angle: 10 + Math.floor(rand() * 40), power: 30 + Math.floor(rand() * 70), shotKey: 's2' });
    for (const m of r.minions) {
      total++;
      const ok = mask[m.y * W + m.x] && !mask[(m.y - 3) * W + m.x] && !mask[(m.y - 20) * W + m.x];
      if (!ok) { bad++; if (samples.length < 5) samples.push([id, n, m.x, m.y]); }
    }
  }
}
console.log((bad ? 'FAIL ' : 'PASS ') + `minions placed: ${total}, inside rock / not standing: ${bad}`, JSON.stringify(samples));

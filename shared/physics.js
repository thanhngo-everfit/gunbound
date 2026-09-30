// Terrain, movement and shot simulation. Pure JS, runs on both server (authoritative) and client (terrain painting).
import { XE } from './xe.js';

export const W = 2400, H = 1100;
export const WATER_Y = H - 40;
// Damage tuning (design review 2026-09-30): grazes hurt less, direct hits and high-angle lobs are rewarded.
export const MIN_SPLASH = 0.18, DIRECT_HIT = 1.15, HIGH_ANGLE = 70, HIGH_ANGLE_MUL = 1.1;
export const G = 0.18, VMAX = 21;
// Gunbound wind: a strength 0-26 blowing in any direction (0° = right, 90° = up), so it also pushes shells up or down.
export const WIND_MAX = 26, WIND_K = 0.0016;
export const windVec = w => (typeof w === 'number' ? { x: w * 2.6, y: 0 } : { x: Math.cos((w.a * Math.PI) / 180) * w.s, y: -Math.sin((w.a * Math.PI) / 180) * w.s });
// Gunbound wind (checked against match footage): each match rolls its own base wind, calm or strong.
// It then holds for several turns and only now and then nudges: strength +-1-2, direction a few tens of degrees.
export const rollWind = (rand = Math.random) => ({ s: Math.round(rand() ** 1.2 * WIND_MAX), a: Math.floor(rand() * 360) });
export const WIND_CHANGE_CHANCE = 0.35;

// ---------- weather (Gunbound-style queue) ----------
// A 5-slot queue: [just passed, ACTIVE, next, next, next]. The active weather lives for a few turns at a
// random x, then fades out and the queue slides left; a new random weather enters on the right.
export const WEATHERS = {
  clear: { name: 'Trời quang', weight: 4, turns: [1, 2] },
  // Gunbound tornado: a narrow twisted white column the full height of the map
  tornado: { name: 'Lốc xoáy', weight: 3, turns: [2, 3], half: 38 },
  // Gunbound lightning: a narrow electric beam; a shell that flies through it is electrified,
  // and where that shell lands a bolt strikes from the sky down to the first ground it meets
  thunder: { name: 'Sấm sét', weight: 3, turns: [2, 3], half: 30, dmg: 120, r: 38, maxStrikes: 3 },
};
export function rollWeatherType(rand = Math.random) {
  const ids = Object.keys(WEATHERS), total = ids.reduce((a, id) => a + WEATHERS[id].weight, 0);
  let k = rand() * total;
  for (const id of ids) if ((k -= WEATHERS[id].weight) < 0) return id;
  return 'clear';
}
export function activateWeather(w, rand = Math.random) {
  const type = w.queue[1], def = WEATHERS[type];
  w.seq = (w.seq || 0) + 1;
  w.active = { type, id: w.seq, x: Math.round(260 + rand() * (W - 520)) };
  // a tornado spins one way (+1 = throws right, -1 = throws left) for its whole life
  if (type === 'tornado') w.active.dir = rand() < 0.5 ? -1 : 1;
  w.turnsLeft = def.turns[0] + Math.floor(rand() * (def.turns[1] - def.turns[0] + 1));
  return w;
}
export function newWeather(rand = Math.random) {
  return activateWeather({ queue: ['clear', 'clear', rollWeatherType(rand), rollWeatherType(rand), rollWeatherType(rand)] }, rand);
}
// Call once per new turn (after the first). Returns true when the active weather changed.
export function advanceWeather(w, rand = Math.random) {
  if (--w.turnsLeft > 0) return false;
  w.queue.shift();
  w.queue.push(rollWeatherType(rand));
  activateWeather(w, rand);
  return true;
}
export function driftWind(w, rand = Math.random) {
  if (rand() >= WIND_CHANGE_CHANCE) return w;
  const ds = Math.round((rand() * 2 - 1) * 2);
  const da = Math.round((rand() * 2 - 1) * 40);
  return { s: Math.max(0, Math.min(WIND_MAX, w.s + ds)), a: (((w.a + da) % 360) + 360) % 360 };
}
// Hitbox is a circle of radius TANK_R centred TANK_CY above the feet; shots launch from PIVOT height.
export const TANK_R = 22, TANK_CY = 28, PIVOT = 32, BARREL = 30;
const MAX_FRAMES = 1800;
// Shots are simulated at 60 steps/s but replayed slower so flights read like Gunbound (about 2-3 s for a high lob).
export const REPLAY_SPEED = 0.62;
// Frames of simulation time the SS cut-in holds the shot before it leaves the barrel.
export const SS_DELAY_FRAMES = 50;
// How long (ms) a shot takes to watch on the client, cut-in included.
export const replayMs = (frames, ss) => ((frames + (ss ? SS_DELAY_FRAMES : 0)) / (60 * REPLAY_SPEED)) * 1000;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r1 = v => Math.round(v * 10) / 10;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const MAPS = {
  'dong-co': { name: 'Đồng Cỏ', rough: 1.0, chasms: 1, islands: 2, caves: 2 },
  'sa-mac': { name: 'Sa Mạc', rough: 0.7, chasms: 0, islands: 1, caves: 1 },
  'bang-gia': { name: 'Băng Giá', rough: 1.1, chasms: 2, islands: 4, caves: 1 },
  'nui-lua': { name: 'Núi Lửa', rough: 1.2, chasms: 1, islands: 1, caves: 3, volcano: true },
};
export const MAP_IDS = Object.keys(MAPS);

// ---------- terrain ----------

// Painted maps: masks built from the terrain paintings (tools/build-maps.mjs), registered at startup
// by the server (from disk) and the client (fetched). Maps without one fall back to procedural terrain.
const PAINTED = {};
export function registerMask(mapId, mask) { if (mask && mask.length === W * H) PAINTED[mapId] = mask; }
export const hasPainted = mapId => !!PAINTED[mapId];

export function genTerrain(seed, mapId, mirror = false) {
  if (PAINTED[mapId]) {
    const m = PAINTED[mapId].slice();
    if (mirror) for (let y = 0; y < H; y++) m.subarray(y * W, y * W + W).reverse();
    return m;
  }
  const m = MAPS[mapId] || MAPS['dong-co'];
  const R = mulberry32(seed ^ 0x9e3779b9);
  const mask = new Uint8Array(W * H);
  const ph = [R(), R(), R(), R()].map(v => v * Math.PI * 2);
  const bottom = H - 70;
  const heights = new Int16Array(W);
  for (let x = 0; x < W; x++) {
    const t = (x / W) * Math.PI * 2;
    let h = H * 0.6 - m.rough * (105 * Math.sin(t * 1.3 + ph[0]) + 55 * Math.sin(t * 3.1 + ph[1]) + 22 * Math.sin(t * 7.3 + ph[2]) + 7 * Math.sin(t * 17 + ph[3]));
    if (m.volcano) {
      const dx = x - W / 2;
      h -= 250 * Math.exp(-((dx / 230) ** 2));
      h += 70 * Math.exp(-((dx / 45) ** 2));
    }
    heights[x] = clamp(Math.round(h), 260, bottom - 60);
    for (let y = heights[x]; y < bottom; y++) mask[y * W + x] = 1;
  }
  const ellipse = (cx, cy, rx, ry, val, flatTop) => {
    for (let y = Math.max(0, cy - ry); y < Math.min(H, cy + ry); y++) {
      for (let x = Math.max(0, cx - rx); x < Math.min(W, cx + rx); x++) {
        const dx = (x - cx) / rx, dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1 && (!flatTop || dy >= -0.35)) mask[y * W + x] = val;
      }
    }
  };
  for (let i = 0; i < m.islands; i++) {
    const cx = Math.round(200 + R() * (W - 400));
    const cy = Math.round(Math.min(heights[cx] - 150, 200 + R() * 180));
    if (cy < 150) continue;
    ellipse(cx, cy, Math.round(80 + R() * 80), Math.round(22 + R() * 18), 1, true);
  }
  for (let i = 0; i < m.caves; i++) {
    const cx = Math.round(150 + R() * (W - 300));
    const cy = Math.round(Math.min(bottom - 60, heights[cx] + 70 + R() * 110));
    ellipse(cx, cy, Math.round(60 + R() * 70), Math.round(24 + R() * 20), 0, false);
  }
  for (let i = 0; i < m.chasms; i++) {
    const cx = Math.round(W * (0.3 + R() * 0.4) + (m.volcano ? 400 : 0)) % W;
    const hw = Math.round(28 + R() * 30);
    for (let x = Math.max(0, cx - hw); x < Math.min(W, cx + hw); x++) {
      for (let y = 0; y < H; y++) mask[y * W + x] = 0;
    }
  }
  return mask;
}

export function solid(mask, x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  if (xi < 0 || xi >= W || yi < 0 || yi >= H) return false;
  return mask[yi * W + xi] === 1;
}

export function carve(mask, cx, cy, r) {
  const r2 = r * r;
  const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(H - 1, Math.ceil(cy + r));
  const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(W - 1, Math.ceil(cx + r));
  for (let y = y0; y <= y1; y++) {
    const dy = y - cy;
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      if (dx * dx + dy * dy <= r2) mask[y * W + x] = 0;
    }
  }
}

export function surface(mask, x, fromY = 0) {
  for (let y = Math.max(0, fromY); y < H; y++) if (solid(mask, x, y)) return y;
  return H + 100;
}

// Tank y is the ground row under its feet.
export function supported(mask, x, y) {
  for (let dx = -7; dx <= 7; dx++) if (solid(mask, x + dx, y)) return true;
  return false;
}

export function settle(mask, t) {
  let lift = 0;
  while (lift < 80 && solid(mask, t.x, t.y - 1)) { t.y--; lift++; }
  while (t.y < H + 60 && !supported(mask, t.x, t.y)) t.y++;
}

export function moveStep(mask, t, dir) {
  const nx = clamp(t.x + dir, 12, W - 12);
  if (nx === t.x) return false;
  // Cân Đẩu (Tề Thiên passive) climbs twice as steep
  const climb = t.xe === 'tethien' ? 12 : 6;
  for (let up = 0; up <= climb; up++) {
    const ny = t.y - up;
    if (!solid(mask, nx, ny - 1) && !solid(mask, nx, ny - 12) && !solid(mask, nx + dir * 8, ny - 5)) {
      t.x = nx; t.y = ny;
      settle(mask, t);
      return true;
    }
  }
  return false;
}

// Walk along the ground from (x, y) toward targetX, like a crawling shell: climbs at most 10 px per step,
// stops at taller walls, falls at most 60 px, gives up past `max` px. Returns the points walked.
export function crawlPath(mask, x, y, targetX, max = 250, waterY = WATER_Y) {
  const dir = Math.sign(targetX - x) || 1, pts = [[x, y]];
  let walked = 0;
  while (walked < max && Math.abs(targetX - x) > 2) {
    const nx = x + dir;
    let ny = y, up = 0, down = 0;
    while (solid(mask, nx, ny) && up < 10) { ny--; up++; }
    if (up >= 10 || nx < 0 || nx >= W) break;
    while (!solid(mask, nx, ny + 1) && down < 60) { ny++; down++; }
    if (down >= 60 || ny > waterY) break;
    x = nx; y = ny; walked++;
    if (walked % 8 === 0) pts.push([x, y]);
  }
  pts.push([x, y]);
  return pts;
}

// Bơi Lội: the nearest dry spot to swim to (searches outward from where it fell in)
export function swimAshore(mask, t, waterY = WATER_Y) {
  for (let d = 0; d < W; d += 12) for (const x of [t.x - d, t.x + d]) {
    if (x < 20 || x > W - 20) continue;
    const y = standSpot(mask, Math.round(x));
    if (y < waterY - 4) return { x: Math.round(x), y };
  }
  return null;
}

export function spawnPositions(mask, n, rand) {
  const out = [];
  const margin = 150;
  for (let i = 0; i < n; i++) {
    const want = Math.round(n === 1 ? W / 2 : margin + ((W - 2 * margin) * i) / (n - 1) + (rand() - 0.5) * 60);
    let best = null;
    // look outward from the intended spot, both directions, keeping xe apart
    for (let d = 0; d <= 700 && !best; d += 12) {
      for (const x of d ? [want - d, want + d] : [want]) {
        if (x < 60 || x > W - 60 || out.some(p => Math.abs(p.x - x) < 90)) continue;
        const y = standSpot(mask, x);
        if (y < WATER_Y - 80) { best = { x, y }; break; }
      }
    }
    // nothing nearby: take the valid spot anywhere on the map farthest from the others
    if (!best) {
      for (let x = 60; x <= W - 60; x += 16) {
        const y = standSpot(mask, x);
        if (y >= WATER_Y - 80) continue;
        const gap = Math.min(...out.map(p => Math.abs(p.x - x)), 1e9);
        if (!best || gap > best.gap) best = { x, y, gap };
      }
    }
    out.push(best ? { x: best.x, y: best.y } : { x: want, y: standSpot(mask, want) });
  }
  return out;
}

// First ground below y=180 with room above it for the xe and its barrel (skips tree tops and cave ceilings).
export function standSpot(mask, x) {
  for (let y = 180; y < H; y++) {
    if (!solid(mask, x, y) || solid(mask, x, y - 1)) continue;
    let open = true;
    for (let k = 2; k <= 76 && open; k += 4) if (solid(mask, x, y - k) || solid(mask, x - 24, y - k - 6) || solid(mask, x + 24, y - k - 6)) open = false;
    if (open) return y;
  }
  return H + 100;
}

// Gunbound rule: the aim angle is relative to the xe's body, and the body leans with the ground, so standing
// facing downhill lets you shoot below the horizon (up to about −26° here). Flyers stay level.
// Returns radians; positive = the ground drops to the right.
export const FLYERS = new Set(['phuong', 'tethien', 'tho']);
export function bodyTilt(mask, t) {
  if (FLYERS.has(t.xe)) return 0;
  const yl = surface(mask, Math.round(t.x - 16), t.y - 40), yr = surface(mask, Math.round(t.x + 16), t.y - 40);
  if (Math.abs(yl - t.y) >= 40 || Math.abs(yr - t.y) >= 40) return 0;
  return Math.max(-0.45, Math.min(0.45, Math.atan2(yr - yl, 32)));
}
// aim (body) angle → the angle the shot actually leaves at, in degrees above the horizon in the facing direction
export const worldAngle = (mask, t, aim) => aim - t.facing * bodyTilt(mask, t) * (180 / Math.PI);

export function barrelTip(t, angle) {
  const a = (angle * Math.PI) / 180;
  return { x: t.x + Math.cos(a) * t.facing * BARREL, y: t.y - PIVOT - Math.sin(a) * BARREL };
}

// ---------- shot simulation ----------
// Mutates mask and tanks. Returns a replay (paths + timed events) that clients animate.

export function simulateShot({ mask, tanks, wind, shooter, angle, power, shotKey, dmgMul = 1, rMul = 1, waterY = WATER_Y, shotOverride = null, weather = null, pillars = [], moonZones = [], gravityMul = 1 }) {
  const xe = XE[shooter.xe];
  const shot = shotOverride || xe.shots[shotKey];
  if (angle >= HIGH_ANGLE) dmgMul *= HIGH_ANGLE_MUL;
  const out = { paths: [], events: [], zones: [], frames: 0, dealt: 0, kills: 0, taken: {}, minions: [], pillars: [], moonZones: [], moonNight: null };
  // Thỏ Ngọc: xe-level moon gravity, Bánh Mochi's "heavy" debuff on the shooter, Đêm Trăng Rằm (gravityMul)
  const gBase = (xe.gravity ?? 1) * (shooter.heavy || 1) * gravityMul;
  const inMoon = (x, y) => moonZones.some(z => Math.hypot(x - z.x, y - z.y) < z.r);
  // Gậy Như Ý pillars stop shells like ground but are never carved
  const inPillar = (x, y) => pillars.some(q => Math.abs(x - q.x) <= q.w / 2 && y <= q.y && y >= q.y - q.h);
  const solidAt = (x, y) => solid(mask, x, y) || (pillars.length > 0 && inPillar(x, y));
  // Long Nộ (Rồng passive): after taking damage the next shot counts as already airborne for 30 frames
  const airBonus = shooter.fury ? 30 : 0;
  const air = p => p.age + airBonus;
  const wv = windVec(wind);
  let strikes = 0;
  const TOR = weather?.type === 'tornado' ? { x: weather.x, half: WEATHERS.tornado.half, dir: weather.dir || 1 } : null;
  const THU = weather?.type === 'thunder' ? { x: weather.x, ...WEATHERS.thunder } : null;
  // Sấm sét: an electrified shell calls a bolt down onto the spot where it landed. The bolt comes from
  // the top of the sky and stops at the first ground in that column (usually the crater it just made).
  function thunderStrike(x) {
    strikes++;
    x = clamp(Math.round(x), 2, W - 3);
    const gy = surface(mask, x, 0);
    ev({ type: 'thunder', x, y: Math.min(gy, waterY) });
    if (gy < waterY) explode(x, gy, { dmg: THU.dmg, r: THU.r, look: 'light' }, { big: true });
  }
  const live = [];
  let f = 0;

  const ev = e => { e.f = f; out.events.push(e); };
  const alive = () => tanks.filter(t => t.alive);

  function spawn(p) {
    p.path = []; p.age = 0; p.start = f + (p.wait || 0);
    p.hit = p.hit || new Set(); p.dc = 0; p.traveled = 0;
    p.rec = { look: p.look, start: p.start, pts: p.path, kind: p.kind };
    out.paths.push(p.rec);
    live.push(p);
  }
  const rec = p => { if (p.look !== 'none') p.path.push(r1(p.x), r1(p.y)); };

  function makeProj(s, x, y, vx, vy, extra = {}) {
    return {
      x, y, vx, vy, s, look: s.look,
      mode: s.straight ? 'straight' : 'fly',
      g: (s.gravity ?? 1) * gBase, windMul: (s.windMul ?? 1) * xe.windMul, curve: s.curve || 0,
      dir: shooter.facing, bounces: s.bounce || 0, vx0: vx, ...extra,
    };
  }

  function kill(t, drown) {
    // Bơi Lội (Cánh Cụt passive): the first fall into the water, it swims back to shore
    if (drown && t.xe === 'canhcut' && !t.swam && t.hp > 0) {
      const spot = swimAshore(mask, t, waterY);
      if (spot) { t.swam = true; t.x = spot.x; t.y = spot.y; ev({ type: 'swim', id: t.id, x: t.x, y: t.y }); return; }
    }
    t.hp = 0; t.alive = false;
    ev({ type: 'die', id: t.id, by: shooter.id, drown: !!drown });
    if (t.team !== shooter.team) out.kills++;
  }

  function damage(t, amt) {
    amt = Math.round(amt * dmgMul);
    if (amt <= 0 || !t.alive) return;
    // Chân Thỏ May Mắn: 20% of hits simply miss the rabbit
    if (t.xe === 'tho' && Math.random() < 0.2) { ev({ type: 'dodge', id: t.id }); return; }
    // Lông Dày (Gấu passive): no single hit deals more than 320
    if (t.xe === 'gau') amt = Math.min(amt, 320);
    // Gai Độc (Bọ Cạp passive): hitting it from close range poisons the shooter
    if (t.xe === 'bocap' && t.team !== shooter.team && Math.abs(shooter.x - t.x) <= 300 && shooter.alive && !shooter.poison) {
      shooter.poison = { dmg: 25, turns: 2 };
      ev({ type: 'status', id: shooter.id, poison: true, thorns: true });
    }
    // Giáp ảo soaks the hit first; it still counts as damage dealt
    if (t.shield > 0) {
      const soak = Math.min(t.shield, amt);
      t.shield -= soak; amt -= soak;
      out.taken[t.id] = (out.taken[t.id] || 0) + soak;
      if (t.team !== shooter.team) out.dealt += soak;
      ev({ type: 'shield', id: t.id, amt: soak, shield: t.shield, broke: t.shield <= 0 });
      if (amt <= 0) return;
    }
    t.hp -= amt;
    out.taken[t.id] = (out.taken[t.id] || 0) + amt;
    if (t.team !== shooter.team) out.dealt += amt;
    ev({ type: 'dmg', id: t.id, amt, hp: Math.max(0, t.hp) });
    if (t.hp <= 0) {
      if (t.canRevive) {
        t.canRevive = false;
        t.hp = Math.round(t.maxHp * 0.25);
        ev({ type: 'revive', id: t.id, hp: t.hp });
      } else kill(t);
    }
  }

  function settleAll() {
    for (const t of alive()) {
      const ox = t.x, oy = t.y;
      settle(mask, t);
      if (t.y !== oy || t.x !== ox) ev({ type: 'move', id: t.id, x: t.x, y: t.y });
      if (t.y > waterY) kill(t, true);
    }
  }

  function carveAt(x, y, r) {
    x = r1(x); y = r1(y);
    carve(mask, x, y, r);
    ev({ type: 'carve', x, y, r });
  }

  function explode(x, y, s, opt = {}) {
    x = r1(x); y = r1(y);
    // Đột tử "Bom To": every blast is wider
    if (rMul !== 1 && s.r > 0) s = { ...s, r: Math.round(s.r * rMul) };
    if (s.r > 0) carveAt(x, y, Math.round(s.r * (s.carveMul || 1)));
    ev({ type: 'boom', x, y, r: s.r, look: s.look, big: !!opt.big });
    for (const t of alive()) {
      if (opt.once && opt.once.has(t.id)) continue;
      const d = Math.hypot(t.x - x, t.y - TANK_CY - y);
      if (d > s.r + TANK_R) continue;
      if (opt.once) opt.once.add(t.id);
      const ally = t.team === shooter.team;
      // Kỳ Lân never hurts its own team
      if (ally && shooter.xe === 'kylan' && !s.heal) continue;
      if (s.heal && ally) {
        const amt = Math.min(s.heal, t.maxHp - t.hp);
        t.hp += amt;
        if (s.cleanse) t.poison = null;
        ev({ type: 'heal', id: t.id, amt, hp: t.hp });
        continue;
      }
      const k = clamp(1 - Math.max(0, d - TANK_R) / s.r, 0, 1);
      let dmg = s.dmg * (MIN_SPLASH + (1 - MIN_SPLASH) * k);
      if (opt.direct === t.id) dmg *= DIRECT_HIT;
      if (!s.ignoreArmor) dmg *= 1 - Math.min(0.6, t.armor + (t.armorBuff || 0));
      // Băng Phong: a frozen xe is encased in ice and takes half damage
      if (t.frozen) dmg *= 0.5;
      // Mắt Đêm: marked xe take +30% from everyone while the mark lasts
      if (t.markTurns > 0) dmg *= 1.3;
      // Đánh Hơi Máu (Cá Mập passive)
      if (shooter.xe === 'camap' && t.hp < t.maxHp * 0.5) dmg *= 1.2;
      if (opt.boost) dmg *= opt.boost;
      if (ally) dmg *= 0.5;
      damage(t, dmg);
      if (!t.alive || ally) continue;
      if (s.poison) { t.poison = { dmg: s.poison.dmg, turns: s.poison.turns, spread: s.poison.spread || 0, team: shooter.team }; ev({ type: 'status', id: t.id, poison: true }); }
      if (s.root) { t.rooted = true; ev({ type: 'status', id: t.id, root: true }); }
      // Gấu: cold slows the victim's next turn; Băng Phong freezes it for a whole turn
      if (s.chill) { t.delay = (t.delay || 0) + s.chill; ev({ type: 'status', id: t.id, chill: s.chill }); }
      if (s.freeze) { t.frozen = true; ev({ type: 'status', id: t.id, freeze: true }); }
      // Bánh Mochi: the victim's next shot is heavy
      if (s.heavy) { t.heavy = s.heavy; ev({ type: 'status', id: t.id, heavy: true }); }
      if (s.blind) { t.blind = true; ev({ type: 'status', id: t.id, blind: true }); }
      if (s.mark) { t.markTurns = 2; t.mark = true; ev({ type: 'status', id: t.id, mark: true }); }
      // Thân Nặng (Voi passive): cannot be moved
      if ((s.push || s.pull) && t.xe !== 'voi') {
        const dir = s.push ? Math.sign(t.x - x) || 1 : Math.sign(shooter.x - t.x) || 1;
        const dist = s.push ? s.push : Math.min(s.pull, Math.max(0, Math.abs(shooter.x - t.x) - 40));
        t.x = clamp(Math.round(t.x + dir * dist), 12, W - 12);
        ev({ type: 'yank', id: t.id, x: t.x, pull: !!s.pull });
      }
    }
    // Kỷ Băng Hà: every enemy in the blizzard is slowed and its SS stays locked a turn longer
    if (s.blizzard) {
      ev({ type: 'blizzard', x, y, r: s.blizzard.r });
      for (const t of alive()) {
        if (t.team === shooter.team || Math.hypot(t.x - x, t.y - TANK_CY - y) > s.blizzard.r) continue;
        t.delay = (t.delay || 0) + s.blizzard.chill;
        t.ssCd = (t.ssCd || 0) + 1;
        ev({ type: 'status', id: t.id, chill: s.blizzard.chill });
      }
    }
    // Thỏ Ngọc: a moon zone where shells float, and the full-moon night
    if (s.moonZone) { const z = { x, y: y - 40, r: s.moonZone.r, turns: s.moonZone.turns }; out.moonZones.push(z); ev({ type: 'moonzone', ...z }); }
    if (s.moonNight) { out.moonNight = { team: shooter.team, ...s.moonNight }; ev({ type: 'moonnight', team: shooter.team }); }
    // Kraken: everything hostile around the blast is blinded and rooted
    if (s.aura) {
      ev({ type: 'aura', x, y, r: s.aura.r });
      for (const t of alive()) {
        if (t.team === shooter.team || Math.hypot(t.x - x, t.y - TANK_CY - y) > s.aura.r) continue;
        if (s.aura.blind) t.blind = true;
        if (s.aura.root) t.rooted = true;
        ev({ type: 'status', id: t.id, blind: !!s.aura.blind, root: !!s.aura.root });
      }
    }
    if (s.zone) out.zones.push({ x, y, r: s.zone.r, dmg: s.zone.dmg, turns: s.zone.turns });
    settleAll();
  }

  // Tia Sừng / Thánh Quang: a straight beam from the unicorn's horn to where the tracer landed.
  // Narrow beams stop at the first ground or enemy on the line; the wide SS beam goes through everything.
  function fireBeam(tx, ty, s) {
    const hx = shooter.x + shooter.facing * 24, hy = shooter.y - 72;
    const len = Math.hypot(tx - hx, ty - hy) || 1, ux = (tx - hx) / len, uy = (ty - hy) / len;
    const wide = s.beam.wide || 0;
    let ex = tx, ey = ty;
    const healed = new Set();
    if (!wide) {
      for (let d = 30; d < len; d += 3) {
        const x = hx + ux * d, y = hy + uy * d;
        const foe = alive().find(t => t.team !== shooter.team && Math.hypot(t.x - x, t.y - TANK_CY - y) < TANK_R);
        if (foe || solidAt(x, y)) { ex = x; ey = y; break; }
      }
    }
    // allies along the beam are healed (or within the wide band)
    const segLen = Math.hypot(ex - hx, ey - hy);
    for (const t of alive()) {
      if (t.team !== shooter.team || t === shooter) continue;
      const px = t.x - hx, py = t.y - TANK_CY - hy, along = px * ux + py * uy;
      if (along < 0 || along > segLen) continue;
      if (Math.abs(px * uy - py * ux) < (wide || TANK_R) && !healed.has(t.id)) {
        healed.add(t.id);
        const amt = Math.min(s.beam.heal, t.maxHp - t.hp);
        t.hp += amt;
        ev({ type: 'heal', id: t.id, amt, hp: t.hp });
      }
    }
    ev({ type: 'beam', x1: r1(hx), y1: r1(hy), x2: r1(ex), y2: r1(ey), w: wide || 8 });
    if (wide) {
      const hit = new Set();
      for (const t of alive()) {
        if (t.team === shooter.team) continue;
        const px = t.x - hx, py = t.y - TANK_CY - hy, along = px * ux + py * uy;
        if (along < 0 || along > segLen + TANK_R) continue;
        if (Math.abs(px * uy - py * ux) < wide + TANK_R) hit.add(t.id);
      }
      explode(ex, ey, { ...s, beam: null }, { big: true });
      for (const t of alive()) if (hit.has(t.id) && Math.hypot(t.x - ex, t.y - TANK_CY - ey) > s.r + TANK_R) damage(t, s.dmg * 0.8 * (1 - Math.min(0.6, t.armor)));
    } else explode(ex, ey, { ...s, beam: null }, { big: false });
  }

  // Phượng: from the ashes a firebird hops on and explodes again
  function rebirth(p, x, y, hopsLeft) {
    const r = p.s.reborn;
    const travel = Math.sign(p.vx) || p.dir || 1;
    const hops = r.chain ? [hopsLeft[0]] : hopsLeft;
    for (const h of hops) {
      if (!h) continue;
      const child = { dmg: h.dmg, r: h.r, look: 'ember', windMul: 0, reborn: r.chain && hopsLeft.length > 1 ? { chain: true, hops: hopsLeft.slice(1) } : null };
      ev({ type: 'reborn', x: r1(x), y: r1(y) });
      spawn(makeProj(child, x, y - 8, travel * h.dir * h.v, -5.2, { wait: 10, hit: new Set(), windMul: 0, kind: 'hop' }));
    }
  }

  function hitTank(p) {
    for (const t of tanks) {
      if (!t.alive || p.hit.has(t.id)) continue;
      if (t === shooter && p.age < 25) continue;
      if (Math.hypot(p.x - t.x, p.y - (t.y - TANK_CY)) < TANK_R) { p.struck = t.id; return t; }
    }
    return null;
  }

  const outOfWorld = p => p.x < -300 || p.x > W + 300 || p.y > H + 40;
  function splashIfWater(p) {
    if (p.y > waterY && p.x >= 0 && p.x <= W) { ev({ type: 'splash', x: r1(p.x), y: waterY }); return true; }
    return false;
  }

  // Terminal impact: the projectile ends here.
  function impact(p) {
    const s = p.s;
    p.landed = true;
    if (s.teleport) {
      // Dịch Chuyển: no blast, the shooter appears where the orb lands
      const x = clamp(Math.round(p.x), 12, W - 12);
      shooter.x = x; shooter.y = Math.round(p.y);
      settle(mask, shooter);
      ev({ type: 'teleport', id: shooter.id, x: shooter.x, y: shooter.y });
      if (shooter.y > waterY) kill(shooter, true);
      return;
    }
    if (s.sky) {
      ev({ type: 'target', x: r1(p.x), y: r1(p.y) });
      const n = s.sky.count || 1;
      const offs = [0, -14, 14, -7, 7];
      const col = { ...s, sky: null, look: s.sky.look };
      for (let i = 0; i < n; i++) {
        spawn(makeProj(col, p.x + offs[i % offs.length], -80, 0, 18, { mode: 'fall', wait: 12 + i * (s.sky.gap || 0) }));
      }
      return;
    }
    if (s.under) {
      ev({ type: 'rumble', x: r1(p.x), y: r1(p.y) });
      const x = p.x, y = p.y;
      spawn({ mode: 'timer', look: 'none', x, y, wait: s.under.wait, fire: () => explode(x, y + 18, s, { big: true }) });
      return;
    }
    if (s.quake) {
      explode(p.x, p.y, s, { big: true });
      const once = new Set();
      const q = { ...s.quake, look: 'rock' };
      for (const dir of [-1, 1]) {
        spawn({ mode: 'crawl', look: 'quake', x: p.x, y: p.y, s: q, cdir: dir, left: q.range, pulse: q.every, acc: 0, once, climb: 40 });
      }
      return;
    }
    // Where something that just hit the ground can stand: back out of the rock along the way it came,
  // then fall straight down to the first ground below (so a baby that hits a cliff face slides down it
  // instead of being placed inside the stone). Returns null over water.
  function landSpot(p) {
    let x = p.x, y = p.y;
    const sp = Math.hypot(p.vx, p.vy) || 1, bx = -p.vx / sp, by = -p.vy / sp;
    for (let i = 0; i < 80 && solidAt(x, y); i++) { x += bx * 2; y += by * 2; }
    if (solidAt(x, y)) for (let i = 0; i < 200 && solidAt(x, y); i++) y -= 2; // still stuck: climb out
    x = clamp(Math.round(x), 12, W - 12); y = Math.round(y);
    while (y < waterY && !solid(mask, x, y + 1)) y++;
    if (y >= waterY) return null;
    const ground = { x, y: y + 1 };
    // a baby (with its tail up) needs ~26 px of open air above it; under a ledge or in a crack, pick the
    // nearest spot along the ground nearby that has room
    const room = (gx, gy) => { for (let k = 1; k <= 26; k += 3) if (solidAt(gx, gy - k)) return false; return true; };
    if (room(ground.x, ground.y)) return ground;
    for (let d = 6; d <= 220; d += 6) for (const gx of [ground.x - d, ground.x + d]) {
      if (gx < 12 || gx > W - 12) continue;
      for (let gy = ground.y - 90; gy <= ground.y + 140 && gy < waterY; gy++) {
        if (solid(mask, gx, gy) && !solid(mask, gx, gy - 1) && room(gx, gy)) return { x: gx, y: gy };
      }
    }
    return ground;
  }

  // Kỳ Lân: the tracer only marks the spot; the horn beam does the work
    if (s.beam) { fireBeam(p.x, p.y, s); return; }
    let S = s;
    // Hỏa Cầu: the fire grows with airtime
    if (s.grow) {
      const k = clamp((air(p) - s.grow.t0) / (s.grow.t1 - s.grow.t0), 0, 1);
      S = { ...s, dmg: s.grow.dmg[0] + (s.grow.dmg[1] - s.grow.dmg[0]) * k, r: Math.round(s.grow.r[0] + (s.grow.r[1] - s.grow.r[0]) * k), zone: k >= 1 ? s.zone : null };
      ev({ type: 'grown', k: Math.round(k * 100) / 100 });
    }
    // Thiên Long: long enough in the air and the fireball has become a dragon
    if (s.transform) S = { ...s, ...(p.transformed ? s.transform.full : s.transform.short) };
    // Ổ Bọ Con: no blast at all; the nest lands and the babies scatter to wait on the ground
    if (s.minions) {
      const here = [];
      let spot = landSpot(p);
      // don't pile up: a baby landing on a sibling walks aside along the ground to the first free spot
      const taken = q => out.minions.some(m => Math.abs(m.x - q.x) < 22 && Math.abs(m.y - q.y) < 20);
      if (spot && taken(spot)) {
        const dir = Math.sign(p.vx) || 1;
        for (const off of [-26, 26, -52, 52, -78, 78]) {
          const path = crawlPath(mask, spot.x, spot.y - 1, spot.x + off * dir, Math.abs(off), waterY);
          const [nx, ny] = path[path.length - 1], q = { x: nx, y: ny + 1 };
          let open = true;
          for (let k = 1; k <= 26 && open; k += 3) if (solidAt(q.x, q.y - k)) open = false;
          if (!taken(q) && open) { spot = q; break; }
        }
      }
      if (spot) here.push(spot);
      out.minions.push(...here);
      ev({ type: 'minions', x: r1(p.x), y: r1(p.y), list: here.map(m => [m.x, m.y]) });
      return;
    }
    // Chuối Boomerang: a path that turned back hits harder
    let boost = s.boomerang && p.reversed ? s.boomerang : 1;
    if (s.ricochet && p.rico) { boost *= 1 + p.rico * s.ricochet.grow; ev({ type: 'combo', x: r1(p.x), y: r1(p.y), n: p.rico }); }
    if (s.slide && p.banks) boost *= 1 + p.banks * s.slide.grow;
    if (boost > 1) { out.boomerang = true; ev({ type: 'boomerang', x: r1(p.x), y: r1(p.y) }); }
    explode(p.x, p.y, S, { big: shotKey === 'ss', direct: p.struck, boost });
    if (s.reborn) rebirth(p, p.x, p.y, s.reborn.hops);
    // Gậy Như Ý: the staff plants itself and grows into a pillar
    if (s.pillar) {
      const spot = landSpot(p);
      if (spot) { const q = { x: spot.x, y: spot.y, h: s.pillar.h, w: s.pillar.w, turns: s.pillar.turns }; out.pillars.push(q); ev({ type: 'pillar', ...q }); }
    }
    // Cân Đẩu Vân: the monkey rides the cloud to the landing point
    if (s.rideTo && shooter.alive) {
      shooter.x = clamp(Math.round(p.x), 12, W - 12); shooter.y = Math.round(p.y) - 30;
      settle(mask, shooter);
      ev({ type: 'teleport', id: shooter.id, x: shooter.x, y: shooter.y, cloud: true });
      if (shooter.y > waterY) kill(shooter, true);
    }
  }

  function toCrawl(p) {
    p.mode = 'crawl';
    let cdir = Math.sign(p.vx) || p.dir;
    if (p.s.seek) {
      const foes = alive().filter(t => t.team !== shooter.team);
      if (foes.length) {
        const near = foes.reduce((a, b) => (Math.abs(a.x - p.x) < Math.abs(b.x - p.x) ? a : b));
        cdir = Math.sign(near.x - p.x) || cdir;
      }
    }
    p.cdir = cdir; p.left = p.s.crawl;
    let n = 0;
    while (solid(mask, p.x, p.y) && n++ < 40) p.y--;
  }

  function stepFly(p) {
    const prevVy = p.vy;
    p.vx += wv.x * WIND_K * p.windMul - p.dir * p.curve;
    p.vy += G * p.g * (moonZones.length && inMoon(p.x, p.y) ? 0.4 : 1) + wv.y * WIND_K * p.windMul;
    const s = p.s;
    if (s.boomerang && Math.sign(p.vx) !== Math.sign(p.vx0) && Math.abs(p.vx) > 0.2) p.reversed = true;
    if (s.transform && !p.transformed && air(p) >= s.transform.at) { p.transformed = true; p.rec.morph = p.path.length / 2; ev({ type: 'transform', x: r1(p.x), y: r1(p.y) }); }
    // Mưa Lửa: fire drips from the shell on the way down
    if (s.drops && p.vy > 0 && (p.dropped || 0) < s.drops.max && (p.age - (p.lastDrop ?? -99)) >= s.drops.every) {
      p.lastDrop = p.age; p.dropped = (p.dropped || 0) + 1;
      const d = s.drops;
      spawn(makeProj({ dmg: d.dmg, r: d.r, look: 'fire', zone: d.zone, windMul: 0 }, p.x, p.y + 6, p.vx * 0.15, 1.5, { hit: new Set([shooter.id]), windMul: 0, kind: 'drop' }));
    }
    // Cú Săn Mồi: on the way down, bend toward a marked enemy in range
    if (s.homing && p.vy > 0) {
      const prey = alive().filter(t => t.team !== shooter.team && t.markTurns > 0 && Math.hypot(t.x - p.x, t.y - TANK_CY - p.y) < s.homing.range)
        .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
      if (prey) {
        const sp = Math.max(6, Math.hypot(p.vx, p.vy)), dx = prey.x - p.x, dy = prey.y - TANK_CY - p.y, dl = Math.hypot(dx, dy) || 1;
        // once locked the owl dives straight at its prey (a little faster than it was flying)
        p.vx = (dx / dl) * sp * 1.05; p.vy = (dy / dl) * sp * 1.05;
        if (!p.locked) { p.locked = true; ev({ type: 'lock', id: prey.id }); }
      }
    }
    if (p.s.split && prevVy < 0 && p.vy >= 0) {
      rec(p);
      const { n, spread, speedMul = 1 } = p.s.split;
      const child = { ...p.s, split: null };
      for (let i = 0; i < n; i++) {
        const a = (((i - (n - 1) / 2) * spread) * Math.PI) / 180;
        const vx = (p.vx * Math.cos(a) - p.vy * Math.sin(a)) * speedMul;
        const vy = (p.vx * Math.sin(a) + p.vy * Math.cos(a)) * speedMul;
        spawn(makeProj(child, p.x, p.y, vx, vy - Math.abs(Math.sin(a)) * 1.2, { hit: new Set([shooter.id]) }));
      }
      ev({ type: 'split', x: r1(p.x), y: r1(p.y) });
      return true;
    }
    const n = Math.max(1, Math.ceil(Math.hypot(p.vx, p.vy) / 3));
    for (let k = 0; k < n; k++) {
      p.x += p.vx / n; p.y += p.vy / n;
      if (outOfWorld(p)) { rec(p); return true; }
      if (splashIfWater(p)) { rec(p); return true; }
      if (TOR && !p.twisted && Math.abs(p.x - TOR.x) < TOR.half && p.y > -250) {
        // Lốc xoáy: the shell is caught, spun one turn with the tornado while rising,
        // then flung out in the tornado's own direction, whichever side it came from
        p.twisted = true;
        out.twisted = true;
        p.mode = 'spin';
        p.spin = { cx: TOR.x, cy: p.y, a: p.x < TOR.x ? Math.PI : 0, t: 0, vx: p.vx, vy: p.vy, dir: TOR.dir };
        ev({ type: 'tornado', x: r1(p.x), y: r1(p.y) });
        rec(p);
        return false;
      }
      if (THU && !p.zapped && Math.abs(p.x - THU.x) < THU.half) {
        // the client draws sparks on the shell from this path point on
        p.zapped = true; out.zapped = true;
        p.rec.zap = p.path.length / 2;
        ev({ type: 'zap', x: r1(p.x), y: r1(p.y) });
      }
      if (p.s.pierce) {
        // Nỏ Thần: keeps flying the normal curve, boring through ground and every xe it meets
        const t = hitTank(p);
        if (t) { p.hit.add(t.id); explode(p.x, p.y, p.s, { once: (p.once ||= new Set()) }); }
        if (solid(mask, p.x, p.y) && ++p.dc % 3 === 0) carveAt(p.x, p.y, 10);
        continue;
      }
      // Cá Mập Đánh Hơi: ghosts through all ground, stops only on a xe
      if (p.s.ghost) {
        if (hitTank(p)) { rec(p); impact(p); return true; }
        continue;
      }
      // Kỳ Lân tracer: passes through xe, only ground stops it
      if (p.s.tracer) {
        if (solidAt(p.x, p.y)) { rec(p); impact(p); return true; }
        continue;
      }
      // Tên Đồng: goes through every xe on its path (each later one takes less), ground ends it
      if (p.s.pierceXe) {
        const t = hitTank(p);
        if (t) {
          p.hit.add(t.id);
          const k = Math.pow(p.s.pierceXe, p.pierced || 0);
          p.pierced = (p.pierced || 0) + 1;
          explode(p.x, p.y, { ...p.s, dmg: p.s.dmg * k, r: Math.min(p.s.r, 16) }, { once: (p.once ||= new Set()) });
        }
        if (solidAt(p.x, p.y)) { rec(p); impact(p); return true; }
        continue;
      }
      if (hitTank(p)) { rec(p); impact(p); return true; }
      if (solidAt(p.x, p.y)) {
        rec(p);
        // Cánh Cụt: ricochet off the ground like a billiard ball; each bounce makes the final blast stronger
        if (p.s.ricochet && (p.rico || 0) < p.s.ricochet.max) {
          let nx = (solidAt(p.x - 3, p.y) ? 1 : 0) - (solidAt(p.x + 3, p.y) ? 1 : 0), ny = (solidAt(p.x, p.y - 3) ? 1 : 0) - (solidAt(p.x, p.y + 3) ? 1 : 0);
          if (!nx && !ny) ny = -1;
          const nl = Math.hypot(nx, ny); nx /= nl; ny /= nl;
          const dot = p.vx * nx + p.vy * ny;
          p.vx = (p.vx - 2 * dot * nx) * p.s.ricochet.keep; p.vy = (p.vy - 2 * dot * ny) * p.s.ricochet.keep;
          for (let i = 0; i < 20 && solidAt(p.x, p.y); i++) { p.x += nx * 1.5; p.y += ny * 1.5; }
          p.rico = (p.rico || 0) + 1;
          ev({ type: 'bounce', x: r1(p.x), y: r1(p.y), n: p.rico });
          if (Math.hypot(p.vx, p.vy) < 1.2) { impact(p); return true; }
          return false;
        }
        // Trượt Bụng: land and slide along the ground
        if (p.s.slide && !p.sliding) {
          p.sliding = true; p.mode = 'slide'; p.cdir = Math.sign(p.vx) || p.dir; p.left = p.s.slide.max; p.banks = 0;
          for (let n = 0; n < 40 && solid(mask, p.x, p.y); n++) p.y--;
          return false;
        }
        if (p.bounces > 0) {
          p.bounces--;
          for (let i = 0; i < 30 && solid(mask, p.x, p.y); i++) { p.x -= p.vx * 0.08; p.y -= Math.abs(p.vy) * 0.08 + 0.5; }
          p.vy = -Math.abs(p.vy) * 0.6; p.vx *= 0.75;
          explode(p.x, p.y, { dmg: p.s.dmg * 0.35, r: 16, look: p.s.look });
          return false;
        }
        if (p.s.drill) {
          const sp = Math.hypot(p.vx, p.vy) || 1;
          p.mode = 'drill'; p.ux = (p.vx / sp) * 3; p.uy = (p.vy / sp) * 3; p.left = p.s.drill;
          return false;
        }
        if (p.s.crawl) { toCrawl(p); return false; }
        // Lặn Cát: keep the sideways speed and curve back up underground (gravity reversed), like Nak
        if (p.s.tunnel && !pillars.some(q => inPillar(p.x, p.y))) { p.mode = 'tunnel'; p.left = p.s.tunnel.max; p.vy = Math.abs(p.vy) * 0.6; ev({ type: 'dive', x: r1(p.x), y: r1(p.y) }); return false; }
        impact(p);
        return true;
      }
    }
    rec(p);
    return false;
  }

  function stepSlide(p) {
    for (let k = 0; k < 4; k++) {
      const nx = p.x + p.cdir;
      let ny = p.y, up = 0, down = 0;
      while (solidAt(nx, ny) && up < 8) { ny--; up++; }
      if (up >= 8 || nx < 0 || nx > W) {
        // bank off the wall once or twice, each time a bit stronger
        if (p.banks < 2) { p.cdir = -p.cdir; p.banks++; ev({ type: 'bounce', x: r1(p.x), y: r1(p.y), n: p.banks }); continue; }
        rec(p); impact(p); return true;
      }
      while (!solid(mask, nx, ny + 1) && down < 60) { ny++; down++; }
      p.x = nx; p.y = ny; p.left--;
      if (down >= 60 || p.y > waterY) { rec(p); if (splashIfWater(p)) return true; impact(p); return true; }
      if (hitTank(p) || p.left <= 0) { rec(p); impact(p); return true; }
    }
    rec(p);
    return false;
  }

  function stepTunnel(p) {
    const n = Math.max(1, Math.ceil(Math.hypot(p.vx, p.vy) / 3));
    p.vy -= G * 1.6;
    for (let k = 0; k < n; k++) {
      p.x += p.vx / n; p.y += p.vy / n; p.left -= Math.hypot(p.vx, p.vy) / n;
      if (outOfWorld(p) || p.y > waterY + 200) { rec(p); return true; }
      if (hitTank(p)) { rec(p); impact(p); return true; }
      // bursts out where it breaks the surface
      if (!solid(mask, p.x, p.y) && p.vy < 0) { rec(p); impact(p); return true; }
      if (p.left <= 0) { rec(p); impact(p); return true; }
    }
    rec(p);
    return false;
  }

  function stepFall(p) {
    for (let k = 0; k < 6; k++) {
      p.y += p.vy / 6;
      if (splashIfWater(p) || p.y > H) { rec(p); return true; }
      if (p.y > 0 && (hitTank(p) || solid(mask, p.x, p.y))) { rec(p); explode(p.x, p.y, p.s, { big: true }); return true; }
    }
    rec(p);
    return false;
  }

  function stepDrill(p) {
    for (let k = 0; k < 2; k++) {
      p.x += p.ux; p.y += p.uy; p.left -= 3;
      if (++p.dc % 2 === 0) carveAt(p.x, p.y, 9);
      if (outOfWorld(p) || splashIfWater(p)) { rec(p); return true; }
      if (hitTank(p) || p.left <= 0) { rec(p); impact(p); return true; }
    }
    rec(p);
    return false;
  }

  function stepCrawl(p) {
    const s = p.s;
    for (let k = 0; k < 3; k++) {
      const nx = p.x + p.cdir;
      const climb = p.climb || 10;
      let ny = p.y, up = 0, down = 0;
      while (solid(mask, nx, ny) && up < climb) { ny--; up++; }
      if (up >= climb || nx < 0 || nx > W) { rec(p); if (!p.pulse) impact(p); return true; }
      while (!solid(mask, nx, ny + 1) && down < 60) { ny++; down++; }
      p.x = nx; p.y = ny; p.left--;
      if (down >= 60 || p.y > waterY) { rec(p); if (!p.pulse) impact(p); return true; }
      if (p.pulse) {
        if (++p.acc >= p.pulse) { p.acc = 0; explode(p.x, p.y, s.push ? { ...s, push: s.push } : s, { once: p.once }); }
      } else if (hitTank(p)) { rec(p); impact(p); return true; }
      if (p.left <= 0) { rec(p); if (!p.pulse) impact(p); return true; }
    }
    rec(p);
    return false;
  }

  function stepStraight(p) {
    const s = p.s;
    const sp = Math.hypot(p.vx, p.vy);
    const n = Math.max(1, Math.ceil(sp / 3));
    for (let k = 0; k < n; k++) {
      p.x += p.vx / n; p.y += p.vy / n; p.traveled += sp / n;
      if (outOfWorld(p) || p.y < -400) { rec(p); return true; }
      if (splashIfWater(p)) { rec(p); return true; }
      const t = hitTank(p);
      if (t) {
        if (s.pierce) { p.hit.add(t.id); explode(p.x, p.y, s, { once: (p.once ||= new Set()) }); }
        else { rec(p); impact(p); return true; }
      }
      if (solid(mask, p.x, p.y)) {
        if (s.pierce) { if (++p.dc % 3 === 0) carveAt(p.x, p.y, 10); }
        else { rec(p); impact(p); return true; }
      }
      if (p.traveled >= s.range) { rec(p); if (!s.pierce) impact(p); return true; }
    }
    rec(p);
    return false;
  }

  function stepSpin(p) {
    const sp = p.spin;
    sp.t++;
    sp.a += 0.3 * sp.dir;
    const rise = sp.t * 2.4;
    p.x = sp.cx + Math.cos(sp.a) * 26;
    p.y = sp.cy - rise + Math.sin(sp.a) * 14;
    if (outOfWorld(p)) { rec(p); return true; }
    if (sp.t > 8 && (hitTank(p) || solid(mask, p.x, p.y))) { rec(p); impact(p); return true; }
    if (sp.t >= 40) {
      p.mode = 'fly';
      const speed = Math.hypot(sp.vx, sp.vy) * 0.9;
      p.vx = sp.dir * Math.max(3, Math.abs(sp.vx)) * 0.85;
      p.vy = -Math.sqrt(Math.max(9, speed * speed - p.vx * p.vx)) * 0.8;
    }
    rec(p);
    return false;
  }

  function step(p) {
    p.age++;
    switch (p.mode) {
      case 'spin': return stepSpin(p);
      case 'timer': p.fire(); return true;
      case 'fly': return stepFly(p);
      case 'fall': return stepFall(p);
      case 'drill': return stepDrill(p);
      case 'crawl': return stepCrawl(p);
      case 'straight': return stepStraight(p);
      case 'tunnel': return stepTunnel(p);
      case 'slide': return stepSlide(p);
    }
    return true;
  }

  // launch
  // launch along the body-relative aim tilted by the slope under the xe
  const launch = worldAngle(mask, shooter, angle);
  const a = (launch * Math.PI) / 180;
  const dx = Math.cos(a) * shooter.facing, dy = -Math.sin(a);
  const tip = barrelTip(shooter, launch);
  // Voi has two barrels: the tower (high) and the trunk (low, in front)
  if (shot.muzzle) { tip.x += shot.muzzle.dx * shooter.facing; tip.y += shot.muzzle.dy; }
  const v0 = shot.straight ? shot.fixedSpeed : VMAX * Math.max(0.04, power / 100) * (shot.speed || 1);
  if (shot.clones) {
    for (const off of shot.clones) {
      const x = clamp(shooter.x + off * shooter.facing, 20, W - 20), y = tip.y - 6;
      ev({ type: 'clone', x: r1(x), y: r1(y) });
      spawn(makeProj(shot, x, y, dx * v0, dy * v0, { wait: 20 }));
    }
  } else {
    const n = shot.count || 1;
    if (shot.fan) {
      // Nỏ Thần Vạn Tiễn: a fan of arrows, each a few degrees apart
      for (let i = 0; i < shot.fan.n; i++) {
        const fa = ((launch + (i - (shot.fan.n - 1) / 2) * shot.fan.spread) * Math.PI) / 180;
        spawn(makeProj(shot, tip.x, tip.y, Math.cos(fa) * shooter.facing * v0, -Math.sin(fa) * v0));
      }
    } else for (let i = 0; i < n; i++) spawn(makeProj(shot, tip.x, tip.y, dx * v0, dy * v0, { wait: i * (shot.gap || 0) }));
  }

  while (live.length && f < MAX_FRAMES) {
    for (let i = live.length - 1; i >= 0; i--) {
      const p = live[i];
      if (f < p.start) continue;
      if (step(p)) {
        live.splice(i, 1);
        if (p.zapped && p.landed && strikes < THU.maxStrikes) thunderStrike(p.x);
      }
    }
    f++;
  }
  settleAll();
  out.frames = f;
  return out;
}

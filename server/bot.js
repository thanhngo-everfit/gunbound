// NPC aiming: try shots on a copy of the battlefield and keep the one that hurts enemies most.
import { XE } from '../shared/xe.js';
import { simulateShot } from '../shared/physics.js';

export const BOT_NAMES = ['NPC Gấu', 'NPC Mèo', 'NPC Cáo', 'NPC Heo', 'NPC Sóc', 'NPC Vịt', 'NPC Thỏ', 'NPC Hổ', 'NPC Rái Cá', 'NPC Nhím'];

function score(game, tank, target, angle, power, shot) {
  const tanks = game.tanks.map(t => ({ ...t, poison: t.poison && { ...t.poison } }));
  const me = tanks.find(t => t.id === tank.id);
  const res = simulateShot({ mask: game.mask.slice(), tanks, wind: game.wind, shooter: me, angle, power, shotKey: shot, waterY: game.waterY, weather: game.weather?.active, pillars: game.pillars || [], moonZones: game.moonZones || [], gravityMul: game.moonNight ? (game.moonNight.team === me.team ? game.moonNight.ally : game.moonNight.foe) : 1 });
  // closeness of the nearest blast to the target breaks ties when nothing hits
  let near = 2000;
  for (const e of res.events) if (e.type === 'boom') near = Math.min(near, Math.hypot(e.x - target.x, e.y - (target.y - 28)));
  let s = -near * 0.3;
  for (const t of tanks) {
    const before = game.tanks.find(x => x.id === t.id);
    const lost = before.hp - Math.max(0, t.hp);
    if (t.team === tank.team) s -= lost * 1.5;
    else s += lost + (before.alive && !t.alive ? 400 : 0);
  }
  if (!me.alive) s -= 1000;
  return s;
}

// Returns { angle, power, shot, facing }. Misses a little on purpose so NPCs stay beatable.
export function planShot(game, tank) {
  const xe = XE[tank.xe];
  const shot = tank.ssReady && Math.random() < 0.6 ? 'ss' : Math.random() < 0.3 ? 's2' : 's1';
  const foes = game.tanks.filter(t => t.alive && t.team !== tank.team);
  const target = foes.reduce((a, b) => (Math.abs(b.x - tank.x) < Math.abs(a.x - tank.x) ? b : a), foes[0]);
  const facing = target && target.x < tank.x ? -1 : 1;
  const saved = tank.facing;
  tank.facing = facing;
  const [lo, hi] = xe.angle;
  if (!target) return { angle: lo, power: 50, shot, facing };
  const angles = [0.25, 0.5, 0.8].map(k => Math.round(lo + (hi - lo) * k));
  let best = { angle: angles[0], power: 60, s: -Infinity };
  for (const angle of angles) {
    for (let power = 15; power <= 100; power += 6) {
      const s = score(game, tank, target, angle, power, shot);
      if (s > best.s) best = { angle, power, s };
    }
  }
  // refine around the best coarse power
  for (let power = best.power - 4; power <= best.power + 4; power += 2) {
    if (power < 5 || power > 100) continue;
    const s = score(game, tank, target, best.angle, power, shot);
    if (s > best.s) best = { ...best, power, s };
  }
  tank.facing = saved;
  const miss = (Math.random() * 2 - 1) * (1.5 + Math.random() * 3);
  return { angle: best.angle, power: Math.max(5, Math.min(100, best.power + miss)), shot, facing };
}

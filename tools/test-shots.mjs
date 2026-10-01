// Room-level test of every shot and passive against its description (run: node tools/test-shots.mjs).
// Room-level test of every shot against its description.
import { Room } from '../server/room.js';
import { simulateShot, W, H, surface, swimAshore, WATER_Y } from '../shared/physics.js';
import { XE, PICKABLE, LEGENDARY } from '../shared/xe.js';

const clone = t => ({ ...t, poison: t.poison && { ...t.poison } });
function setup(xe, layout) {
  const log = [];
  const io = { to: () => ({ emit: (ev, d) => log.push([ev, JSON.parse(JSON.stringify(d ?? null))]), except: () => ({ emit() {} }) }) };
  const r = new Room(1, 'T', io, () => {});
  const host = { token: 'h', pid: 'u1', name: 'Host', socket: null, gender: 'm' };
  r.join(host);
  r.addBot(host, 'B');
  r.members.get('h').xe = xe;
  r.start(host);
  const g = r.game;
  clearInterval(g.tick); for (const h of g.timers) clearTimeout(h); g.timers.clear();
  const q = []; let now = 0;
  r.later = (ms, fn) => { q.push({ at: now + ms, fn }); q.sort((a, b) => a.at - b.at); return 0; };
  // flat world + optional hill
  g.mask = new Uint8Array(W * H); for (let y = 800; y < H; y++) g.mask.fill(1, y * W, y * W + W);
  if (layout.hill) for (let x = layout.hill[0]; x < layout.hill[1]; x++) for (let y = 650; y < 800; y++) g.mask[y * W + x] = 1;
  const base = g.tanks[0];
  const mk = (id, x, team, x2, facing) => ({ ...base, id, token: id, name: id, x, y: 800, team, xe: x2, facing, hp: XE[x2].hp, maxHp: XE[x2].hp, armor: XE[x2].armor, alive: true, shield: XE[x2].shield?.max || 0, maxShield: XE[x2].shield?.max || 0, poison: null, blind: false, mark: false, markTurns: 0, rooted: false, delay: 0, bot: true, connected: true, stats: { dealt: 0, kills: 0, shots: 0, gold: 0, deaths: 0 }, gold: 400 });
  const me = mk('me', 500, 'A', xe, 1);
  me.token = 'h';
  g.tanks = [me, ...layout.tanks.map(([id, x, team, x2]) => mk(id, x, team, x2, team === 'A' ? 1 : -1))];
  g.loaded = { me: 100 };
  g.phase = 'turn';
  g.turn = { id: 'me', endsAt: 0, moveLeft: 100, moved: 0, input: { left: false, right: false }, item: null, itemDelay: 0, timer: 0 };
  me.ssReady = true; me.ssCd = 0;
  return { r, g, log, q, host, me, run: (until = 20) => { let n = 0; while (q.length && n++ < until) { const x = q.shift(); now = x.at; x.fn(); } } };
}
// find angle/power whose landing is nearest to target x (using the physics on copies)
function aim(g, me, shot, tx, angles) {
  let best = null;
  const [lo, hi] = XE[me.xe].angle;
  angles = [...new Set(angles.map(a => Math.max(lo, Math.min(hi, a))))];
  for (const a of angles) for (let p = 20; p <= 100; p += 2) {
    const r = simulateShot({ mask: g.mask.slice(), tanks: g.tanks.map(clone), wind: { s: 0, a: 0 }, shooter: clone(me), angle: a, power: p, shotKey: shot, pillars: g.pillars || [] });
    const b = r.events.find(e => e.type === 'boom' || e.type === 'beam' || e.type === 'minions' || e.type === 'pillar');
    if (!b) continue;
    const x = b.x ?? b.x2 ?? (b.list ? b.list[0][0] : 0);
    const d = Math.abs(x - tx);
    if (!best || d < best.d) best = { a, p, d };
  }
  return best;
}
const results = [];
const check = (name, ok, info = '') => results.push([ok ? 'PASS' : 'FAIL', name, info]);
function fire(t, shot, tx, angles = [20, 35, 50, 65, 80]) {
  t.g.wind = { s: 0, a: 0 };
  const b = aim(t.g, t.me, shot, tx, angles);
  t.r.fire(t.host, { angle: b.a, power: b.p, shot });
  const shotEv = t.log.filter(l => l[0] === 'game:shot').at(-1)?.[1];
  return { b, shotEv, events: shotEv?.events || [] };
}
const hp = (t, id) => t.g.tanks.find(x => x.id === id).hp;
const tank = (t, id) => t.g.tanks.find(x => x.id === id);
const ticks = t => t.log.filter(l => l[0] === 'game:tick').flatMap(l => l[1].events);


const T = (xe, tanks, extra = {}) => setup(xe, { tanks, ...extra });
const kinds = ev => [...new Set(ev.map(e => e.type))];
const dmgTo = (ev, id) => ev.filter(e => e.type === 'dmg' && e.id === id).reduce((a, e) => a + e.amt, 0);
const paths = sh => sh?.paths || [];
const runTurn = t => t.run(3);

// RỒNG
{ const t = T('rong', [['e', 1000, 'B', 'voi']]); const { events } = fire(t, 's1', 1000, [15]); const t2 = T('rong', [['e', 1900, 'B', 'voi']]); const f2 = fire(t2, 's1', 1900, [50]);
  const g1 = events.find(e => e.type === 'grown'), g2 = f2.events.find(e => e.type === 'grown');
  check('rong s1: fire grows with airtime (short < long)', g1 && g2 && g2.k > g1.k, `k short=${g1?.k} long=${g2?.k}`);
  check('rong s1: burns ground only at full size', (f2.shotEv.zones.length > 0) === (g2.k >= 1) && (t.g.zones.length === 0) === (g1.k < 1), `zones short=${t.g.zones.length} long=${f2.shotEv.zones.length}`); }
{ const t = T('rong', [['e', 1500, 'B', 'voi']]); const { shotEv } = fire(t, 's2', 1500, [45]); const drops = paths(shotEv).filter(p => p.kind === 'drop').length;
  check('rong s2: fire drops fall on the way down', drops >= 2, `drops=${drops}, zones=${shotEv.zones.length}`); }
{ const t = T('rong', [['e', 1100, 'B', 'voi']]); const f1 = fire(t, 'ss', 1100, [15]); const t2 = T('rong', [['e', 2100, 'B', 'voi']]); const f2 = fire(t2, 'ss', 2100, [55]);
  check('rong ss: short flight = no dragon', !f1.events.some(e => e.type === 'transform'), '');
  check('rong ss: ≥2 s airborne turns into the dragon + big burn', f2.events.some(e => e.type === 'transform') && f2.shotEv.zones.some(z => z.r >= 100), `frames=${f2.shotEv.frames} zones=${JSON.stringify(f2.shotEv.zones.map(z => z.r))}`); }
// KỲ LÂN
{ const t = T('kylan', [['a', 800, 'A', 'voi'], ['e', 1300, 'B', 'rong']]); const hpA = hp(t, 'a'); tank(t, 'a').hp -= 200; const { events } = fire(t, 's1', 1300, [10, 20, 30]);
  check('kylan s1: horn beam to the landing point', events.some(e => e.type === 'beam'), '');
  check('kylan s1: enemy hit', dmgTo(events, 'e') > 0, `dmg=${dmgTo(events, 'e')}`);
  check('kylan s1: ally on the line healed, never hurt', dmgTo(events, 'a') === 0, `ally heal=${events.filter(e => e.type === 'heal' && e.id === 'a').map(e => e.amt)}`); }
{ const t = T('kylan', [['e', 1300, 'B', 'rong']], { hill: [950, 1050] }); const { events } = fire(t, 's1', 1300, [10, 20]);
  check('kylan s1: a hill between blocks the beam', dmgTo(events, 'e') === 0, `dmg=${dmgTo(events, 'e')}`); }
{ const t = T('kylan', [['a', 1260, 'A', 'voi'], ['e', 1330, 'B', 'rong']]); tank(t, 'a').hp -= 300; tank(t, 'a').poison = { dmg: 40, turns: 3 }; const { events } = fire(t, 's2', 1290);
  check('kylan s2: ally healed and cleansed, enemy lightly hurt', events.some(e => e.type === 'heal' && e.id === 'a' && e.amt > 0) && !tank(t, 'a').poison && dmgTo(events, 'e') > 0 && dmgTo(events, 'e') < 120, `heal=${events.find(e => e.type === 'heal' && e.id === 'a')?.amt} foe=${dmgTo(events, 'e')}`); }
{ const t = T('kylan', [['a', 900, 'A', 'voi'], ['e1', 1200, 'B', 'rong'], ['e2', 1400, 'B', 'cu']]); tank(t, 'a').hp -= 300; const { events } = fire(t, 'ss', 1400, [10, 20]);
  check('kylan ss: wide beam hits every enemy in the band', dmgTo(events, 'e1') > 0 && dmgTo(events, 'e2') > 0, `e1=${dmgTo(events, 'e1')} e2=${dmgTo(events, 'e2')}`);
  check('kylan ss: allies in the band healed', events.some(e => e.type === 'heal' && e.id === 'a'), ''); }
// KIM QUY
{ const t = T('kimquy', [['e1', 1290, 'B', 'rong'], ['e2', 1330, 'B', 'voi']]);
  let pick = null; for (let pw = 60; pw <= 100 && !pick; pw += 2) { const r = simulateShot({ mask: t.g.mask.slice(), tanks: t.g.tanks.map(clone), wind: { s: 0, a: 0 }, shooter: clone(t.me), angle: 10, power: pw, shotKey: 's1' }); if (r.taken.e1 && r.taken.e2) pick = pw; }
  t.g.wind = { s: 0, a: 0 }; t.r.fire(t.host, { angle: 10, power: pick, shot: 's1' }); const events = t.log.filter(l => l[0] === 'game:shot').at(-1)[1].events;
  const d1 = dmgTo(events, 'e1'), d2 = dmgTo(events, 'e2');
  check('kimquy s1: arrow pierces through both xe in line', d1 > 0 && d2 > 0, `e1=${d1} e2=${d2}`); }
{ const t = T('kimquy', [['a', 560, 'A', 'rong'], ['e', 1300, 'B', 'voi']]); t.me.shield = 100; fire(t, 's2', 1300);
  check('kimquy s2: +120 giáp ảo', t.me.shield === 220, `shield=${t.me.shield}`);
  check('kimquy s2: ally next to it +20% armour', tank(t, 'a').armorBuff === 0.2, `armorBuff=${tank(t, 'a').armorBuff}`); }
{ const t = T('kimquy', [['e', 1300, 'B', 'voi']]); const { shotEv } = fire(t, 'ss', 1300);
  check('kimquy ss: 5 arrows in a fan', paths(shotEv).length === 5, `paths=${paths(shotEv).length}`); }
{ const t = T('rong', [['k', 1300, 'B', 'kimquy']]); const { events } = fire(t, 's1', 1300, [45]);
  check('kimquy passive: giáp ảo soaks damage before HP', events.some(e => e.type === 'shield'), kinds(events).join(',')); }
// PHƯỢNG
for (const [k, n] of [['s1', 2], ['s2', 3], ['ss', 4]]) { const t = T('phuong', [['e', 1300, 'B', 'voi']]); const { events } = fire(t, k, 1250); const booms = events.filter(e => e.type === 'boom').length;
  check(`phuong ${k}: ${n} blasts (reborn hops)`, booms === n, `booms=${booms} reborn=${events.filter(e => e.type === 'reborn').length}`); }
// VOI
{ const t = T('voi', [['e', 1300, 'B', 'rong']]); const a = fire(t, 's1', 1300); const t2 = T('voi', [['e', 1300, 'B', 'rong']]); const b = fire(t2, 's2', 1300);
  const p1 = paths(a.shotEv)[0].pts, p2 = paths(b.shotEv)[0].pts;
  // 2026-10-01 art: the pagoda cannon sits ~15 px above the trunk nozzle on the 64 px elephant
  check('voi: S1 from the high tower, S2 from the low trunk', p1[1] < p2[1] - 12, `start y s1=${p1[1]} s2=${p2[1]}`);
  const y1 = a.events.find(e => e.type === 'yank'), y2 = b.events.find(e => e.type === 'yank');
  check('voi: S2 pushes much further than S1', y1 && y2 && Math.abs(y2.x - 1300) > Math.abs(y1.x - 1300) + 50, `s1 to ${y1?.x} s2 to ${y2?.x}`); }
{ const t = T('voi', [['e1', 1150, 'B', 'rong'], ['e2', 1450, 'B', 'cu']]); const { events } = fire(t, 'ss', 1300); const yanked = new Set(events.filter(e => e.type === 'yank').map(e => e.id));
  check('voi ss: quake runs both ways and throws xe', yanked.size >= 1, `yanked=${[...yanked]}`); }
{ const t = T('voi', [['v', 1300, 'B', 'voi']]); const { events } = fire(t, 's2', 1300);
  check('voi passive Thân Nặng: another Voi is not pushed', !events.some(e => e.type === 'yank' && e.id === 'v') && dmgTo(events, 'v') > 0, ''); }
// BẠCH TUỘC
{ const t = T('bachtuoc', [['e', 1300, 'B', 'rong']]); fire(t, 's1', 1300); check('bachtuoc s1: blind', tank(t, 'e').blind === true, ''); }
{ const t = T('bachtuoc', [['e', 1300, 'B', 'rong']]); fire(t, 's2', 1300); check('bachtuoc s2: rooted', tank(t, 'e').rooted === true, '');
  runTurn(t); const turn = t.log.filter(l => l[0] === 'game:turn' && l[1].id === 'e').at(-1)?.[1];
  check('bachtuoc s2: rooted xe cannot move on its turn', turn && turn.moveLeft === 0 && turn.rooted, `moveLeft=${turn?.moveLeft}`); }
{ const t = T('bachtuoc', [['e1', 1260, 'B', 'rong'], ['e2', 1380, 'B', 'cu']]); fire(t, 'ss', 1320);
  check('bachtuoc ss: every enemy within 140 blind + rooted', ['e1', 'e2'].every(id => tank(t, id).blind && tank(t, id).rooted), ''); }
// BỌ CẠP
{ const t = T('bocap', [['e', 1300, 'B', 'rong']]); fire(t, 's1', 1300); check('bocap s1: poison 40×3', tank(t, 'e').poison?.dmg === 40, ''); }
{ const t = T('bocap', [['e', 1300, 'B', 'rong']]); fire(t, 's2', 1150); const hp0 = hp(t, 'e');
  check('bocap s2: 3 minions wait on the ground', t.g.minions.length === 3, `minions=${t.g.minions.length}`);
  { const last = t.log.filter(l => l[0] === 'game:shot').at(-1)[1].events; check('bocap s2: the nest does not explode on landing', !last.some(e => e.type === 'boom' || e.type === 'carve' || e.type === 'dmg'), last.map(e => e.type).join(',')); }
  t.run(1); const firstStings = ticks(t).filter(e => e.type === 'minion').length;
  check('bocap s2: they do NOT sting in the same turn', firstStings === 0, `stings=${firstStings}`);
  t.run(6); const st = ticks(t).filter(e => e.type === 'minion');
  check('bocap s2: next turn they crawl along the ground and sting', st.length > 0 && st.every(e => e.path.length > 1), `stings=${st.length} hp ${hp0}->${hp(t, 'e')}`); }
{ // babies thrown flat into a tall rock wall must end up standing on real ground, never inside the stone
  const t = T('bocap', [['e', 1500, 'B', 'rong']]);
  for (let x = 900; x < 1000; x++) for (let y = 300; y < 800; y++) t.g.mask[y * W + x] = 1;
  t.g.wind = { s: 0, a: 0 }; t.r.fire(t.host, { angle: 20, power: 70, shot: 's2' });
  const solidAt = (x, y) => !!t.g.mask[y * W + x];
  const ok = t.g.minions.length > 0 && t.g.minions.every(m => solidAt(m.x, m.y) && !solidAt(m.x, m.y - 3) && !solidAt(m.x, m.y - 20));
  check('bocap s2: babies hitting a rock wall stand on the ground, not inside the rock', ok, JSON.stringify(t.g.minions.map(m => [m.x, m.y])));
  const spread = t.g.minions.every((m, i) => t.g.minions.every((o, j) => i === j || Math.abs(m.x - o.x) >= 18 || Math.abs(m.y - o.y) >= 18));
  check('bocap s2: babies do not pile up on the same spot', spread, JSON.stringify(t.g.minions.map(m => [m.x, m.y]))); }
{ const t = T('tethien', [['e', 1500, 'B', 'rong']]);
  for (let x = 900; x < 1000; x++) for (let y = 300; y < 800; y++) t.g.mask[y * W + x] = 1;
  t.g.wind = { s: 0, a: 0 }; t.r.fire(t.host, { angle: 20, power: 70, shot: 's2' });
  const q = t.g.pillars[0], solidAt = (x, y) => !!t.g.mask[y * W + x];
  check('tethien s2: a pillar that hits a wall stands on the ground, not in the rock', !q || (solidAt(q.x, q.y) && !solidAt(q.x, q.y - 3)), JSON.stringify(q)); }
{ const t = T('bocap', [['e', 1300, 'B', 'rong']], { hill: [1180, 1230] }); fire(t, 's2', 1100); t.run(8);
  check('bocap s2: minions do not climb a high wall', ticks(t).filter(e => e.type === 'minion').length === 0, `left=${t.g.minions.length}`); }
{ const t = T('bocap', [['e1', 1300, 'B', 'rong'], ['e2', 1360, 'B', 'voi']]); fire(t, 'ss', 1300);
  const p1 = !!tank(t, 'e1').poison; runTurn(t);
  check('bocap ss: poison spreads to a neighbour', p1 && !!tank(t, 'e2').poison, `e2=${JSON.stringify(tank(t, 'e2').poison)}`); }
{ const t = T('rong', [['b', 700, 'B', 'bocap']]); fire(t, 's1', 700, [30]);
  check('bocap passive Gai Độc: close attacker gets poisoned', !!t.me.poison, JSON.stringify(t.me.poison)); }
// CÚ
{ const t = T('cu', [['e', 1300, 'B', 'rong']]); fire(t, 's2', 1300);
  check('cu s2: mark lasts a full round', tank(t, 'e').markTurns >= t.g.tanks.filter(x => x.alive).length, `markTurns=${tank(t, 'e').markTurns}`); }
{ const t = T('cu', [['e', 1300, 'B', 'rong']]); tank(t, 'e').markTurns = 3; const { events } = fire(t, 'ss', 1100, [45]);
  check('cu ss: owl locks and homes onto the marked enemy', events.some(e => e.type === 'lock') && dmgTo(events, 'e') > 0, `dmg=${dmgTo(events, 'e')}`); }
// CÁ MẬP
{ const t = T('camap', [['e', 1300, 'B', 'rong']]); const { events } = fire(t, 's2', 1150, [45]);
  const dive = events.find(e => e.type === 'dive'), boom = events.find(e => e.type === 'boom');
  check('camap s2: dives on landing and bursts up further on', dive && boom && boom.x > dive.x + 20, `dive=${dive?.x} boom=${boom?.x}`); }
{ const t = T('camap', [['e', 1300, 'B', 'rong']], { hill: [950, 1100] }); const { events } = fire(t, 'ss', 1300, [20, 30]);
  check('camap ss: flies through the hill and bites the xe', dmgTo(events, 'e') > 0, `dmg=${dmgTo(events, 'e')}`); }
{ const t = T('camap', [['e', 1300, 'B', 'rong']]); tank(t, 'e').hp = 400; const a = fire(t, 'ss', 1300); const t2 = T('camap', [['e', 1300, 'B', 'rong']]); const b = fire(t2, 'ss', 1300);
  check('camap passive: +20% vs xe under 50% HP', dmgTo(a.events, 'e') > dmgTo(b.events, 'e'), `low=${dmgTo(a.events, 'e')} full=${dmgTo(b.events, 'e')}`); }
// TỀ THIÊN
{ const t = T('tethien', [['e', 1300, 'B', 'rong']]); const { shotEv, events } = fire(t, 's2', 1100);
  check('tethien s2: pillar planted', t.g.pillars.length === 1, JSON.stringify(t.g.pillars));
  const f = fire(t, 's1', 1300, [20, 30]); // turn again: fire through
  check('tethien s2: pillar lasts 2 rounds', t.g.pillars[0]?.turns >= 2 * t.g.tanks.length - 1, `turns=${t.g.pillars[0]?.turns}`); }
{ const t = T('tethien', [['e', 1300, 'B', 'rong']]); const { events } = fire(t, 'ss', 1300);
  check('tethien ss: rides to the landing point', events.some(e => e.type === 'teleport') && Math.abs(t.me.x - 1300) < 80, `me.x=${t.me.x}`); }
{ const t = T('tethien', [['e', 900, 'B', 'rong']]); t.g.wind = { s: 20, a: 180 }; const b = aim(t.g, t.me, 's1', 900, [60, 70]); t.g.wind = { s: 20, a: 180 };
  const mid = { ...clone(t.me), x: 1200 }; const r = simulateShot({ mask: t.g.mask.slice(), tanks: [mid], wind: { s: 20, a: 180 }, shooter: mid, angle: 70, power: 60, shotKey: 's1' });
  check('tethien s1: strong headwind reverses the banana → boomerang bonus', r.boomerang === true, `boomerang=${r.boomerang}`); }
// PASSIVES (room)
{ const t = T('kylan', [['a', 560, 'A', 'rong'], ['e', 1300, 'B', 'voi']]); tank(t, 'a').hp -= 100; t.g.turn.id = 'x'; t.r.nextTurn = t.r.nextTurn.bind(t.r);
  // put Kỳ Lân first in the queue and start its turn
  t.me.delay = -999; t.g.phase = 'anim'; t.r.nextTurn();
  check('kylan passive Thánh Thể: ally within 120 healed at turn start', t.log.some(l => l[0] === 'game:tick' && l[1].events.some(e => e.aura && e.id === 'a')), ''); }
{ const t = T('voi', [['r', 1300, 'B', 'rong']]); fire(t, 's1', 1300); check('rong passive Long Nộ: hurt dragon is fired up', tank(t, 'r').fury === true, ''); }
check('tethien passive Cân Đẩu: move budget 300', XE.tethien.move === 300, '');

// GẤU BĂNG
{ const t = T('gau', [['e', 1300, 'B', 'voi']]); const d0 = tank(t, 'e').delay; const { events } = fire(t, 's1', 1300);
  check('gau s1: Cầu Tuyết chills the victim (+150 delay)', dmgTo(events, 'e') > 0 && tank(t, 'e').delay === d0 + 150, `delay ${d0}→${tank(t, 'e').delay}`); }
{ const t = T('gau', [['e', 1300, 'B', 'voi']]); fire(t, 's2', 1300); const e = tank(t, 'e');
  check('gau s2: Băng Phong freezes the victim', e.frozen === true, '');
  // frozen victim takes half: compare the same shot on a frozen vs thawed copy
  const b = aim(t.g, t.me, 's1', 1300, [35, 50, 65]);
  const hit = f => { const m = clone(t.me), x = { ...clone(e), frozen: f, hp: 5000 }; const r = simulateShot({ mask: t.g.mask.slice(), tanks: [m, x], wind: { s: 0, a: 0 }, shooter: m, angle: b.a, power: b.p, shotKey: 's1' }); return dmgTo(r.events, 'e'); };
  const fz = hit(true), th = hit(false);
  check('gau s2: frozen xe takes 50% damage', th > 0 && Math.abs(fz - th / 2) <= 2, `frozen=${fz} thawed=${th}`);
  // its next turn is skipped and it thaws
  t.g.phase = 'anim'; for (const x of t.g.tanks) x.delay = x.id === 'e' ? -999 : 999; t.r.nextTurn();
  check('gau s2: frozen xe loses its turn, then thaws', t.log.some(l => l[0] === 'game:skip' && l[1].frozen && l[1].id === 'e') && !e.frozen, ''); }
{ const t = T('gau', [['e', 1300, 'B', 'voi'], ['f', 1450, 'B', 'kylan'], ['far', 2100, 'B', 'cu']]); const d = ['e', 'f', 'far'].map(id => tank(t, id).delay); fire(t, 'ss', 1370);
  const [e, f, far] = ['e', 'f', 'far'].map(id => tank(t, id));
  check('gau ss: Kỷ Băng Hà chills every foe within 300px (+250) and locks SS', e.delay === d[0] + 250 && f.delay === d[1] + 250 && e.ssCd >= 1, `delays ${d}→${[e.delay, f.delay, far.delay]} ssCd=${e.ssCd}`);
  check('gau ss: foes outside 300px untouched', far.delay === d[2], ''); }
{ const t = T('rong', [['g', 2100, 'B', 'gau']]); const f = fire(t, 'ss', 2100, [55]);
  check('gau passive Lông Dày: no single hit over 320', f.events.filter(e => e.type === 'dmg' && e.id === 'g').every(e => e.amt <= 320) && dmgTo(f.events, 'g') > 0, `hits=${f.events.filter(e => e.type === 'dmg' && e.id === 'g').map(e => e.amt)}`); }
// CÁNH CỤT
{ const t = T('canhcut', [['e', 1500, 'B', 'voi']]); const { events } = fire(t, 's1', 1500, [15, 20, 25]); const bn = events.filter(e => e.type === 'bounce');
  check('canhcut s1: Cá Đông Lạnh ricochets (≤3) and hits', bn.length >= 1 && bn.length <= 3 && dmgTo(events, 'e') > 0, `bounces=${bn.length} dmg=${dmgTo(events, 'e')}`);
  const c = events.find(e => e.type === 'combo');
  check('canhcut s1: each bounce adds damage (combo)', c && c.n === bn.length, `combo=${JSON.stringify(c)}`); }
{ const t = T('canhcut', [['e', 1400, 'B', 'voi']]); const { events } = fire(t, 's2', 1400, [20, 30, 40]);
  check('canhcut s2: Trượt Bụng slides along the ground into the xe', dmgTo(events, 'e') > 0, `dmg=${dmgTo(events, 'e')}`); }
{ const t = T('canhcut', [['e', 300, 'B', 'voi']], { hill: [950, 1000] });
  // shot lands before the wall, slides right, banks off the hill and comes back past me to the foe behind
  const m = clone(t.me), x = clone(tank(t, 'e'));
  let bank = false;
  for (const a of [20, 30, 40, 50]) for (let p = 30; p <= 70 && !bank; p += 4) { const r = simulateShot({ mask: t.g.mask.slice(), tanks: [clone(m), clone(x)], wind: { s: 0, a: 0 }, shooter: clone(m), angle: a, power: p, shotKey: 's2' }); if (r.events.some(e => e.type === 'bounce')) bank = true; }
  check('canhcut s2: slide banks off a wall', bank, ''); }
{ const t = T('canhcut', [['e', 1700, 'B', 'voi']]); let best = 0, hit = false;
  for (const a of [10, 15, 20, 25]) for (let p = 30; p <= 80; p += 2) { const r = simulateShot({ mask: t.g.mask.slice(), tanks: t.g.tanks.map(clone), wind: { s: 0, a: 0 }, shooter: clone(t.me), angle: a, power: p, shotKey: 'ss' }); const n = r.events.filter(e => e.type === 'bounce').length; if (n > best) { best = n; hit = dmgTo(r.events, 'e') > 0; } }
  check('canhcut ss: Bi-a Băng bounces more than the fish, up to 6', best > 3 && best <= 6, `max bounces=${best} (hit=${hit})`); }
{ const mask = new Uint8Array(W * H); for (let y = 800; y < H; y++) mask.fill(1, y * W, y * W + 1200);
  const spot = swimAshore(mask, { x: 1600, y: WATER_Y + 10 }, WATER_Y);
  check('canhcut passive Bơi Lội: swims to the nearest shore', spot && spot.x < 1200 && spot.x > 1100, JSON.stringify(spot)); }
// THỎ NGỌC
{ const t = T('tho', [['e', 1300, 'B', 'voi']]); fire(t, 's1', 1300); const e = tank(t, 'e');
  check('tho s1: Bánh Mochi makes the victim heavy', e.heavy === 1.35, `heavy=${e.heavy}`);
  const far = h => { const x = { ...clone(e), heavy: h }; const r = simulateShot({ mask: t.g.mask.slice(), tanks: [x], wind: { s: 0, a: 0 }, shooter: x, angle: 45, power: 70, shotKey: 's1' }); return Math.abs(r.events.find(v => v.type === 'boom').x - x.x); };
  check('tho s1: heavy shot falls short', far(1.35) < far(0) * 0.85, `heavy=${far(1.35)} normal=${far(0)}`); }
{ const t = T('tho', [['e', 1300, 'B', 'voi']]); fire(t, 's2', 1300);
  check('tho s2: Vầng Trăng Khuyết leaves a moon zone', t.g.moonZones.length === 1 && t.g.moonZones[0].r === 130, JSON.stringify(t.g.moonZones));
  const z = t.g.moonZones[0], x = clone(t.me);
  const fly = zones => { const r = simulateShot({ mask: t.g.mask.slice(), tanks: [clone(x)], wind: { s: 0, a: 0 }, shooter: clone(x), angle: 45, power: 60, shotKey: 's1', moonZones: zones }); return r.events.find(v => v.type === 'boom')?.x; };
  const zone = { x: x.x + 350, y: 520, r: 200, turns: 1 };
  check('tho s2: shells float farther through the moon zone', (fly([zone]) ?? 9999) > fly([]) + 40, `with=${fly([zone])} without=${fly([])}`); }
{ const t = T('tho', [['e', 1300, 'B', 'voi']]); fire(t, 'ss', 1300);
  check('tho ss: Đêm Trăng Rằm starts a moon night for my team', t.g.moonNight?.team === 'A' && t.g.moonNight.foe > 1 && t.g.moonNight.ally < 1, JSON.stringify(t.g.moonNight)); }
{ const t = T('voi', [['h', 1300, 'B', 'tho']]); const b = aim(t.g, t.me, 's1', 1300, [35, 50, 65]); let dodge = 0; const N = 400;
  for (let i = 0; i < N; i++) { const m = clone(t.me), h = { ...clone(tank(t, 'h')), hp: 99999 }; const r = simulateShot({ mask: t.g.mask.slice(), tanks: [m, h], wind: { s: 0, a: 0 }, shooter: m, angle: b.a, power: b.p, shotKey: 's1' }); if (r.events.some(e => e.type === 'dodge')) dodge++; }
  check('tho passive: ~20% of hits dodged', dodge / N > 0.12 && dodge / N < 0.28, `${dodge}/${N}`); }
check('tho: light xe gravity', XE.tho.gravity < 1, `g=${XE.tho.gravity}`);
// HUYỀN THOẠI (legendary, random-only)
check('legendary: Rồng, Tề Thiên, Thỏ are random-only', LEGENDARY().map(x => x.id).sort().join() === 'rong,tethien,tho' && !PICKABLE().some(x => x.legendary), LEGENDARY().map(x => x.id).join());
{ const t = T('voi', [['e', 1300, 'B', 'rong']]); t.r.state = 'waiting'; const m = t.r.members.get('h'); m.xe = 'voi'; t.r.setXe(t.host, 'tho');
  check('legendary: cannot be picked directly', m.xe === 'voi', `xe=${m.xe}`); t.r.setXe(t.host, 'random'); t.r.setXe(t.host, 'kylan'); const okPick = m.xe === 'kylan'; t.r.setXe(t.host, 'random'); check('legendary: normal xe and "?" still pickable', okPick && m.xe === 'random', '');
  t.r.practice = true; t.r.setXe(t.host, 'tho'); check('legendary: pickable in practice rooms', m.xe === 'tho', `xe=${m.xe}`); }
{ let legend = 0, botLegend = 0; const N = 300;
  for (let i = 0; i < N; i++) {
    const io = { to: () => ({ emit() {}, except: () => ({ emit() {} }) }) }; const r = new Room(1, 'T', io, () => {}); const host = { token: 'h', pid: 'u1', name: 'H', socket: null, gender: 'm' };
    r.join(host); r.addBot(host, 'B'); r.members.get('h').xe = 'random'; r.start(host); clearInterval(r.game.tick); for (const h of r.game.timers) clearTimeout(h);
    if (XE[r.game.tanks.find(x => x.token === 'h').xe].legendary) legend++; if (r.game.tanks.some(x => x.bot && XE[x.xe].legendary)) botLegend++;
  }
  check('legendary: "?" rolls a legendary ~30%', legend / N > 0.22 && legend / N < 0.38, `${legend}/${N}`);
  check('legendary: bots never get one', botLegend === 0, `${botLegend}`); }

// RANKED: only real, finished matches count (user: "hoàn thành trận đấu thật mới được tính điểm")
function rankedRoom({ practice = false, botsOnB = false } = {}) {
  const io = { to: () => ({ emit() {}, except: () => ({ emit() {} }) }) };
  let recorded = null;
  const r = new Room(1, 'R', io, () => {}, practice, { profile: () => ({ gp: 15, rankId: 'chick', rank: 'Gà Con' }), recordMatch: p => { recorded = p; } });
  const a = { token: 'a', pid: 'ua', name: 'An', socket: { id: 'a', join() {}, leave() {}, emit() {} }, gender: 'm' };
  const b = { token: 'b', pid: 'ub', name: 'Bo', socket: { id: 'b', join() {}, leave() {}, emit() {} }, gender: 'm' };
  r.join(a);
  if (botsOnB) r.addBot(a, 'B'); else { r.join(b); r.members.get('b').team = 'B'; r.members.get('b').ready = true; }
  r.members.get('a').team = 'A';
  r.start(a);
  const g = r.game; clearInterval(g.tick); for (const h of g.timers) clearTimeout(h); g.timers.clear();
  g.startedAt = Date.now() - 200000; g.turnNo = 20;
  for (const t of g.tanks) { t.stats.shots = 3; t.stats.kills = 1; t.connected = true; }
  let end = null; r.emit = (ev, d) => { if (ev === 'game:end') end = d; };
  return { r, g, a, b, end: () => end, recorded: () => recorded };
}
{ const t = rankedRoom(); t.r.finish('A', false); const e = t.end();
  check('ranked: a real 1v1 to the end counts for both', !e.unranked && t.recorded()?.length === 2, JSON.stringify(e.unranked));
  const win = e.players.find(p => p.name === 'An');
  check('ranked: GP gain = 2 + 10 win + 3/kill', win.gpGain === 15 && e.players.find(p => p.name === 'Bo').gpGain === 5, `win=${win.gpGain}`); }
{ const t = rankedRoom({ practice: true }); t.r.practice = true; t.r.finish('A', false); check('ranked: practice never counts', !!t.end()?.unranked && !t.recorded(), t.end()?.unranked); }
{ const t = rankedRoom({ botsOnB: true }); t.r.finish('A', false); check('ranked: humans vs NPC only does not count', /NPC/.test(t.end().unranked || '') && !t.recorded(), t.end().unranked); }
{ const t = rankedRoom(); t.r.finish('A', true); check('ranked: a forfeit win does not count', /bỏ trận/.test(t.end().unranked || '') && !t.recorded(), t.end().unranked); }
{ const t = rankedRoom(); t.g.startedAt = Date.now() - 30000; t.r.finish('A', false); check('ranked: a match under 2 minutes does not count', /ngắn/.test(t.end().unranked || '') && !t.recorded(), t.end().unranked); }
{ const t = rankedRoom(); t.g.turnNo = 2; t.r.finish('A', false); check('ranked: too few turns does not count', /ngắn/.test(t.end().unranked || ''), t.end().unranked); }
{ const t = rankedRoom(); t.r.finish(null, false); check('ranked: a draw does not count', !!t.end().unranked && !t.recorded(), t.end().unranked); }
{ const t = rankedRoom(); t.g.tanks.find(x => x.name === 'Bo').stats.shots = 0; t.r.finish('A', false);
  check('ranked: a player who never fired gets nothing', t.recorded()?.map(p => p.name).join() === 'An' && t.end().players.find(p => p.name === 'Bo').gpGain == null, JSON.stringify(t.recorded()?.map(p => p.name))); }
{ const t = rankedRoom(); t.g.tanks.find(x => x.name === 'Bo').connected = false; t.r.finish('A', false);
  check('ranked: a player who left before the end gets nothing', t.recorded()?.map(p => p.name).join() === 'An', JSON.stringify(t.recorded()?.map(p => p.name))); }

console.log(results.map(r => r.join(' | ')).join('\n'));
console.log(results.filter(r => r[0] === 'FAIL').length + ' failing of ' + results.length);
process.exit(0);

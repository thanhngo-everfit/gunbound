// Vercel edition: the room's host runs the authoritative Room (server/room.js, unchanged) in this worker.
// Worker timers keep running at full speed when the host's tab is in the background, unlike the page's own.
// The page relays everything over Ably (net-ably.js): commands in, batched events out.
import { Room } from '/server/room.js';
import { MAP_IDS, registerMask } from '/shared/physics.js';
import { pidOf, cleanGender } from '/shared/ids.js';

const BATCH_MS = 50;
const HEARTBEAT_MS = 20000;
const RECONNECT_GRACE_MS = 60000;

let room = null;
const players = new Map(); // pid -> player (token = pid; it never leaves this worker)
const profiles = new Map(), asked = new Set();
const graces = new Map();
let queue = [];

const post = m => postMessage(m);
const send = item => queue.push(item);
// coalesce a batch: of several game:pos / game:aim for the same xe only the last one matters
function flush() {
  if (!queue.length) return;
  const items = [], last = new Map();
  queue.forEach((it, i) => { if (it.ev === 'game:pos' || it.ev === 'game:aim') last.set(`${it.ev}:${it.data?.id}:${it.except || ''}`, i); });
  queue.forEach((it, i) => { if ((it.ev !== 'game:pos' && it.ev !== 'game:aim') || last.get(`${it.ev}:${it.data?.id}:${it.except || ''}`) === i) items.push(it); });
  queue = [];
  post({ type: 'batch', items });
}
setInterval(flush, BATCH_MS);
setInterval(() => room && post({ type: 'heartbeat', info: room.info() }), HEARTBEAT_MS);

// Socket.IO look-alikes for Room: a broadcast "io" and one "socket" per player
const io = { to: () => ({ emit: (ev, data) => send({ ev, data }), except: sid => ({ emit: (ev, data) => send({ ev, data, except: sid }) }) }) };
const socketFor = pid => ({ id: pid, join() {}, leave() {}, emit: (ev, data) => send({ ev, data, to: pid }) });

const hooks = {
  profile(name) {
    if (profiles.has(name)) return profiles.get(name);
    if (!asked.has(name)) { asked.add(name); post({ type: 'needProfile', name }); }
    return null;
  },
  recordMatch: (list, winner) => post({ type: 'match', players: list, winner }),
};

function playerFor(name, gender) {
  const pid = pidOf(name);
  let p = players.get(pid);
  if (!p) { p = { token: pid, pid, name, gender: cleanGender(gender), socket: socketFor(pid), roomId: null }; players.set(pid, p); }
  else if (gender) p.gender = cleanGender(gender);
  return p;
}

async function loadMasks() {
  await Promise.all(MAP_IDS.map(async m => {
    try {
      const r = await fetch(`/assets/maps/mask-${m}.bin`);
      if (!r.ok) return;
      registerMask(m, new Uint8Array(await new Response(r.body.pipeThrough(new DecompressionStream('deflate'))).arrayBuffer()));
    } catch {}
  }));
}

// same command set as the Node server's socket handlers (server/index.js)
const commands = {
  join(p) {
    if (room.members.has(p.token)) { reconnect(p); return { ok: true }; }
    return room.join(p);
  },
  'room:leave'(p) { room.leave(p); players.delete(p.pid); },
  'player:gender'(p, { gender }) { p.gender = cleanGender(gender); room.sync(); },
  'room:addBot'(p, { team }) { room.addBot(p, team); },
  'room:removeBot'(p, { id }) { room.removeBot(p, id); },
  'room:settings'(p, d) { room.setSettings(p, d); },
  'room:team'(p, { team }) { room.setTeam(p, team); },
  'room:xe'(p, { xe }) { room.setXe(p, xe); },
  'room:ready'(p, { ready }) { room.setReady(p, ready); },
  'room:map'(p, { map }) { room.setMap(p, map); },
  'room:start'(p) { return room.start(p) || { error: 'Không ở trong phòng' }; },
  chat(p, { text }) { room.chat(p, text); },
  'game:progress'(p, { pct }) { room.progress(p, pct); },
  'game:item'(p, d) { room.useItem(p, d); },
  'game:drop'(p, d) { room.setDrop(p, d); },
  'game:input'(p, d) { room.input(p, d); },
  'game:aim'(p, d) { room.aim(p, d); },
  'game:fire'(p, d) { room.fire(p, d); },
  'game:pass'(p) { const t = room.activeTank(p); if (t) room.skip(t, false); },
};

function reconnect(p) {
  clearTimeout(graces.get(p.pid)); graces.delete(p.pid);
  p.socket = socketFor(p.pid);
  room.onReconnect(p);
}

onmessage = async ({ data: m }) => {
  if (m.type === 'init') {
    await loadMasks();
    room = new Room(m.id, m.name, io, () => post({ type: 'info', info: room.info() }), m.practice, hooks);
    const host = playerFor(m.host.name, m.host.gender);
    post({ type: 'ack', to: host.pid, ackId: m.ackId, res: room.join(host) });
    return;
  }
  if (!room) return;
  if (m.type === 'profiles') {
    for (const [n, pr] of Object.entries(m.profiles)) profiles.set(n, pr);
    room.sync();
  } else if (m.type === 'refreshProfiles') {
    // after a match: forget cached ranks so the room shows the new GP
    profiles.clear(); asked.clear(); room.sync();
  } else if (m.type === 'presence') {
    const p = players.get(pidOf(m.name));
    if (!p || p.token === room.hostToken && m.action === 'leave') return;
    if (m.action === 'leave' && p.socket) {
      p.socket = null;
      room.onDisconnect(p);
      graces.set(p.pid, setTimeout(() => { if (p.socket) return; room.leave(p); players.delete(p.pid); }, RECONNECT_GRACE_MS));
    } else if (m.action === 'enter' && !p.socket && room.members.has(p.token)) reconnect(p);
  } else if (m.type === 'cmd') {
    const fn = commands[m.ev];
    const p = m.ev === 'join' ? playerFor(m.name, m.data?.gender) : players.get(pidOf(m.name));
    let res;
    if (!fn) res = { error: 'Lệnh không hợp lệ' };
    else if (!p || (m.ev !== 'join' && !room.members.has(p.token))) res = { error: 'Không ở trong phòng' };
    else { try { res = fn(p, m.data || {}); } catch (e) { console.error(e); res = { error: String(e.message || e) }; } }
    if (m.ackId != null) post({ type: 'ack', to: pidOf(m.name), ackId: m.ackId, res: res ?? null });
  }
};

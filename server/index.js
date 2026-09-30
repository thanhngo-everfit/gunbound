import express from 'express';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import { randomUUID, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { Room } from './room.js';
import { registerMask, MAP_IDS } from '../shared/physics.js';
import { leaderboard, profile } from './stats.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 3000;
const RECONNECT_GRACE_MS = 60000;

// painted-map masks (same files the browser loads)
for (const id of MAP_IDS) {
  try { registerMask(id, new Uint8Array(zlib.inflateSync(fs.readFileSync(path.join(ROOT, 'public/assets/maps', `mask-${id}.bin`))))); }
  catch { console.log(`(no painted mask for ${id}, using generated terrain)`); }
}

const app = express();
app.use(express.static(path.join(ROOT, 'public')));
app.use('/shared', express.static(path.join(ROOT, 'shared')));
const server = http.createServer(app);
const io = new Server(server);

const players = new Map(); // token -> { token, pid, name, socket, roomId, graceTimer }
const rooms = new Map();
let nextRoomId = 1;
let nextPid = 1;

const lobbyList = () => [...rooms.values()].map(r => r.info());

// Name + 4-digit PIN "accounts": the first login claims a name, later logins must match the PIN.
// Stored hashed in data/accounts.json. Not real security, just stops casual rank spoofing.
const ACCOUNTS_FILE = path.join(ROOT, 'data', 'accounts.json');
let accounts = {};
try { accounts = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf8')); } catch { accounts = {}; }
const pinHash = (name, pin) => createHash('sha256').update(`thu-chien:${name.toLowerCase()}:${pin}`).digest('hex');
function checkAccount(name, pin) {
  if (!/^\d{4}$/.test(String(pin || ''))) return 'Mã PIN gồm 4 chữ số';
  const key = name.toLowerCase();
  if (!accounts[key]) {
    accounts[key] = pinHash(name, pin);
    fs.mkdirSync(path.dirname(ACCOUNTS_FILE), { recursive: true });
    fs.writeFile(ACCOUNTS_FILE, JSON.stringify(accounts), () => {});
    return null;
  }
  return accounts[key] === pinHash(name, pin) ? null : 'Tên này đã có người dùng, sai mã PIN';
}
const lobbyState = () => ({ rooms: lobbyList(), online: [...players.values()].filter(p => p.socket).length, leaderboard: leaderboard(10) });
const broadcastLobby = () => io.to('lobby').emit('lobby', lobbyState());
const cleanName = s => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 16);
const PILOTS = ['m', 'f', 'm2', 'f2'];
const cleanGender = g => (PILOTS.includes(g) ? g : 'm');

function leaveRoom(p) {
  const room = rooms.get(p.roomId);
  if (!room) { p.roomId = null; return; }
  room.leave(p);
  if (room.isEmpty()) { room.destroy(); rooms.delete(room.id); }
  broadcastLobby();
}

io.on('connection', socket => {
  let me = null;
  const ok = fn => (...args) => { if (me) fn(...args); };
  const room = () => (me && rooms.get(me.roomId)) || null;

  socket.on('hello', ({ name, token, gender, pin } = {}, ack = () => {}) => {
    name = cleanName(name);
    if (!name) return ack({ error: 'Vui lòng nhập tên' });
    me = token && players.get(token);
    // reconnecting with a live session token skips the PIN; a fresh login needs it
    if (!me) {
      const err = checkAccount(name, pin);
      if (err) return ack({ error: err });
    }
    if (me) {
      clearTimeout(me.graceTimer);
      if (me.socket && me.socket !== socket) me.socket.disconnect(true);
      me.socket = socket;
      if (!me.roomId) me.name = name;
      me.gender = cleanGender(gender ?? me.gender);
    } else {
      me = { token: randomUUID(), pid: 'u' + nextPid++, name, gender: cleanGender(gender), socket, roomId: null };
      players.set(me.token, me);
    }
    ack({ token: me.token, pid: me.pid, name: me.name, gender: me.gender, roomId: me.roomId });
    const r = room();
    if (r) r.onReconnect(me);
    else socket.join('lobby');
    broadcastLobby();
  });

  // the asking player also gets their own profile (rank, GP, progress), even outside the top 10
  socket.on('lobby:get', ok(() => socket.emit('lobby', { ...lobbyState(), me: profile(me.name) })));

  socket.on('room:create', ok(({ name, practice } = {}, ack = () => {}) => {
    if (me.roomId) leaveRoom(me);
    const id = String(nextRoomId++);
    const r = new Room(id, cleanName(name) || (practice ? `Luyện tập - ${me.name}` : `Phòng của ${me.name}`), io, broadcastLobby, !!practice);
    rooms.set(id, r);
    socket.leave('lobby');
    ack(r.join(me));
  }));

  socket.on('room:join', ok(({ id } = {}, ack = () => {}) => {
    const r = rooms.get(String(id));
    if (!r) return ack({ error: 'Phòng không tồn tại' });
    if (me.roomId && me.roomId !== r.id) leaveRoom(me);
    const res = r.join(me);
    if (res.ok) socket.leave('lobby');
    ack(res);
  }));

  socket.on('room:leave', ok(() => {
    leaveRoom(me);
    socket.join('lobby');
    broadcastLobby();
  }));

  socket.on('player:gender', ok(({ gender } = {}) => {
    me.gender = cleanGender(gender);
    room()?.sync();
  }));
  socket.on('room:addBot', ok(({ team } = {}) => room()?.addBot(me, team)));
  socket.on('room:removeBot', ok(({ id } = {}) => room()?.removeBot(me, id)));
  socket.on('room:settings', ok((data = {}) => room()?.setSettings(me, data)));
  socket.on('room:team', ok(({ team } = {}) => room()?.setTeam(me, team)));
  socket.on('room:xe', ok(({ xe } = {}) => room()?.setXe(me, xe)));
  socket.on('room:ready', ok(({ ready } = {}) => room()?.setReady(me, ready)));
  socket.on('room:map', ok(({ map } = {}) => room()?.setMap(me, map)));
  socket.on('room:start', ok((_, ack = () => {}) => ack(room()?.start(me) || { error: 'Không ở trong phòng' })));
  socket.on('chat', ok(({ text } = {}) => room()?.chat(me, text)));

  socket.on('game:progress', ok(({ pct } = {}) => room()?.progress(me, pct)));
  socket.on('game:item', ok((data = {}) => room()?.useItem(me, data)));
  socket.on('game:drop', ok((data = {}) => room()?.setDrop(me, data)));
  socket.on('game:input', ok((data = {}) => room()?.input(me, data)));
  socket.on('game:aim', ok((data = {}) => room()?.aim(me, data)));
  socket.on('game:fire', ok((data = {}) => room()?.fire(me, data)));
  socket.on('game:pass', ok(() => {
    const r = room();
    const t = r?.activeTank(me);
    if (t) r.skip(t, false);
  }));

  socket.on('disconnect', () => {
    if (!me || me.socket !== socket) return;
    me.socket = null;
    const p = me;
    room()?.onDisconnect(p);
    p.graceTimer = setTimeout(() => {
      if (p.socket) return;
      leaveRoom(p);
      players.delete(p.token);
      broadcastLobby();
    }, RECONNECT_GRACE_MS);
    broadcastLobby();
  });
});

server.listen(PORT, () => {
  const lan = Object.values(os.networkInterfaces()).flat().find(i => i && i.family === 'IPv4' && !i.internal);
  console.log(`Thú Chiến đang chạy:`);
  console.log(`  Máy này:  http://localhost:${PORT}`);
  if (lan) console.log(`  Mạng LAN: http://${lan.address}:${PORT}`);
});

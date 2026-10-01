// Vercel edition of the network layer. Same surface as the Socket.IO client the game uses (on / off / emit with
// an ack callback), but:
// - login, lobby, room list, ranks: Vercel functions in /api (Redis behind them)
// - a room lives in its host's browser: a worker runs server/room.js and this page relays it over Ably
//   (channel tc:room:<id>; guests publish "c" commands, the host publishes "b" batches of events and "a" acks)
// Ably's free plan is plenty for an office: the host sends at most 20 batched messages a second.
import { pidOf } from '/shared/ids.js';

const CHUNK = 45000;           // keep each Ably message well under its 64 KB limit
const ACK_TIMEOUT_MS = 9000;
const HOST_GONE_MS = 12000;    // a host that drops this long closes the room
const LOBBY_POLL_MS = 30000;

const api = async (path, opts) => {
  const r = await fetch(path, opts && { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(opts) });
  return r.json();
};
const toB64 = buf => { let s = ''; const b = new Uint8Array(buf); for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); };
const fromB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const deflate = async str => toB64(await new Response(new Blob([str]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
const inflate = async b64 => new Response(new Blob([fromB64(b64)]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();

export class AblySocket {
  constructor() {
    this.listeners = new Map();
    this.me = null;           // { token, pid, name, gender }
    this.ably = null;
    this.room = null;         // { id, chan, host, hostPid, isHost, worker, info }
    this.acks = new Map();
    this.ackSeq = 0;
    this.parts = new Map();   // chunked messages being reassembled
    this.inbox = Promise.resolve(); // keeps decoded batches in order
    this.outbox = Promise.resolve();
    this.connected = true;
    setTimeout(() => this.fire('connect'), 0);
    setInterval(() => { if (this.me && !this.room && document.visibilityState === 'visible') this.refreshLobby(); }, LOBBY_POLL_MS);
    addEventListener('pagehide', () => this.onPageHide());
  }

  on(ev, fn) { if (!this.listeners.has(ev)) this.listeners.set(ev, new Set()); this.listeners.get(ev).add(fn); return this; }
  off(ev, fn) { this.listeners.get(ev)?.delete(fn); return this; }
  fire(ev, data) { for (const fn of [...(this.listeners.get(ev) || [])]) { try { fn(data); } catch (e) { console.error(e); } } }

  emit(ev, data, ack) {
    const done = typeof ack === 'function' ? ack : () => {};
    this.handle(ev, data || {}, done).catch(e => { console.error(e); done({ error: `Lỗi kết nối: ${e.message || e}` }); });
  }

  async handle(ev, data, ack) {
    switch (ev) {
      case 'hello': return ack(await this.hello(data));
      case 'lobby:get': return this.refreshLobby();
      case 'room:create': return ack(await this.createRoom(data));
      case 'room:join': return ack(await this.joinRoom(String(data.id)));
      case 'room:leave': return this.leaveRoom();
      default: return this.command(ev, data, ack);
    }
  }

  // ---------- session ----------

  async hello({ name, pin, token, gender }) {
    const res = await api('/api/login', { name, pin, token, gender });
    if (res.error) return res;
    this.me = res;
    if (!this.ably) await this.connectAbly();
    // after a reload, slip back into the room we were in (a room we hosted died with the old page)
    const last = sessionStorage.getItem('tc-room');
    if (last && !this.room) setTimeout(() => this.joinRoom(last, true), 0);
    return res;
  }

  async connectAbly() {
    if (!window.Ably) throw new Error('Không tải được Ably');
    this.ably = new window.Ably.Realtime({ authUrl: '/api/ably-token', authParams: { s: this.me.token }, echoMessages: false });
    await new Promise((ok, fail) => {
      this.ably.connection.once('connected', ok);
      this.ably.connection.once('failed', s => fail(new Error(s?.reason?.message || 'Ably không kết nối được')));
    });
    this.lobby = this.ably.channels.get('tc:lobby');
    this.lobby.subscribe('changed', () => { if (!this.room) this.refreshLobby(); });
    await this.lobby.presence.enter({ pid: this.me.pid });
  }

  async refreshLobby() {
    if (!this.me) return;
    this.fire('lobby', await api(`/api/lobby?name=${encodeURIComponent(this.me.name)}`));
  }

  // ---------- hosting ----------

  async createRoom({ name, practice }) {
    if (this.room) await this.leaveRoom();
    const roomName = String(name || '').trim().slice(0, 16) || (practice ? `Luyện tập - ${this.me.name}` : `Phòng của ${this.me.name}`);
    const info = { name: roomName, practice: !!practice, state: 'waiting', count: 1, max: 10, host: this.me.name, map: 'dong-co', settings: {} };
    const reg = await api('/api/rooms', { s: this.me.token, action: 'create', info });
    if (reg.error) return reg;
    const worker = new Worker('/js/host-worker.js', { type: 'module' });
    const chan = this.ably.channels.get(`tc:room:${reg.id}`);
    this.room = { id: reg.id, chan, host: this.me.name, hostPid: this.me.pid, isHost: true, worker, info };
    worker.onmessage = e => this.fromWorker(e.data);
    worker.onerror = e => { console.error('host worker', e); };
    chan.subscribe('c', msg => worker.postMessage({ type: 'cmd', name: msg.clientId, ev: msg.data.ev, data: msg.data.data, ackId: msg.data.ackId }));
    chan.presence.subscribe(['enter', 'leave'], m => { if (m.clientId !== this.me.name) worker.postMessage({ type: 'presence', name: m.clientId, action: m.action }); });
    await chan.presence.enter({ host: true });
    sessionStorage.setItem('tc-room', reg.id);
    return new Promise(resolve => {
      const ackId = ++this.ackSeq;
      this.acks.set(ackId, resolve);
      worker.postMessage({ type: 'init', id: reg.id, name: roomName, practice: !!practice, host: { name: this.me.name, gender: this.me.gender }, ackId });
    });
  }

  fromWorker(m) {
    const r = this.room;
    if (!r?.isHost) return;
    if (m.type === 'batch') {
      // our own share is delivered here; the rest goes out over Ably in one message
      for (const it of m.items) if ((!it.to || it.to === this.me.pid) && it.except !== this.me.pid) this.fire(it.ev, it.data);
      const out = m.items.filter(it => it.to !== this.me.pid);
      if (out.length) this.publish('b', out);
    } else if (m.type === 'ack') {
      if (m.to === this.me.pid) { const fn = this.acks.get(m.ackId); this.acks.delete(m.ackId); fn?.(m.res); }
      else this.publish('a', [{ to: m.to, ackId: m.ackId, res: m.res }]);
    } else if (m.type === 'info' || m.type === 'heartbeat') {
      r.info = m.info;
      clearTimeout(r.infoTimer);
      r.infoTimer = setTimeout(() => this.pushInfo(), m.type === 'heartbeat' ? 0 : 1200);
    } else if (m.type === 'needProfile') {
      (r.needNames ||= new Set()).add(m.name);
      clearTimeout(r.profileTimer);
      r.profileTimer = setTimeout(() => this.loadProfiles(), 250);
    } else if (m.type === 'match') {
      api('/api/match', { s: this.me.token, roomId: r.id, matchId: String(Date.now()), players: m.players, winner: m.winner })
        .then(() => { r.worker.postMessage({ type: 'refreshProfiles' }); this.refreshLobby(); }).catch(console.error);
    }
  }

  async pushInfo() {
    const r = this.room;
    if (!r?.isHost) return;
    await api('/api/rooms', { s: this.me.token, action: 'update', id: r.id, info: r.info }).catch(() => {});
    this.lobby?.publish('changed', { id: r.id });
  }

  async loadProfiles() {
    const r = this.room;
    if (!r?.needNames?.size) return;
    const names = [...r.needNames]; r.needNames.clear();
    const profiles = await api(`/api/profiles?names=${encodeURIComponent(names.join('|'))}`).catch(() => null);
    if (profiles && this.room === r) r.worker.postMessage({ type: 'profiles', profiles });
  }

  // publish in order; big payloads are deflated and split into chunks
  publish(name, items) {
    const chan = this.room?.chan;
    if (!chan) return;
    this.outbox = this.outbox.then(async () => {
      const json = JSON.stringify(items);
      if (json.length < CHUNK) return chan.publish(name, { items });
      const z = await deflate(json), id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, n = Math.ceil(z.length / CHUNK);
      for (let i = 0; i < n; i++) await chan.publish('z', { id, i, n, kind: name, part: z.slice(i * CHUNK, (i + 1) * CHUNK) });
    }).catch(e => console.error('publish', e));
  }

  // ---------- joining someone else's room ----------

  async joinRoom(id, silent = false) {
    if (this.room?.id === id) return { ok: true };
    const reg = await api(`/api/rooms?id=${encodeURIComponent(id)}`);
    if (reg.error || reg.host === this.me.name) {
      sessionStorage.removeItem('tc-room');
      if (!reg.error) api('/api/rooms', { s: this.me.token, action: 'delete', id }).catch(() => {});
      return silent ? null : { error: reg.error || 'Phòng đã đóng' };
    }
    if (this.room) await this.leaveRoom();
    const chan = this.ably.channels.get(`tc:room:${id}`);
    const r = { id, chan, host: reg.host, hostPid: reg.hostPid, isHost: false };
    this.room = r;
    chan.subscribe(msg => this.fromHost(r, msg));
    chan.presence.subscribe(['enter', 'leave'], m => {
      if (m.clientId !== r.host) return;
      clearTimeout(r.goneTimer);
      if (m.action === 'leave') r.goneTimer = setTimeout(() => this.roomClosed(r, 'Chủ phòng đã mất kết nối, phòng đã đóng.'), HOST_GONE_MS);
    });
    await chan.presence.enter({ pid: this.me.pid });
    const res = await this.command('join', { gender: this.me.gender });
    if (res?.ok) sessionStorage.setItem('tc-room', id);
    else { await this.detach(r); if (silent) return null; }
    return res;
  }

  fromHost(r, msg) {
    if (msg.clientId !== r.host || this.room !== r) return;
    if (msg.name === 'closed') return this.roomClosed(r, 'Chủ phòng đã đóng phòng.');
    let job;
    if (msg.name === 'z') {
      const { id, i, n, kind, part } = msg.data;
      const got = this.parts.get(id) || { n, kind, parts: [] };
      got.parts[i] = part; this.parts.set(id, got);
      if (got.parts.filter(Boolean).length < n) return;
      this.parts.delete(id);
      job = inflate(got.parts.join('')).then(JSON.parse);
    } else if (msg.name === 'b' || msg.name === 'a') job = Promise.resolve(msg.data.items);
    else return;
    this.inbox = this.inbox.then(() => job).then(items => {
      for (const it of items) {
        if (it.ackId != null) { if (it.to === this.me.pid) { const fn = this.acks.get(it.ackId); this.acks.delete(it.ackId); fn?.(it.res); } continue; }
        if ((!it.to || it.to === this.me.pid) && it.except !== this.me.pid) this.fire(it.ev, it.data);
      }
    }).catch(e => console.error('inbox', e));
  }

  // a room command: straight into the worker when we host, over Ably otherwise
  command(ev, data, ack) {
    const r = this.room;
    return new Promise(resolve => {
      const done = res => { ack?.(res); resolve(res); };
      if (!r) return done({ error: 'Không ở trong phòng' });
      const ackId = ++this.ackSeq;
      this.acks.set(ackId, done);
      setTimeout(() => { if (this.acks.delete(ackId)) done({ error: 'Chủ phòng không phản hồi' }); }, ACK_TIMEOUT_MS);
      if (r.isHost) r.worker.postMessage({ type: 'cmd', name: this.me.name, ev, data, ackId });
      else r.chan.publish('c', { ev, data, ackId });
    });
  }

  // ---------- leaving ----------

  async leaveRoom() {
    const r = this.room;
    if (!r) return;
    sessionStorage.removeItem('tc-room');
    if (r.isHost) {
      // the room lives in this page: closing it ends it for everyone
      await r.chan.publish('closed', {}).catch(() => {});
      r.worker.terminate();
      api('/api/rooms', { s: this.me.token, action: 'delete', id: r.id }).catch(() => {});
      this.lobby?.publish('changed', { id: r.id });
    } else {
      await this.command('room:leave', {});
    }
    await this.detach(r);
    this.refreshLobby();
  }

  async detach(r) {
    if (this.room === r) this.room = null;
    clearTimeout(r.goneTimer); clearTimeout(r.infoTimer);
    try { r.chan.unsubscribe(); r.chan.presence.unsubscribe(); await r.chan.presence.leave(); await r.chan.detach(); } catch {}
  }

  roomClosed(r, why) {
    if (this.room !== r) return;
    sessionStorage.removeItem('tc-room');
    this.detach(r);
    this.fire('room:closed', { reason: why });
    this.refreshLobby();
  }

  onPageHide() {
    const r = this.room;
    if (!r?.isHost) return;
    try { r.chan.publish('closed', {}); } catch {}
    navigator.sendBeacon?.('/api/rooms', new Blob([JSON.stringify({ s: this.me.token, action: 'delete', id: r.id })], { type: 'application/json' }));
  }
}

export { pidOf };

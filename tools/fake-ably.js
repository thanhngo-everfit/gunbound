// Test double for the Ably browser SDK (only what net-ably.js uses), for tools/dev-vercel.mjs.
// Tabs of the same browser talk through a BroadcastChannel, so two tabs can play host and guest offline.
(() => {
  const bus = new BroadcastChannel('fake-ably');
  const tabs = new Set();
  class Presence {
    constructor(ch) { this.ch = ch; this.subs = []; this.members = new Map(); }
    async enter(data) { this.mine = data || {}; this.members.set(this.ch.rt.clientId, data); this.ch.rt.say({ k: 'pres', ch: this.ch.name, action: 'enter', clientId: this.ch.rt.clientId, data }); }
    async leave() { if (!this.mine) return; this.mine = null; this.members.delete(this.ch.rt.clientId); this.ch.rt.say({ k: 'pres', ch: this.ch.name, action: 'leave', clientId: this.ch.rt.clientId }); }
    subscribe(actions, fn) { if (typeof actions === 'function') { fn = actions; actions = null; } this.subs.push({ actions, fn }); }
    unsubscribe() { this.subs = []; }
    async get() { return [...this.members].map(([clientId, data]) => ({ clientId, data })); }
    got(m) {
      if (m.action === 'enter') this.members.set(m.clientId, m.data); else this.members.delete(m.clientId);
      for (const s of this.subs) if (!s.actions || s.actions.includes(m.action)) s.fn({ clientId: m.clientId, action: m.action, data: m.data });
    }
  }
  class Channel {
    constructor(rt, name) { this.rt = rt; this.name = name; this.subs = []; this.presence = new Presence(this); }
    subscribe(name, fn) { if (typeof name === 'function') { fn = name; name = null; } this.subs.push({ name, fn }); }
    unsubscribe() { this.subs = []; }
    async publish(name, data) { this.rt.say({ k: 'msg', ch: this.name, name, data: JSON.parse(JSON.stringify(data)), clientId: this.rt.clientId }); }
    async detach() {}
    got(m) { for (const s of this.subs) if (!s.name || s.name === m.name) s.fn({ name: m.name, data: m.data, clientId: m.clientId }); }
  }
  class Realtime {
    constructor(opts) {
      this.channelsMap = new Map(); this.handlers = {};
      this.channels = { get: n => { if (!this.channelsMap.has(n)) this.channelsMap.set(n, new Channel(this, n)); return this.channelsMap.get(n); } };
      this.connection = { once: (ev, fn) => { (this.handlers[ev] ||= []).push(fn); } };
      tabs.add(this);
      const q = new URLSearchParams(opts.authParams).toString();
      fetch(`${opts.authUrl}?${q}`).then(r => r.json()).then(tr => {
        this.clientId = tr.clientId;
        // ask the other tabs who is present where
        this.say({ k: 'sync?' });
        (this.handlers.connected || []).forEach(f => f());
      });
      addEventListener('pagehide', () => { for (const ch of this.channelsMap.values()) ch.presence.leave(); });
    }
    say(m) { bus.postMessage(m); }
    hear(m) {
      if (m.k === 'sync?') { for (const ch of this.channelsMap.values()) if (ch.presence.mine) this.say({ k: 'pres', ch: ch.name, action: 'enter', clientId: this.clientId, data: ch.presence.mine }); return; }
      const ch = this.channelsMap.get(m.ch);
      if (!ch) return;
      if (m.k === 'msg') ch.got(m); else if (m.k === 'pres') ch.presence.got(m);
    }
  }
  bus.onmessage = e => { for (const t of tabs) t.hear(e.data); };
  window.Ably = { Realtime };
})();

// Picks the network layer: the Node server (npm run dev) answers /api/config with "socket" and serves Socket.IO;
// the Vercel deployment answers "ably" (api/config.js) and the game runs over Ably with rooms hosted in browsers.
const loadScript = src => new Promise((ok, fail) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => fail(new Error(`Không tải được ${src}`)); document.head.appendChild(s); });

export async function createSocket() {
  let cfg = { mode: 'socket' };
  try { const r = await fetch('/api/config', { cache: 'no-store' }); if (r.ok) cfg = await r.json(); } catch {}
  if (cfg.mode === 'ably') {
    // tools/dev-vercel.mjs swaps in a same-browser fake so the Vercel path can be tested offline
    await loadScript(cfg.fakeAbly ? '/js/fake-ably.js' : 'https://cdn.ably.com/lib/ably.min-2.js');
    const { AblySocket } = await import('./net-ably.js');
    return new AblySocket();
  }
  await loadScript('/socket.io/socket.io.js');
  return window.io();
}

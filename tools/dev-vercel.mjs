// Local stand-in for the Vercel deployment: serves dist/ and runs the real api/*.js handlers, with an in-memory
// Upstash-compatible Redis and the fake Ably SDK (tools/fake-ably.js). Run: node tools/build-vercel.mjs && node tools/dev-vercel.mjs
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 3100;
process.env.KV_REST_API_URL = `http://localhost:${PORT}/__redis`;
process.env.KV_REST_API_TOKEN = 'dev';
process.env.ABLY_API_KEY ||= 'devapp.devkey:devsecret';
process.env.FAKE_ABLY = '1';
process.env.FAKE_GOOGLE = '1';

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.text({ type: 'text/plain' }));

// --- tiny Redis ---
const kv = new Map(), hashes = new Map(), ttl = new Map();
const alive = k => { const t = ttl.get(k); if (t && t < Date.now()) { kv.delete(k); ttl.delete(k); } return kv.has(k); };
function run([cmd, ...a]) {
  switch (String(cmd).toUpperCase()) {
    case 'GET': return alive(a[0]) ? kv.get(a[0]) : null;
    case 'SET': {
      const [k, v, ...o] = a, nx = o.includes('NX'), ex = o.indexOf('EX');
      if (nx && alive(k)) return null;
      kv.set(k, String(v)); if (ex >= 0) ttl.set(k, Date.now() + Number(o[ex + 1]) * 1000); return 'OK';
    }
    case 'EXPIRE': ttl.set(a[0], Date.now() + Number(a[1]) * 1000); return 1;
    case 'INCR': { const v = Number(kv.get(a[0]) || 0) + 1; kv.set(a[0], String(v)); return v; }
    case 'HGET': return hashes.get(a[0])?.get(a[1]) ?? null;
    case 'HSET': { const h = hashes.get(a[0]) || new Map(); hashes.set(a[0], h); h.set(a[1], a[2]); return 1; }
    case 'HDEL': { const h = hashes.get(a[0]); let n = 0; for (const f of a.slice(1)) n += h?.delete(f) ? 1 : 0; return n; }
    case 'HGETALL': return [...(hashes.get(a[0]) || [])].flat();
  }
  throw new Error(`unsupported ${cmd}`);
}
app.post('/__redis', (req, res) => { try { res.json({ result: run(req.body) }); } catch (e) { res.json({ error: e.message }); } });

// --- api/*.js with Vercel's req.query / req.body / res.status().json() ---
for (const f of fs.readdirSync(path.join(ROOT, 'api')).filter(f => f.endsWith('.js'))) {
  const mod = await import(path.join(ROOT, 'api', f));
  app.all(`/api/${f.replace(/\.js$/, '')}`, (req, res) => mod.default(req, res));
}
app.get('/js/fake-ably.js', (req, res) => res.sendFile(path.join(ROOT, 'tools', 'fake-ably.js')));
app.use(express.static(path.join(ROOT, 'dist')));
app.listen(PORT, () => console.log(`Vercel stand-in on http://localhost:${PORT}`));

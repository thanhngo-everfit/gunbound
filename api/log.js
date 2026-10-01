// Client error log, so freezes reported by players can be traced afterwards (no Vercel dashboard access needed).
// POST { where, message, stack, page }  → kept in the Redis list `errors` (newest first, last 200)
// GET                                   → the last 50, newest first
import { redis } from './_lib/redis.js';
import { handle, body } from './_lib/http.js';

const clip = (v, n) => String(v ?? '').slice(0, n);

export default handle(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') {
    const rows = (await redis('LRANGE', 'errors', 0, 49)) || [];
    return res.json(rows.map(r => { try { return JSON.parse(r); } catch { return r; } }));
  }
  const b = body(req);
  const row = { t: new Date().toISOString(), where: clip(b.where, 40), message: clip(b.message, 300), stack: clip(b.stack, 1500), page: clip(b.page, 80), ua: clip(req.headers['user-agent'], 120) };
  await redis('LPUSH', 'errors', JSON.stringify(row));
  await redis('LTRIM', 'errors', 0, 199);
  res.json({ ok: true });
});

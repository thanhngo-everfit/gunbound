// Room registry (Redis hash "rooms"). The room itself runs in its host's browser; this is only the lobby list.
// GET ?id=  → one room (so a joiner knows who hosts it)
// POST { s, action: 'create' | 'update' | 'delete', id, info }
import { redis } from './_lib/redis.js';
import { handle, body, sessionName } from './_lib/http.js';
import { pidOf } from '../shared/ids.js';

export const STALE_MS = 75000;

export default handle(async (req, res) => {
  if (req.method === 'GET') {
    const raw = await redis('HGET', 'rooms', String(req.query.id || ''));
    const r = raw && JSON.parse(raw);
    if (!r || Date.now() - r.updated > STALE_MS) return res.json({ error: 'Phòng không tồn tại' });
    return res.json(r);
  }
  const { s, action, id, info } = body(req);
  const name = await sessionName(s);
  if (!name) return res.status(401).json({ error: 'Phiên đăng nhập đã hết' });
  if (action === 'create') {
    const newId = String(await redis('INCR', 'roomSeq'));
    await redis('HSET', 'rooms', newId, JSON.stringify({ id: newId, host: name, hostPid: pidOf(name), info: { ...info, id: newId }, updated: Date.now() }));
    return res.json({ id: newId });
  }
  const raw = await redis('HGET', 'rooms', String(id));
  const r = raw && JSON.parse(raw);
  if (!r || r.host !== name) return res.json({ error: 'Không phải chủ phòng' });
  if (action === 'delete') { await redis('HDEL', 'rooms', String(id)); return res.json({ ok: true }); }
  r.info = { ...info, id: r.id }; r.updated = Date.now();
  await redis('HSET', 'rooms', String(id), JSON.stringify(r));
  res.json({ ok: true });
});

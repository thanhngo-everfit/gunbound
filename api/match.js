// A finished match, reported by the room's host: POST { s, roomId, matchId, players, winner }
import { redis } from './_lib/redis.js';
import { handle, body, sessionName } from './_lib/http.js';
import { addMatch } from '../shared/stats-core.js';

export default handle(async (req, res) => {
  const { s, roomId, matchId, players, winner } = body(req);
  const name = await sessionName(s);
  const raw = await redis('HGET', 'rooms', String(roomId));
  const room = raw && JSON.parse(raw);
  if (!name || !room || room.host !== name) return res.status(403).json({ error: 'Chỉ chủ phòng mới ghi kết quả' });
  if (!Array.isArray(players) || players.length > 10) return res.json({ error: 'Dữ liệu trận không hợp lệ' });
  // a real match has at least two people in it (the room already refuses practice, bots-only, short and forfeit games)
  const humans = players.filter(p => !p.bot && p.name);
  if (humans.length < 2) return res.json({ error: 'Trận không đủ người chơi thật để tính điểm' });
  // each match counts once even if the host retries
  if (!(await redis('SET', `match:${roomId}:${matchId}`, '1', 'NX', 'EX', 86400))) return res.json({ ok: true, dup: true });
  // ranked matches last at least 2 minutes, so one room can't report faster than that
  if (!(await redis('SET', `matchgap:${roomId}`, '1', 'NX', 'EX', 90))) return res.json({ error: 'Phòng này vừa ghi một trận, bỏ qua' });
  for (const p of players) {
    if (p.bot || !p.name) continue;
    const cur = await redis('HGET', 'stats', String(p.name));
    await redis('HSET', 'stats', String(p.name), JSON.stringify(addMatch(cur ? JSON.parse(cur) : undefined, p, winner)));
  }
  res.json({ ok: true });
});

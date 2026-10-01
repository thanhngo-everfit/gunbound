// Lobby: open rooms, online count (Ably presence on the lobby channel), leaderboard and the asking player's profile.
import Ably from 'ably';
import { redis, hgetallJson } from './_lib/redis.js';
import { handle } from './_lib/http.js';
import { profileOf, leaderboardOf } from '../shared/stats-core.js';
import { STALE_MS } from './rooms.js';
import { allPlayers } from './_lib/players.js';

export default handle(async (req, res) => {
  const [rooms, db, names] = await Promise.all([hgetallJson('rooms'), hgetallJson('stats'), allPlayers().catch(() => [])]);
  const now = Date.now(), live = [], stale = [];
  for (const [id, r] of Object.entries(rooms)) (now - r.updated > STALE_MS ? stale : live).push(id === r.id ? r : { ...r, id });
  if (stale.length) redis('HDEL', 'rooms', ...stale).catch(() => {});
  let online = 0;
  try {
    const page = await new Ably.Rest({ key: process.env.ABLY_API_KEY }).channels.get('tc:lobby').presence.get({ limit: 1000 });
    online = new Set(page.items.map(m => m.clientId)).size;
  } catch {}
  const name = req.query.name ? String(req.query.name) : null;
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    rooms: live.sort((a, b) => Number(a.id) - Number(b.id)).map(r => r.info),
    online, leaderboard: leaderboardOf(db, 100, names), me: name ? profileOf(db, name) : undefined,
  });
});

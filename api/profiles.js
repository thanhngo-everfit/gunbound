// Profiles (rank, GP…) for the players in a room: GET ?names=a|b|c
import { hgetallJson } from './_lib/redis.js';
import { handle } from './_lib/http.js';
import { profileOf } from '../shared/stats-core.js';

export default handle(async (req, res) => {
  const names = String(req.query.names || '').split('|').filter(Boolean).slice(0, 20);
  const db = await hgetallJson('stats');
  res.setHeader('Cache-Control', 'no-store');
  res.json(Object.fromEntries(names.map(n => [n, profileOf(db, n)])));
});

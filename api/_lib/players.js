// Every account's display name, for the leaderboard (which lists players with no match yet too).
// Kept in the set `players`; accounts made before it existed are found once by scanning the guser:* keys.
import { redis, redisRaw, PREFIX } from './redis.js';

export const addPlayer = name => redis('SADD', 'players', name);

export async function allPlayers() {
  if (!(await redis('GET', 'players:backfilled'))) {
    let cursor = '0';
    do {
      const [next, keys] = await redisRaw('SCAN', cursor, 'MATCH', `${PREFIX}guser:*`, 'COUNT', 200);
      cursor = String(next);
      for (const k of keys) {
        try { const u = JSON.parse(await redisRaw('GET', k)); if (u?.name) await addPlayer(u.name); } catch {}
      }
    } while (cursor !== '0');
    await redis('SET', 'players:backfilled', '1');
  }
  return (await redis('SMEMBERS', 'players')) || [];
}

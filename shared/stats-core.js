// Career stats maths, shared by the Node server (data/stats.json) and the Vercel functions (Redis).
// db: { [name]: { games, wins, kills, dealt, gold, xe: { [xeId]: count } } }
import { XE } from './xe.js';
import { RANKS, DRAGONS, DRAGON_MIN_GAMES, gpOf } from './ranks.js';

const blank = () => ({ games: 0, wins: 0, kills: 0, dealt: 0, gold: 0, xe: {} });

function place(db, name) {
  const me = db[name];
  if (!me || me.games < DRAGON_MIN_GAMES) return 0;
  return 1 + Object.entries(db).filter(([n, s]) => n !== name && s.games >= DRAGON_MIN_GAMES && gpOf(s) > gpOf(me)).length;
}

// one player's match result added to their record (returns the updated record)
export function addMatch(s = blank(), p, winner) {
  s = { ...blank(), ...s, xe: { ...(s.xe || {}) } };
  s.games++;
  if (winner && p.team === winner) s.wins++;
  s.kills += p.kills || 0;
  s.dealt += p.dealt || 0;
  s.gold += p.gold || 0;
  s.xe[p.xe] = (s.xe[p.xe] || 0) + 1;
  return s;
}

export function profileOf(db, name) {
  const s = db[name] || blank();
  const gp = gpOf(s);
  const i = RANKS.findLastIndex(([min]) => gp >= min);
  let [, rankId, rank] = RANKS[i];
  const pos = place(db, name), dragon = pos && DRAGONS.find(([top]) => pos <= top);
  if (dragon) [, rankId, rank] = dragon;
  const next = RANKS[i + 1];
  const favId = Object.entries(s.xe).sort((a, b) => b[1] - a[1])[0]?.[0];
  return {
    rank, rankId, gp, next: next ? { rank: next[2], rankId: next[1], gp: next[0] } : null,
    games: s.games, wins: s.wins, winRate: s.games ? Math.round((s.wins / s.games) * 100) : 0,
    avgDmg: s.games ? Math.round(s.dealt / s.games) : 0, kills: s.kills, gold: s.gold,
    fav: favId ? `${XE[favId]?.name} (${Math.round((s.xe[favId] / s.games) * 100)}%)` : '',
  };
}

// The lobby leaderboard: most GP, then wins, then games. Every account is listed, also those with no match yet
// (0 GP, Gà Con; user, 2026-10-01: "luôn show tất cả người chơi đã tạo acc").
export function leaderboardOf(db, n = 100, names = []) {
  const all = new Set([...Object.keys(db).filter(k => db[k].games > 0), ...names.filter(Boolean)]);
  return [...all]
    .map(name => ({ name, ...profileOf(db, name) }))
    .sort((a, b) => b.gp - a.gp || b.wins - a.wins || b.games - a.games || a.name.localeCompare(b.name, 'vi'))
    .slice(0, n);
}

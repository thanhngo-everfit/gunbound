// Per-player career stats, kept in data/stats.json (keyed by display name, since there are no accounts).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { XE } from '../shared/xe.js';
import { RANKS, DRAGONS, DRAGON_MIN_GAMES, gpOf } from '../shared/ranks.js';

const FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'stats.json');
let db = {};
try { db = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { db = {}; }

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFile(FILE, JSON.stringify(db, null, 1), () => {});
  }, 500);
}

function place(name) {
  const me = db[name];
  if (!me || me.games < DRAGON_MIN_GAMES) return 0;
  return 1 + Object.entries(db).filter(([n, s]) => n !== name && s.games >= DRAGON_MIN_GAMES && gpOf(s) > gpOf(me)).length;
}

// players: [{ name, team, xe, dealt, kills, gold, bot }]
export function recordMatch(players, winner) {
  for (const p of players) {
    if (p.bot) continue;
    const s = (db[p.name] ||= { games: 0, wins: 0, kills: 0, dealt: 0, gold: 0, xe: {} });
    s.games++;
    if (winner && p.team === winner) s.wins++;
    s.kills += p.kills || 0;
    s.dealt += p.dealt || 0;
    s.gold += p.gold || 0;
    s.xe[p.xe] = (s.xe[p.xe] || 0) + 1;
  }
  save();
}

export function profile(name) {
  const s = db[name] || { games: 0, wins: 0, kills: 0, dealt: 0, gold: 0, xe: {} };
  const gp = gpOf(s);
  const i = RANKS.findLastIndex(([min]) => gp >= min);
  let [, rankId, rank] = RANKS[i];
  const pos = place(name), dragon = pos && DRAGONS.find(([top]) => pos <= top);
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

// Top players for the lobby leaderboard: most GP, then wins, then games.
export function leaderboard(n = 10) {
  return Object.entries(db)
    .map(([name, s]) => ({ name, ...profile(name) }))
    .filter(p => p.games > 0)
    .sort((a, b) => b.gp - a.gp || b.wins - a.wins || b.games - a.games)
    .slice(0, n);
}

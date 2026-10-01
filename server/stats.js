// Per-player career stats for the Node server, kept in data/stats.json (keyed by display name).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { addMatch, profileOf, leaderboardOf } from '../shared/stats-core.js';

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

// players: [{ name, team, xe, dealt, kills, gold, bot }]
export function recordMatch(players, winner) {
  for (const p of players) if (!p.bot) db[p.name] = addMatch(db[p.name], p, winner);
  save();
}
export const profile = name => profileOf(db, name);
export const leaderboard = (n = 10) => leaderboardOf(db, n);

// Vercel build: the static site is public/ plus the modules the host's browser needs to run a room
// (shared/ and server/room.js + server/bot.js, which import only shared/). Output: dist/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'dist');
fs.rmSync(OUT, { recursive: true, force: true });
fs.cpSync(path.join(ROOT, 'public'), OUT, { recursive: true });
fs.cpSync(path.join(ROOT, 'shared'), path.join(OUT, 'shared'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'server'), { recursive: true });
for (const f of ['room.js', 'bot.js']) fs.copyFileSync(path.join(ROOT, 'server', f), path.join(OUT, 'server', f));
console.log('built dist/');

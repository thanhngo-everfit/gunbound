# Thú Chiến

Gunbound-style turn-based artillery game for the browser, 5v5, in Vietnamese. Several rooms (matches) can run at the same time.

## Run

```bash
npm install
npm start
```

The server prints two addresses: `localhost` for this machine, and a LAN address that coworkers on the same network can open. Set `PORT` to change the port (default 3000). Use `npm run dev` to auto-restart on server changes; this ends running matches.

## Deploy to Vercel

The Vercel build runs the same game without a long-lived server: each room runs in its host's browser (a Web
Worker running `server/room.js`), players talk over [Ably](https://ably.com), and logins, the room list and ranks
live in Redis behind the functions in `api/`.

One-time setup (both services have a free plan that covers an office):
1. **Redis:** in the Vercel project, open Storage → Marketplace → **Upstash for Redis** → create a free database and
   connect it to the project (an existing database from another project works too: every key is prefixed
   `thuchien:`, change it with `REDIS_PREFIX`). It adds `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
2. **Ably:** sign up at ably.com (free plan), create an app, and copy its **root API key**. In Vercel project Settings →
   Environment Variables, add `ABLY_API_KEY` with that key.
3. **Google login:** sign-in is Google only, restricted to **@everfit.io**. It reuses the OAuth client of the Roadmap
   dashboard (`292601272916-…apps.googleusercontent.com`, override with `GOOGLE_CLIENT_ID`). In Google Cloud Console →
   APIs & Services → Credentials → that OAuth client → **Authorized JavaScript origins**, add the game's production
   URL (e.g. `https://gunbound-xxx.vercel.app`) and `http://localhost:3000`. Origins are exact: no wildcards, so use
   the stable production domain rather than per-deployment preview URLs.
4. **Deployment Protection:** turn off Vercel Authentication (Settings → Deployment Protection) so coworkers without a
   Vercel login can open the game.
5. Redeploy. `https://<your-app>/api/config` should show `"ok": true`.

`vercel.json` builds with `node tools/build-vercel.mjs` (public/ + shared/ + server/room.js and bot.js into `dist/`).
To try the Vercel path offline: `node tools/build-vercel.mjs && node tools/dev-vercel.mjs`, then open
http://localhost:3100 in two tabs (fake Ably between tabs, in-memory Redis).

Limits of the Vercel build: a room closes when its host leaves, reloads or loses connection for 12 s; guests can reload
and rejoin.

## Controls

- ← → move · ↑ ↓ angle · hold SPACE for power, release to fire
- 1 / 2 / 3 pick Shot 1, Shot 2, SS (SS unlocks when the Nộ bar is full)
- Mouse wheel zoom, drag to look around, click the minimap to jump
- Enter to chat

## Layout

- `shared/xe.js` — the 13 xe: stats, angles and shots (edit here to rebalance)
- `shared/physics.js` — terrain generation, movement and the shot simulation; the server runs it as the authority
- `server/` — Express + Socket.IO for local/LAN play; `room.js` holds the room, teams, turn/delay system and win check (also runs in the host's browser on Vercel)
- `api/` — Vercel functions (login, lobby, room registry, profiles, match results); `public/js/net*.js` + `host-worker.js` — the Vercel network layer
- `public/js/` — `app.js` (menus/room), `game.js` (rendering, camera, input, HUD), `art.js` (all art drawn in code), `fx.js` (particles, sound)
- `design/xe-roster.md` — design notes for the roster

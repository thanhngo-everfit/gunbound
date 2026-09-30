# Thú Chiến

Gunbound-style turn-based artillery game for the browser, 5v5, in Vietnamese. Several rooms (matches) can run at the same time.

## Run

```bash
npm install
npm start
```

The server prints two addresses: `localhost` for this machine, and a LAN address that coworkers on the same network can open. Set `PORT` to change the port (default 3000). Use `npm run dev` to auto-restart on server changes; this ends running matches.

## Controls

- ← → move · ↑ ↓ angle · hold SPACE for power, release to fire
- 1 / 2 / 3 pick Shot 1, Shot 2, SS (SS unlocks when the Nộ bar is full)
- Mouse wheel zoom, drag to look around, click the minimap to jump
- Enter to chat

## Layout

- `shared/xe.js` — the 10 xe: stats, angles and shots (edit here to rebalance)
- `shared/physics.js` — terrain generation, movement and the shot simulation; the server runs it as the authority
- `server/` — Express + Socket.IO; `room.js` holds the lobby, teams, turn/delay system and win check
- `public/js/` — `app.js` (menus/room), `game.js` (rendering, camera, input, HUD), `art.js` (all art drawn in code), `fx.js` (particles, sound)
- `design/xe-roster.md` — design notes for the roster

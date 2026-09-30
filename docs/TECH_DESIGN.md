# Thú Chiến: Technical Design

How the game is built, how data flows, and the tricks and traps learned while building it.
Companion: [GAME_DESIGN.md](GAME_DESIGN.md).

## 1. Stack and layout

- **Server:** Node 24, Express (static files) + Socket.IO (realtime). There is no database; state is in memory, and career stats and accounts are small JSON files in `data/`.
- **Client:** plain ES modules, no build step. Canvas 2D for the battlefield, DOM for the HUD and menus.
- **Shared code** (`shared/`) runs on both sides unchanged.

```
shared/xe.js        10 xe: stats, angles, shots (behaviour flags), items. SOURCE OF TRUTH for balance.
shared/physics.js   terrain (procedural + painted masks), movement, spawns, wind, simulateShot()
server/index.js     sockets, players, rooms, loads painted masks, accounts (name+PIN)
server/room.js      lobby/room state, settings, match flow (loading → intro → turns), bonuses, items, win
server/bot.js       NPC aiming: brute-force simulate candidate shots on a copy, pick the best, add a deliberate miss
server/stats.js     career stats + profile/leaderboard (data/stats.json)
shared/ranks.js     rank ladder (GP thresholds, dragon places), shared so the client can show the table
public/index.html   all screens: login, lobby, room, game (HUD, loading, modals)
public/js/app.js    menus/room UI, chat, creates Game
public/js/game.js   Game class: loading, replay, camera, input, render, HUD, effects
public/js/art.js    terrain painting, backdrop, sprite drawing, procedural fallback art, projectile looks
public/js/assets.js loads and cuts out Gamma art (sprite sheets, pilots, projectiles, maps, masks)
public/js/fx.js     particles, floating text, sounds and music (WebAudio)
public/css/theme.css  sticker UI design system (loads after style.css and overrides it)
tools/build-maps.mjs  builds destructible masks from painted terrain JPGs (needs jpeg-js)
art-src/            original Gamma downloads (not served); older versions kept for reference
docs/               this file and GAME_DESIGN.md
```

## 2. Authority model

- The **server is authoritative.** It owns the terrain mask, tanks, delays, wind and turn timer, and it simulates every shot (`simulateShot`) at 60 steps/s in about 1 ms.
- The server sends a **replay**: `paths` (projectile points per frame) and timed `events` (carve, boom, dmg, heal, die, move, status…). Clients animate the replay; they never simulate damage.
- Terrain stays in sync because **every carve is an explicit event**, which the client applies to its own mask and to the painted canvas.
- **Replay speed:** clients play at `REPLAY_SPEED` (0.62), driven by **wall-clock time** (`anim.t0`), so slow or throttled browsers stay in step. The server waits `replayMs(frames, ss) + 1600 ms` before the next turn. An SS adds `SS_DELAY_FRAMES` for the cut-in.

## 3. Match flow

1. `room:start` → server builds the mask (painted, possibly mirrored) and the spawns, and emits `game:start` (snapshot, `phase:'loading'`).
2. Clients load step by step, emitting `game:progress {pct}`. The server rebroadcasts `game:loading`. When every connected human reaches 100 (or `LOAD_MAX_MS` = 20 s passes), it emits `game:ready {introMs}`.
3. Clients run the intro (wipe + flyover). After `INTRO_MS` the server calls `nextTurn()`.
4. Turn: `game:turn {id, wind, windChanged, msLeft, moveLeft, delays, ssCd, ssReady, blind, sudden, lives, turnNo}`. Movement via `game:input` (server ticks at 30 Hz, 1 px per tick). Aim via `game:aim`. Items via `game:item`. Fire via `game:fire`. Pass via `game:pass`.
5. `game:shot` (replay + bonus + tank states), then after the replay `applyTurnEffects()` → `game:tick` (poison, burning ground, hazards), then the next turn.
6. `game:end {winner, players}` → stats are recorded → the room goes back to waiting.
7. A rejoin mid-match gets `game:start {…snapshot, rejoin:true}` (carves replayed). Game events that arrive while loading are queued, then flushed.

## 4. Socket protocol (client → server)

`hello {name, pin, gender, token}`, `lobby:get` (the reply includes `me`: own profile), `room:create {name, practice}`, `room:join {id}`, `room:leave`, `room:team`, `room:ready`, `room:map`, `room:settings {turnSec, sudden, xeMode}`, `room:xe {xe | 'random'}`, `room:addBot {team}`, `room:removeBot {id}`, `room:start`, `player:gender`, `chat {text}`, `game:progress`, `game:input {left,right}`, `game:aim {angle}`, `game:item {item}`, `game:fire {angle,power,shot}`, `game:pass`.

Score mode: client → `game:drop {x}` (a dead player picks where to respawn); server → `game:lives {lives, id, respawnAt}`, `game:drop {id, x}`, `game:respawn {id, x, y, hp, delay, lives}`. `game:tick` can carry `drain` (Máu Cạn Dần).

Server → client: `lobby`, `room:state`, `chat {name,pid,team,text}`, `game:start`, `game:loading`, `game:ready`, `game:turn`, `game:pos`, `game:aim`, `game:item`, `game:shot`, `game:skip`, `game:tick`, `game:fell`, `game:sudden`, `game:end`.

## 5. Physics notes

- World `W×H = 2400×1100`. `mask` is a Uint8Array (1 = ground). `WATER_Y` is the death line (it can rise with the lava hazard; the current value is passed in).
- Tank `y` is the ground row under its feet. Hitbox: circle of radius `TANK_R` (22) centred `TANK_CY` (28) above the feet. Shots leave from `PIVOT` (32) + `BARREL` (30) along the angle.
- Wind: `{s: 0..26, a: deg}`. Acceleration = `windVec * WIND_K (0.0016) * shot.windMul * xe.windMul`, on both x and y. `rollWind` runs at match start; `driftWind` runs each turn (35% chance, ±2 strength, ±40°).
- Trajectory check: a scratch script that fires every xe × shot on a flat floor at the same angle/power/wind and compares the apex. All shots of one xe must match, apart from windMul (see GAME_DESIGN §3, same curve rule).
- Weather in simulateShot: a tornado turns a shell to `mode 'spin'` (`out.twisted`). Crossing the thunder beam sets `p.zapped`, marks `paths[i].zap` (the path index where the client starts drawing sparks) and emits a `zap` event. When a zapped shell ends in `impact()`, `thunderStrike(x)` emits `thunder` and explodes at the first ground under x. room.js turns `out.twisted`/`out.zapped` into gold bonuses.
- Shot behaviours (flags in xe.js): `split`, `count+gap`, `bounce`, `drill`, `crawl(+seek)`, `straight(+pierce)`, `sky`, `under`, `quake`, `clones`, plus effects: `zone`, `heal`, `cleanse`, `poison`, `blind`, `mark`, `push`, `pull`, `selfArmor`, `ignoreArmor`.
- Damage: `dmg × (MIN_SPLASH + (1−MIN_SPLASH)·k) × (1 − armour) × mark × ally-half × dmgMul`. Direct hits ×1.15; angle ≥ 70 ×1.10.
- Spawns: `standSpot()` needs ground below y=180 with about 76 px of headroom, so no tree tops or cave ceilings. `spawnPositions` searches outward from even slots and keeps ≥ 90 px spacing. Teams alternate by x order.

## 6. Art pipeline (Gamma)

- The Gamma MCP `generate_image` costs **70 credits per image**. **Put many sprites on one sheet** (a grid on a flat background) and slice them in code: the style stays consistent and it's cheap.
- Use a flat **pure magenta #FF00FF or pure green #00FF00** background (pick the one not used by the subject). `assets.js cutOut()` flood-fills the key colour from the borders, softens the fringe and trims.
- Slicing: `sliceSheet()` (connected components on a 4 px grid, merging loose bits into the nearest figure box) for clean grids. For overlapping figures use **hand-measured crop boxes** (`XE_SHEET.boxes`, plus `erase` rects).
- Prompt template the user likes: `[STYLE] 2D game sprite, early-2000s Korean online game art style, chunky toy-like chibi proportions, thick hand-inked black outlines, flat colors… [VEHICLE] … [WEAPON] … mounted on its [back/head/side], aimed forward and slightly upward.` Always say "facing RIGHT", "isolated on flat solid pure magenta", "no text, no shadow".
- **Don't** use `type:"abstract"`: it ignored the prompt, and 280 credits were wasted on terrain textures.
- Painted maps: generate terrain on a key colour, downscale to 2400 px wide (`sips -Z 2400`) into `public/assets/maps/terrain-<id>.jpg`, then run `node tools/build-maps.mjs` → `mask-<id>.bin` (deflated). The server inflates it at boot and the browser via `DecompressionStream`. The painting is taller than the world; the part above y=0 is kept as non-destructible decoration (`canvas.pad`).
- Icons: `assets.js ICON_SHEET` (hand boxes) → `iconUrl(name)` / `rankIcon(rank)` return cached PNG data URLs for `<img>`. They're empty until loaded, so re-render after `loadAssets()`.
- The first 10 xe: `XE_SHEETS` in assets.js (xe4.jpg magenta: rong, kylan, kimquy, bocap, camap; xe5.jpg green: phuong, voi, bachtuoc, cu, tethien), hand boxes on a 1400x781 view plus `erase` rects for neighbours' bits. The scorpion's sheet also drew an unwanted beast beside it (erased). `unPink()` fades the half-keyed pink glow around Kim Quy. Their projectiles are `PROJ_GRIDS` (proj-f.jpg / proj-g.jpg): portrait 3x5 grids, one row per xe, cells on a 1536x2752 view. Kim Quy S1 is a bronze-tinted copy of the SS arrow; Bọ Cạp S1 still comes from proj-d. Flight orientation per sprite is SPIN / NO_ROTATE / ROT_OFF / MIRROR / UPRIGHT at the top of game.js. xe.jpg and proj-a/b/c.jpg are no longer loaded.
- `RIGS` polygons, `SEATS`, `OCCLUDE` and `XE_PARTS` must be re-measured whenever a sprite is replaced (the old ones leave ghost outlines or float the pilot). Measure on a grid overlay of the trimmed sprite, then render the rig at its extreme poses.
- Newer xe: `XE2_SHEET` (xe2.jpg, penguin, mirrored because it was painted facing left) and `XE3_SHEET` (xe3.jpg: right-facing bear and rabbit, which override xe2's). Check facing on every new sheet: the face, the sled/board front AND the cannon must all point right; mirroring the whole sprite flips the cannon too. `art.js SIZE_K` scales up tall pictures that come out small when fitted by height (bear ×1.1).
- Big downscales alias: use `drawSmooth()` (mip chain + high-quality smoothing), and size portrait canvases by `clientWidth × devicePixelRatio`.

## 7. Testing and debugging

- `window.__game` is the live Game instance in the browser console.
- Headless: import `shared/physics.js` and `server/room.js` in a scratch `.mjs`; a fake `io = {to:()=>({emit,except:()=>({emit})})}` plus fake players lets you run whole matches (bots vs a skipping human).
- Browser pane screenshots can lag one frame and `requestAnimationFrame` is throttled when the pane isn't visible, so take two screenshots. The replay is wall-clock based, so harnesses that step `update()` by hand don't advance it.
- Studying reference audio: symlink the file into `public/_tmp/`, then `fetch` it and `decodeAudioData` in the pane (m4a works) and run the FFT, band energy and onset scans in JS. To check our synthesized sounds, render them into an `OfflineAudioContext` (set `sfx.ctx`/`sfx.master` by hand) and compare RMS per 100 ms window.
- Studying a reference video: symlink the mp4 into `public/_tmp/` (delete after), load it in a `<video>` in the pane, seek, `drawImage` a grid of frames to a canvas, and screenshot. ffmpeg isn't installed, and swift/JXA AVFoundation don't work here. A frame-difference or brightness scan finds action and SS darkening fast.

- **Shot regression test:** `node tools/test-shots.mjs` runs a real Room with bots on a flat test map and checks every shot and passive of all 13 xe against its description (77 checks, including freeze skip, ricochet, moon zone/night, dodge rate and the legendary roll/pick rules), including what happens on the following turns (minions, root, poison spread, marks, pillars). It must end with "0 failing". Run it after any change to shared/xe.js, shared/physics.js or the turn logic in room.js.
- **Landing test:** `node tools/test-landing.mjs` fires 400 random Ổ Bọ Con shots on the real painted maps. No baby may end up inside rock or under a ledge.
  - Landing spots come from `landSpot()` in simulateShot: back out of the rock along the incoming path, fall to the ground, and need ~26 px of headroom. If there is none, it searches sideways up to 220 px.
  - Minions and pillars use it. Babies that land on a sibling walk aside with `crawlPath`, which walks the air row above the ground, while minions and tanks store the ground row.
  - Harness notes: clear `g.tick` and the start timers, replace `room.later` with a queue, and clamp test angles to the xe's range (the server clamps them).

## 8. Operational rules (important)

- `npm run dev` uses `node --watch`: **any edit under server/ or shared/ restarts the server and wipes every room and match.** The user plays on the same server. Batch server changes and warn them first; `public/` edits are safe (just reload).
- Test in your **own** room (name it "… (Claude)") and join it by id; never click the first room card. Leave when done (NPC-only rooms close themselves).
- Production-ish run: `npm start` (no watch). LAN URL is printed at boot.

## 9. Known limits / tech debt

- There is no match persistence; a server restart ends matches.
- Name + PIN is weak auth; stats are keyed by name.
- 10 simultaneous humans on the LAN hasn't been load-tested.
- The procedural terrain and art fallback remain for maps without paintings.

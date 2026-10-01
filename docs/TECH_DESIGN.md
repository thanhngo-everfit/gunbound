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

## 2b. Vercel edition (2026-10-01)

User: "build server to deploy to vercel, not in my local", on free plans. Vercel functions can't keep a room in memory: native WebSockets are beta, each connection is its own instance, and they last at most 5 min (Hobby). So:
- **The host's browser is the server.** `public/js/host-worker.js` runs the unchanged `server/room.js` in a Web Worker, so its timers keep full speed when the host's tab is in the background. Room no longer imports Node modules: stats come in through `hooks` (`profile`, `recordMatch`).
- **Transport: Ably**, one channel `tc:room:<id>` per room plus `tc:lobby`.
  - Guests publish `c` commands with an ack id.
  - The worker batches every 50 ms, keeping only the last `game:pos`/`game:aim` per xe. The host page publishes one `b` message per batch, plus `a` acks.
  - Payloads over 45 KB are deflated and split into `z` chunks; Ably's limit is 64 KB.
  - `echoMessages: false`.
  - Identity: the Ably clientId is the player's name, signed into the token by `/api/ably-token`. The host derives `pidOf(name)` (`shared/ids.js`) instead of trusting payloads, and guests accept events only from the host's clientId.
- **Functions** (`api/`, Upstash Redis over REST in `api/_lib/redis.js`):
  - `login`: name + PIN, 30-day session tokens.
  - `ably-token`.
  - `rooms`: the registry hash `rooms`, kept fresh by a 20 s host heartbeat; rooms are stale after 75 s.
  - `lobby`: rooms, Ably presence count, leaderboard and the player's profile.
  - `profiles`.
  - `match`: only the registered host can report, and each match id counts once.
  - Shared maths: `shared/stats-core.js` (also used by the Node `server/stats.js`).
- **Client:** `public/js/net.js` asks `/api/config`. The Node server answers `socket` and the page loads Socket.IO as before. Vercel answers `ably` and the page uses `AblySocket` (`net-ably.js`), which has the Socket.IO client surface (`on`/`off`/`emit` with ack), so `app.js`/`game.js` are unchanged.
  - A guest's room is remembered in sessionStorage and rejoined after a reload.
  - When the host leaves, the room closes: a `closed` message, or presence leave for 12 s, makes guests see `room:closed`.
- **Build:** `vercel.json` → `node tools/build-vercel.mjs` copies public/, shared/, server/room.js and bot.js into `dist/`.
- **Offline test:** `tools/dev-vercel.mjs` runs the real `api/*.js` against an in-memory Upstash-compatible Redis on :3100, and `tools/fake-ably.js` links browser tabs through a BroadcastChannel. Verified with two tabs:
  - login and wrong-PIN rejection;
  - create, list and join a room; ready and start;
  - turns, movement and fire across tabs; a 116 KB chunked message;
  - a guest reloading and rejoining; the host reloading, which closes the room for the guest;
  - match recording (non-host refused, duplicates ignored).

## 2c. Login: Google (2026-10-01)

**Local play has no Google login** (2026-10-01, user: "gỡ google login trên bản local"): `npm run dev` serves `/api/config` with `localLogin: true`, the login card shows only the pilot + name form, and `hello { local, name }` logs in by name (`server/index.js localLogin`; the name is the account, an existing account with that name is reused, a session token is remembered as before). `GOOGLE_LOGIN=1 npm run dev` brings Google back. The Vercel build is unchanged (Google only).

Update 2026-10-01: any Google account may play (user: "tài khoản google nào cũng đc"). The domain check stays behind `ALLOWED_DOMAIN`, which is empty by default; when it is empty there is no `hd` hint and no domain line on the login card.

User: "cần google login, và chỉ login được với account @everfit.io … mỗi account google chỉ link 1 1 tài khoản, ko cần pin, cần nhập tên là được; sau khi có tài khoản rồi thì không show màn hình chọn nhân vật và nhập tên nữa".
- **Client** (`app.js`): Google Identity Services button with `hd: everfit.io` and `auto_select`. The client id comes from `/api/config`: the game's own OAuth client "Thú Chiến" (`447903417219-…`), created 2026-10-01.
  - First visit: the server answers `needName`, and the login card switches to "choose a pilot and a name" (the name is prefilled from the Google given name).
  - After that, the session token in localStorage logs straight into the lobby.
  - Pilot changes in the room are saved on the account.
- **Server check:** `api/_lib/google.js` (`google-auth-library` `verifyIdToken`) checks audience, `email_verified` and the `@everfit.io` suffix. It is shared by the Vercel `api/login.js` and the Node `server/index.js`.
- **Storage:**
  - Redis: `guser:<googleSub>` → `{ name, gender, email }`, `gname:<lowercase name>` → sub (unique names), `sess:<token>` → name (60 days).
  - Node: `data/accounts.json` `{ users, names, sessions }`. The old name+PIN file is dropped; stats are still keyed by name.
- **Offline test:** `tools/dev-vercel.mjs` sets `FAKE_GOOGLE=1`, which accepts `fake:<email>:<sub>` credentials and swaps the button for an email box. Verified:
  - a non-everfit email is refused;
  - a new account gets the name step, then the lobby;
  - a reload goes straight to the lobby;
  - a cleared browser with the same Google account goes straight to the lobby with the saved pilot;
  - a taken name is refused.

## 2d. Outfits (2026-10-01)

- **Look string:** the player's look travels in the old `gender` field: `"<pilot>[.c<n>][.g<n>][.s<n>]"` (hair colour, glasses, top), e.g. `f2.c3.g1`.
  - `shared/outfits.js` parses and validates it (`cleanLook`, re-exported as `cleanGender` in `shared/ids.js`), so the server, the Vercel API and the host worker all accept and store it unchanged.
- **Drawing:** `assets.js pilotImage(look)` dresses a plain base pilot (`pilot-pad.jpg`, fixed boxes, enclosed key gaps at `holesMin` 75) with `PILOT_FIT` anchors measured per pilot: hairline, eyes, tee polygon, chest and back. The base pilots hold a painted gamepad (re-measure `PILOT_FIT` whenever `pilot-pad.jpg` changes).
  - **Hair** (`hairOf` / `baldHead` / `hairLayers` in assets.js):
    - A hair mask comes from colour per pilot (brown / orange / pink HSV tests, inside a head zone, with brows, eyes, mouth and cheeks excluded), grown into the surrounding ink. Bangs hanging into the face box are added when they join the hair outside it (so the brows join too where the bangs touch them), plus pale shine streaks high on the skull. Below the chin only true ink grows, so the grey gamepad isn't dyed; f2's twin tails have their own zones beside the body, and pink-blush on its cheeks is told apart by hue.
    - Hairstyle swaps (bald head + transplant) were tried and removed; only the dye remains.
    - Dye multiplies the hair's own brightness, relative to its base tone.
  - Glasses are drawn in code (`outfit-art.js`) from `PILOT_FIT.head` (skull centre, brim y, half width, top) and `PILOT_FIT.eyes` (near eye, far eye, ear, lens radius).
    - `outfits.jpg` is now only used for the cape.
  - Tops come from `TOPS` and are painted into the tee: the mask is the light, unsaturated pixels inside the polygon, flood-filled from the tee's white so the grey shorts past the hem's ink line stay unpainted; colour, stripes, camo, flowers, metal, emblem and the cape (sheet row 3, col 2) are multiplied by the tee's brightness, so line art and cel shading survive.
  - The cape hangs by its right clasp at the collar (`PILOT_FIT.cape` or the default `[0.44, 0.53, 0.22, 0.55]` = anchor x, y, rotation, width), drawn behind the pilot so it comes out from under the tee (the old mid-back flap looked detached).
  - `s8` is the classic set: the old `pilot.jpg` art (`ASSETS.pilotClassic`).
- **Sizing:** dressed canvases are padded, with `baseW`/`baseH`/`padL`/`padT`, and `xeSprite` seats riders by the bare pilot so their size doesn't change. Caches key on the look string.
- **Sessions:** a resumed session must not send the browser's look (it would overwrite the account's); only account creation and `player:gender` save it.

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
- Voi (lava mammoth): `XE6_SHEET` (xe6.jpg, magenta, stored mirrored because Gamma painted it facing left; right-hand figure of art-src/mammoth-v3). It overrides xe5's elephant; no rig; its S1/S2 projectiles are `tinted()` copies of proj-g's rock and water ball. Its SS is cell 1 of proj-h.jpg (9 lava candidates, art-src/proj-voi-ss-v1), spun in flight (`SPIN`). Its quake uses painted effects from `fx-lava.jpg` (`ASSETS.fx.lava`, 9 sprites: geysers, basalt spikes, slab, fissure, dust ring, smoke): `game.js quakePulse()` replaces the generic boom of every quake pulse, `drawErupt()` pops each sprite up from its bottom edge and sinks it back. The old code-drawn crack lines (`makeCracks`) and square debris were removed: the user found them ugly ("đường kẻ chấn động … xấu"), and on bridges the cracks spread into thin air.
- Prompting and checks for new art: the project skill `.claude/skills/gen-game-art`.
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

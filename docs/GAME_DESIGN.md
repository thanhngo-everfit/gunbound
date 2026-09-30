# Thú Chiến: Game Design

Knowledge base for the game's design. Read this before changing gameplay, balance or art.
Companion docs: [TECH_DESIGN.md](TECH_DESIGN.md) (how it is built) and [../CLAUDE.md](../CLAUDE.md) (working rules).

**Research notes** (2026-09-30, with source URLs): [research/gunbound-gameplay.md](research/gunbound-gameplay.md) covers rules, ranks, GP, delay, bonuses, items, weather, modes and mobiles. [research/gunbound-ux-fun.md](research/gunbound-ux-fun.md) covers screen layouts, anti-boredom and social features, and fun modes with rough costs. Top-rank naming differs between versions: the WC level table shows White Dragon, other sources Silver Dragon; we use Rồng Trắng.

## 1. Product

- **What:** a Gunbound-style, turn-based 2D artillery web game, played **5v5** (Đội Đỏ = team A, Đội Xanh = team B), up to 10 players per room, with several rooms at once.
- **For whom:** internal company tournaments ("game challenger") at Everfit. Desktop browsers only; no mobile.
- **Language:** all in-game text is **Vietnamese**. Code and docs are English.
- **Owner:** Thanh (thanhngo@everfit.io). They judge by fidelity to real Gunbound and will point out anything that looks or feels off.

## 2. Gunbound reference: what we learned

Sources: the user's screenshots and a match video (`~/Downloads/YTSave_…Gunbound-LIGHTING-vs-KNIGHT…mp4`). Always check real footage; designing from memory produced "so bad" results.

| Area | What Gunbound does (verified) | Our implementation |
|---|---|---|
| Mobiles | Toy-like animal/machine hybrids, chunky, big oversized cannon, chibi pilot seated inside. Flat colours, thick ink outlines. | Gamma sprite sheet of 10 animal-mech xe, plus 4 separate seated pilots |
| Maps | Hand-painted scene art. The painting *is* the destructible ground, with a separate painted backdrop behind. | Painted terrain image + mask, and painted backdrop |
| Camera | Measured from the video: only ~44% of the map width is on screen, and a mobile is ~10% of the playfield height. The camera never shows past the map's side edges. | baseZoom = min(vw/1150, (vh−HUD)/560), clamped 0.7–2.2 and to the map in x |
| Shots | Fly fairly slowly (a high lob is 2–3 s in the air). Camera follows the shell and holds on the impact briefly. | Replay at REPLAY_SPEED = 0.62 of simulation time |
| Trail | Some shells leave a thin wavy smoke line. The user wants it **very faint**: it must never hide the projectile. | Faint ribbon, alpha ≤ 0.28, starting 5 frames behind the head |
| Projectiles | Big and glowing, about 4–5% of the playfield height including the glow | SHOT_SIZE defaults 40 (58 for SS), glow radius 1.15× |
| Explosion | Translucent swelling bubble, lots of terrain-coloured chunks, small red damage digits | fx.bubble + fx.debris (colours sampled from the ground) + 'digit' text |
| SS | The battlefield **darkens** while the SS flies (the HUD stays lit); the shot glows | `dark` overlay up to 0.62 during SS flight, plus a cut-in banner |
| Aim | Translucent disc around the active mobile with its angle range, a barrel line, and the angle number above | drawGauge + blue angle badge + orange "LƯỢT" tag |
| Wind | 360° direction, strength 0–26. Each match has its own base wind. It **holds for several turns** and only drifts a little (±1–2 strength, tens of degrees). | rollWind() at match start; driftWind() at 35% per turn |
| HUD | Blue metal panels; 1 / 2 / SS square buttons; big red power bar with a last-power marker; thin "Move" bar; "LAST 83°"; big red turn timer; SCORE box; gold counter | Same, with Vietnamese labels |
| Match start | Loading screen with a card per slot (empty slots too), room/map/rules panel, and a full-map strip with spawn markers. Then a diagonal wipe, a "SCORE START!" banner and a camera flyover of the spawns. | Loading screen, wipe, "BẮT ĐẦU!" banner, INTRO_MS flyover |
| Bonuses | Chat shows "[High Angle Bonus] +150", "[Good Shot Bonus] +206", paid in gold | shotBonus() in room.js |
| Chat | Speech bubbles above players | drawBubble |
| Player info | Hover shows rank, win rate and favourite mobile | Tooltip from data/stats.json |

## 3. Core rules

- **Turn order = delay system.** Every tank has `delay`. The alive tank with the lowest delay acts next (ties go to the earlier `order`). After acting, it adds the shot's delay plus the pixels it moved. A timeout adds 800. Stronger shots cost more delay.
- **A turn:** move (limited by the move budget, the "LỰC ĐI" bar), set the angle (↑↓, within the xe's range), hold SPACE to charge power (0→100 in 1.7 s), release to fire. Keys 1/2/3 pick Shot 1 / Shot 2 / SS.
- **Turn time** is a room setting: 15, 20 (default) or 30 s. A disconnected player's turn lasts 4 s.
- **SS (Gunbound rule, 2026-09-30):**
  - SS is ready from the start. After you fire it, it is locked for your next 4 turns (`SS_COOLDOWN`), shown as 🔒N on the button and as the refilling "SS" bar.
  - This replaced our own "Nộ bar + max 2 SS per match", which showed as the unclear "SS·2" label.
  - Sudden death can change it: SS Mỗi Lượt frees it, Bắn Đôi and Bom To lock it.
- **Đột tử (Gunbound Sudden Death)** is a room option: off, or after turn 20/30/40. From then on **items are locked**, and the room picks one type:
  - **Bắn Đôi:** every shot fires twice.
  - **Bom To:** blasts are 1.5× wider and do +30% damage.
  - **SS Mỗi Lượt:** SS can be used every turn.
  - **Máu Cạn Dần:** at the start of every round (one turn per living xe), every xe loses k × 20 HP, where k is the round number since sudden death started.
  - Gunbound has the first three (plus "No Death"). Máu Cạn Dần is the user's memory of a late-game HP drain; it isn't documented for PC Gunbound, but it fits the purpose.
  - The old "×2 damage" sudden death was our own invention and is gone.
- **Chế độ (mode)** is a room option:
  - **Đấu thường (Solo):** last team standing wins.
  - **Tính mạng (Gunbound Score):**
    - Each team shares team-size + 1 lives (❤ in the HUD corner), and every death costs one life.
    - While lives remain, the dead player respawns after 4 turns. They click the map to choose a drop point, or get a random one. The drop is shifted by the wind and falls from the sky.
    - The respawned xe has full HP and joins the back of the delay queue.
    - A team loses when its lives reach 0, or (for teams of 2+) when nobody of it is on the field (Gunbound rule).
    - Results show the D (Bị hạ) column.
- **Win:** eliminate the whole enemy team. A team whose humans all leave forfeits.
- **Falling** into the water/lava at the bottom kills instantly.
- **Aiming (Gunbound rule, docs/research/gunbound-mobiles-aiming.md):**
  - The aim angle is relative to the xe's **body**, and the body leans with the ground. The lean is `bodyTilt` in shared/physics.js: up to about ±26°, and flyers (Phượng, Tề Thiên) stay level.
  - So facing downhill lets you shoot below the horizon, which is how you hit enemies lower on the map.
  - The gauge turns with the body, and the number shown is the real launch angle, which can be negative.
  - Angle ranges were brought down to Gunbound's (mostly 10–55°, 2026-09-30). Only Cú (10–89, like Boomer) and Tề Thiên (10–80, like Knight) reach the steep angles; Phượng and Voi reach 70.
  - Gunbound has **no straight shot from the barrel**. Its beams (Lightning, A.Sate, Aduka/Thor, Knight) strike from the sky onto where a normal lob landed.
- **Same curve rule (user-verified 2026-09-30):** for a given xe, **every shot, SS included, flies the same curve** for the same angle, power and wind. Shots differ only in wind sensitivity (`windMul`) and in what happens on impact or at the apex (split, bounce, drill, sky strike, pierce…). Never give a shot its own speed or gravity: players aim by muscle memory, and an SS that "flies to the sky" breaks that. There are no exceptions any more: Tề Thiên's staff became a sky strike, which is how Gunbound makes "straight" attacks usable.
- **Friendly fire:** 50% damage to allies (including yourself).
- **Sudden death** (room setting, **off by default**; options 20/30/40): after that turn, all damage ×2.
- **Leaving:** the ESC key or the "ESC Thoát" button, with a confirm, returns you to the lobby.

## 3b. Weather (Thời tiết)

Checked against the Gunbound video (2026-09-30): the HUD shows a **5-slot weather queue**:
- Slot 1 is the one that just passed, slot 2 (orange frame, in colour) is **active**, and slots 3–5 are coming next (greyed).
- The active weather **holds for several turns**; one blue weather stayed active from 172 s to 186 s.
- When it expires, the queue **slides left** and a new random weather enters on the right.

Looks and rules checked against Gunbound screenshots (Bing image search, 2026-09-30) and the Gunbound weather description on StrategyWiki:
- **Tornado:** a narrow white twisted column, like a rope or drill, from the top of the screen to the ground. It is about as wide as a mobile, with light-blue shading and no outline. Gunbound also pays a small "Huracán" bonus for shooting through it.
- **Lightning:** a beam of lightning on the map. A shell that flies through it is **electrified**, and **when it lands a bolt strikes from above onto that spot**, stopping at the first land. Our first version struck the middle of the column instead, so a player standing under it never got hit (the user reported this on 2026-09-30).

| Weather | Weight | Lasts | Appears | Effect |
|---|---|---|---|---|
| Trời quang (clear) | 4 | 1–2 turns | none | none |
| **Lốc xoáy** (tornado) | 3 | 2–3 turns | random x (260..W−260) with a random **spin direction** (dir ±1) | A shell entering the column (±38 px) is caught: it spins with the tornado while rising (~40 frames), then is **flung in the tornado's direction** (vx = dir·\|vx\|·0.85, thrown upward), whichever side it came from. Once per shell. Bonus "Qua lốc xoáy" +50 G. |
| **Sấm sét** (thunder) | 3 | 2–3 turns | random x, a narrow electric beam | A shell crossing the beam (±30 px) becomes **electrified** (it sparks, shows "NHIỄM ĐIỆN!"). **Where it lands, a bolt comes down from the sky** to the first ground in that column: 120 dmg, r 38, on top of the shell's own blast; it can hit anyone, including allies. At most 3 bolts per shot. Bonus "Đạn nhiễm điện" +50 G. |

- **Appear:** the queue slides and the new icon pops. The column grows in over 1 s, with a banner ("LỐC XOÁY ←/→", "CỘT SÉT XUẤT HIỆN!") and a chat line explaining the rule and how many turns it lasts.
- **Disappear:** when its turns run out it fades out over 1 s where it stood, and chat says "… đã tan".
- **Drawing (game.js):**
  - `drawTornado`: white helix bands with blue undersides scroll up the column and lean the way it throws. A dust skirt spins at its foot, and a small yellow arrow shows the throw side.
  - `drawThunderBeam`: a violet beam body with a white core and crackling arcs regenerated 12× per second.
  - `drawZapAura`: sparks on an electrified shell.
  - `drawBolts`: a forked bolt with glow, body and white core, plus a light splash where it lands.
- The minimap marks the active column.
- Icons: public/assets/sheets/weather.jpg also has spare badges for Hố đen (black hole), Trăng (moon) and Force, for future weathers.
- The code is in shared/physics.js (WEATHERS, rollWeatherType, activateWeather, advanceWeather, and the spin/thunder hooks in simulateShot), room.js nextTurn/fire, and game.js drawWeather/renderWeatherBar. NPC aim simulates the active weather too.

## 3c. Audio

All sound is synthesized in WebAudio (`public/js/fx.js`); there are no audio files. **Never cut or reuse the original Gunbound audio (Softnyx copyright).** Match its character instead. Measured from a Gunbound match recording on 2026-09-30:

| What | Measured in Gunbound | Our version |
|---|---|---|
| Music | F major in every match, ~144 BPM (kick gap 0.40–0.42 s), syncopated kick and stepping bass, bright square/brass lead, sustained 450–600 Hz pads, ~20 dB under the SFX | Original theme `THEME` (F–Dm–B♭–C, 8-bar melody), 144 BPM; each map varies tempo, lead wave and key (`TUNES`). Music bus 0.1 |
| Explosion | sharp attack, sub-bass (<250 Hz) ~0.9–1 s, bright crackle ~0.8 s | `boom(r)`: crack, sine sweeping 90→40 Hz, low-passed noise body closing 1600→180 Hz, random crackles; loudness scales with blast radius |
| Incoming shell | ~0.6 s high whistle before the blast | `whistle()`, fired 0.6 s (replay time) before up to 3 boom events per shot |
| Thunder | small crack, then 3–4 low rolls over ~1.4 s, centroid falling ~600→90 Hz | `thunder()`: crack + 4 lowpass rumbles, each darker |

A limiter on the master bus stops stacked blasts from clipping. The mute toggle is stored in `localStorage` (`tc-mute`).

## 4. The 13 xe (10 normal + 3 legendary)

The balance rule was congPha + doBen + coDong = 20 (ratings 1–10). Exact numbers live in `shared/xe.js`, which is the source of truth; this table is a summary.

**Redesign v3, live since 2026-10-01** (the user said "tự chốt, review sau"; design doc https://claude.ai/artifact/LX3ih79iFsa1AH2zG98aD1).
- Rule: **one mechanic family per xe, owned by nobody else**, so no xe's shot is another xe's SS and xe differ in *mechanics*, not just effects (user: "đừng làm cho các con trông giống y chang nhau về skill, chỉ khác effect").
- Each xe also has one passive of a different kind (user: "mỗi con cần 1 skill nội tại riêng"). Passives show in-game as a ✦ chip with a tooltip, on the xe hover card and in the room.

| id | Family | S1 | S2 | SS | Passive |
|---|---|---|---|---|---|
| rong | Airtime (only one) | Hỏa Cầu: grows 170→300 dmg over 50–120 frames; burn at full | Mưa Lửa: fire drops on the descent every 14 frames (max 6) | Thiên Long: ≥120 frames airborne → dragon 520 r78 + big burn, else 320 | Long Nộ: after taking damage, the next shot counts as +30 frames airborne |
| kylan | Straight beam + heal | Tia Sừng: tracer (passes xe), horn beam to the point, stopped by ground/foe, heals allies on the line | Hào Quang: allies +180 and cleanse, foes 90, r70 | Thánh Quang: wide beam through everything, 260 to foes in the band, +150 allies | Thánh Thể: at its turn start, allies within 120px +30 HP. Never hurts allies |
| kimquy | Pierce xe (Nỏ Thần) | Tên Đồng: arrow through every xe (×0.7 each next), ground ends it | Rụt Mai: same arrow + 120 Giáp ảo + allies ±90px +20% armour | Vạn Tiễn: 5-arrow fan (4° apart), each pierces xe | Mai Thần: Giáp ảo 300, +60/turn |
| phuong | Rebirth | Lông Phượng Lửa (was Tro Tàn): blast, then a firebird hops forward and blasts (110) | Phượng Non (was Lửa Tàn Lan): two hops, forward and back (90 each) | Niết Bàn: 300, then a chain of 3 growing hops (120/150/180) | Tái Sinh: revive once at 25% |
| voi | Push + two barrels | Pháo Tháp: from the tower (muzzle −20 px), carve ×1.4, push 40 | Vòi Rồng: from the trunk (muzzle +26/+24), push 130 | Voi Dậm: quake pulses both ways with push 70 | Thân Nặng: cannot be pushed or pulled |
| bachtuoc | Blind + root | Mực Đen: blind 1 turn | Xúc Tu Trói: rooted, no movement on its next turn | Kraken: all foes within 140px blind + rooted | Ẩn Mực: under 30% HP, hidden from the other team (faint, no label, off minimap) |
| bocap | Poison + minions | Nọc Độc: 40×3 | Ổ Bọ Con: fires 3 separate babies in a fan (no blast on landing). Each is drawn in code (`art.js drawBabyScorpion`: fly / idle / walk / sting) with a pulsing trap ring. They sit out one full turn (visible, dodgeable), then each walks ALONG THE GROUND (`crawlPath`: climbs ≤10 px/step, falls ≤60 px, ≤250 px) to the nearest foe and stings (70 + 30×2) only if it reaches it; they stay up to 3 rounds | Bọ Cạp Tử Thần (was Đuôi Tử Thần): armour-piercing 80×3 that spreads to a clean neighbour (≤80px) each turn | Gai Độc: whoever hits it from ≤300px gets 25×2 poison |
| cu | Mark + homing | Lông Vũ: wind ×0.7 (×0.49 total) | Mắt Đêm: team mark +30% for one round | Cú Săn Mồi: on the descent homes onto a marked foe within 350px | Mắt Cú: sees the first ~40 frames of its shot's path while aiming |
| camap | Underground (Nak) | Răng Khoan: drill 160 | Lặn Cát: dives on ground contact, curves back up underground (reversed gravity), bursts out | Đánh Hơi: ghosts through all ground, explodes only on a xe | Đánh Hơi Máu: +20% vs xe under 50% HP |
| tethien | Wind + transformation | Chuối Boomerang: +20% and "Boomerang" bonus if the path reverses | Gậy Như Ý: plants a pillar (160 px, 2 rounds) that stops shells, is never carved, and bots see it | Cân Đẩu Vân: blast, then rides to the landing point | Cân Đẩu: move 300, climbs 12 px steps |

| gau | Freeze / turn delay | Cầu Tuyết: chill, victim's next turn +150 delay | Băng Phong: frozen, loses its whole next turn but takes 50% dmg while frozen (ice block drawn) | Kỷ Băng Hà: blizzard, every foe within 300px +250 delay and SS locked +1 | Lông Dày: no single hit deals more than 320 |
| canhcut | Ricochet | Cá Đông Lạnh: bounces off ground up to 3×, +25% per bounce | Trượt Bụng: slides along the ground, banks off walls (+20% each), blows up on a xe | Bi-a Băng: up to 6 bounces, +30% each | Bơi Lội: the first fall into water, swims to the nearest shore |
| tho ★ | Gravity | Bánh Mochi: the victim's next shot is heavy (gravity ×1.35) | Vầng Trăng Khuyết: moon zone r130 for 1 round, shells inside float (gravity ×0.4) | Đêm Trăng Rằm: 1-round night, foe shells ×1.3 heavy, ally shells ×0.85 | Chân Thỏ May Mắn: 20% of hits miss; the xe itself is light (gravity 0.62) |

**Nicknames (2026-10-01).** User: "đặt tên vui cho tất cả các xe", e.g. Tề Thiên → Hầu Ca. The user liked Hầu Ca and Thỏ Muội but found invented ones (Khè Long, Cạp Bỉm Sữa…) weird, so every name now borrows one people already know. `name` is the nickname; `title` keeps the proper name under it.

| Nickname | Proper name | Where people know it from |
|---|---|---|
| Hầu Ca | Tề Thiên | Tây Du Ký: what Bát Giới calls Ngộ Không |
| Thỏ Muội | Thỏ Ngọc | Tây Du Ký: Ngọc Thố tinh |
| Long Vương | Rồng Lửa | Tây Du Ký: the Four Seas Dragon Kings |
| Sa Đệ | Cá Mập Cát | Tây Du Ký: Sa Tăng, "sư đệ" from Lưu Sa Hà (the flowing-sand river); Hán-Việt "sa ngư" is shark |
| Bọ Cạp Tinh | Bọ Cạp | Tây Du Ký: the scorpion demon |
| Tượng Tinh | Voi Chiến | Tây Du Ký: Bạch Tượng Tinh of Sư Đà Lĩnh |
| Quy Lão | Kim Quy | Dragon Ball: Quy lão Kame |
| Phượng Tỷ | Phượng Hoàng | Hồng Lâu Mộng: Vương Hy Phượng |
| Bạch Tuộc Paul | Bạch Tuộc | the World Cup 2010 "prophet" octopus |
| Cú Vọ | Cú Đêm | Vietnamese word; "mắt cú vọ" = a sharp, prying stare (it marks targets) |
| Hùng Ca | Gấu Bắc Cực | Hán-Việt "hùng" = bear, and "hùng ca" = an epic song |
| Lân Nhi | Kỳ Lân | wuxia "-nhi" pet names (Dung nhi) |
| Tiểu Cụt | Chim Cánh Cụt | wuxia "tiểu" (Tiểu Long Nữ) |

**Rider pop-up:** clicking a player's slot in the room opens a big animated preview of the rider on their xe, with the player's rank, the xe's names, role and passive. Hầu Ca now carries its pilot piggyback (the pilot peeks over its shoulder) instead of leaving them standing on the cloud behind.

### 4b. Legendary xe (Huyền thoại, random-only)
User request 2026-10-01: like Gunbound's Dragon/Knight, some xe can't be picked and only come from the dice, so rolling one is a thrill. They may be stronger than normal xe.
- Legendary: **Rồng Lửa, Tề Thiên, Thỏ Ngọc** (`legendary: true` in shared/xe.js; `PICKABLE()` / `LEGENDARY()`). Rồng and Tề Thiên got about +15% (Rồng HP 1300, bigger fire/dragon; Tề Thiên HP 1050).
- Chances: a player who picks "?" rolls a legendary 30% of the time (`LEGEND_CHANCE`); in all-random rooms each player has 20% (`LEGEND_CHANCE_ROOM`). Bots never get one.
- **Practice rooms can pick any xe, legendary included** (user: "trong chế độ luyện tập, tôi có thể chọn bất cứ con nào").
- Room UI: legendary cards are purple with a 🎲 badge; clicking one outside practice only opens its details (banner explains the odds). A rolled legendary gets a purple-gold loading card, a "🌟 HUYỀN THOẠI!" chat line, and a banner for its owner.

**Visual redesign of the first 10 (2026-10-01)**, user: "làm lại visual + đạn của 10 con trước, như cách bạn đã làm cho 3 xe mới", renames allowed. Each xe now carries one weapon that shows its mechanic family:
- Rồng: fire-breathing Eastern dragon with a furnace cannon (mouth open, jaw rig).
- Kỳ Lân: jade qilin on cloud puffs, crystal horn beam, lotus saddle.
- Kim Quy: golden turtle whose shell is the Cổ Loa spiral citadel, magic crossbow on top.
- Phượng: white-gold phoenix holding an ember orb, nest saddle.
- Voi: war elephant with a pagoda cannon (high barrel) and a brass trunk nozzle (low barrel).
- Bạch Tuộc: sleepy captain octopus pouring an ink bottle.
- Bọ Cạp: emerald scorpion with a venom-bulb tail and a nest of babies on its back.
- Cú: starry night owl with a monocle and a brass telescope rifle.
- Cá Mập: shark riding a sand wave with a drill nose (no more treads).
- Tề Thiên: Monkey King on a golden nimbus holding the staff.

All face right with a visible seat, and the projectiles were redrawn to match (fireball / drip / dragon, crystal / halo / lance, bronze and gold arrows, feather / chick / phoenix, rune stone / water ball / foot, ink / tentacle / kraken, dart / eye sigil / diving owl, drill / fin / jaw, banana / staff / cloud). The Gậy Như Ý pillar is now a lacquered red staff with gold caps, a spiral inlay, a gold aura and cloud puffs at its foot.

The bear and rabbit were redrawn facing right (user 2026-10-01: they looked left while the others look right, the bear was small, and the rabbit's rider was lopsided). The rabbit's pilot now sits in a saddle on its back.

New bonuses: **Hất văng** (+100 per enemy knocked into the water, Gunbound "Bunge") and **Boomerang** (+80).

Every shot has its own projectile sprite (30 total) and look key. Every SS has a cut-in banner plus a per-xe impact effect (ssImpact in game.js).

## 5. Economy and progression

- **Gold (G)** is earned in a match from shot bonuses: Trúng đích = dealt/4, Thưởng góc cao +150 (angle ≥ 70), Bắn xa +200 (> 1100 px), Phát bắn tuyệt vời +250 (≥ 350 dealt), Trúng nhiều mục tiêu +120 each, Tuyệt chiêu +100 (an SS that hits), Hạ gục +300 / Hạ gục kép +800, and Bắn trúng đồng đội −100 each ally.
- **Career stats** are kept per name in data/stats.json (games, wins, kills, dealt, gold, xe usage).
- **Ranks (Gunbound ladder, shared/ranks.js).** This replaced the old win-count titles (Tân Binh…Huyền Thoại) on 2026-09-30, at the user's request ("gà con…").
  - Sources: the Gunbound WC level table and the Gunbound M Vietnamese names (2game.vn: Gà Vàng, Búa Gỗ, Búa Gỗ Đôi, Búa Đá…).
  - **GP** = 2 per match + 10 per win + 3 per kill. It never goes down, so everyone keeps climbing. It is computed from stats, so there is no migration.
  - GP ladder: Gà Con 0 → Búa Gỗ 20 → Búa Gỗ Đôi 45 → Búa Đá 80 → Búa Đá Đôi 120 → Rìu Sắt 170 → Rìu Sắt Đôi 230 → Rìu Bạc 300 → Rìu Bạc Đôi 380 → Rìu Vàng 470 → Rìu Vàng Đôi 570 → Gậy Tím 700 → Gậy Ngọc Bích 850 → Gậy Hồng Ngọc 1000 → Gậy Kim Cương 1200.
  - **Dragons by leaderboard place** (needs ≥ 10 matches), like Gunbound's 1 white / 4 red / 16 blue scaled down for one office: Rồng Trắng #1, Rồng Đỏ #2–3, Rồng Xanh #4–6.
  - Shown in: the lobby card (badge, GP bar to the next rank, click for the full "Bảng hạng" ladder), the leaderboard (sorted by GP), room slots, the in-game hover card, and the results table (icon, +GP). A **"LÊN HẠNG: …!"** badge pops on the results screen, and chat announces everyone's rank-ups.
  - Art: art-src/ranks-v1.jpg → public/assets/sheets/ranks.jpg. It holds 16 objects on a 4×4 magenta grid: chick, wood/stone hammer, iron/silver/gold axe, 4 wands, 3 dragon heads, a "?" box, a trophy and a crown. The medallion is drawn in code (dark navy like Gunbound M, with a ring in the tier colour). "Đôi" ranks cross two copies in an X.
- **Xe ngẫu nhiên** (Gunbound has a "Random" mobile slot too):
  - The "?" card is first in the xe picker; a player who picks it is rolled a xe at match start.
  - The room option **Xe: Ngẫu nhiên cả phòng** rolls everyone and greys out the picker.
  - Rolls avoid duplicates while possible. The loading card shows 🎲, and chat says "🎲 X bốc được Y!".
  - Stored as `m.xe = 'random'` in the room and `tank.rolled` in the match.
- **Pilots:** 4 to choose from (m, f, m2, f2), shown as Nam 1 / Nữ 1 / Nam 2 / Nữ 2.
- **Login:** name + 4-digit PIN. The first login claims the name (data/accounts.json, hashed). The PIN is remembered in the browser.
- **Practice room** (🎯 LUYỆN TẬP MỘT MÌNH): you vs 2 "Bia Tập" dummies that skip their turns and refill HP each turn. Shows rotating tips and a dashed ghost of your last trajectory. No stats are recorded.

## 6. Senior design review (2026-09-30) and what we changed

Findings from reviewing the code and numbers (not yet play-tested with real people). Status is kept here:

1. **No items → shallow turns.** Add Gunbound-style items bought with gold. *Status: see §7.*
2. **SS too frequent.** *Changed first to a slower rage bar with max 2 SS; then replaced by Gunbound's SS cooldown (4 own turns).*
3. **Splash too forgiving** (40% minimum at the blast edge). *Changed: 18% minimum, plus a direct-hit bonus (×1.15).*
4. **High-angle play not rewarded enough.** *Changed: +10% damage at angle ≥ 70, on top of the gold bonus.*
5. **Balance:**
   - Cú Đêm was strongest (lowest delay, 0.5× wind, 89°, longest move). *Changed: delays 680/760/1060, wind 0.7×.*
   - Kim Quy was a trap pick (45° cap). *Changed: 10–55°.*
   - Kỳ Lân's double heal dragged matches out. *Changed: Shot 2 no longer heals.*
   - Rồng and Voi were too slow on painted maps. *Changed: move 130 px.*
6. **Maps all feel the same.** *Changed: each painted map can be mirrored at random; spawns alternate A/B by position; Núi Lửa's lava rises after turn 15.*
7. **No onboarding.** *Changed: a practice room (Luyện tập) with a dummy target and a ghost of your last trajectory.*
8. **Tournament / leaderboard.** *Done: leaderboard (top 10) in the lobby.* *Not done yet: a tournament bracket (see §8).*
9. **Gold had no use.** *Changed: gold buys items during a match.*
10. **Rank spoofing by name.** *Changed: name + 4-digit PIN; the first login claims the name.*
11. **Sound is placeholder beeps.** *Changed: layered synthesized SFX plus procedural background music per map (WebAudio), with a mute button.*
12. **Juice:** *Changed: hit-stop on big hits, camera punch-in on kills, death animation, MVP on the results screen.*

## 7. Items (Vật phẩm)

Each player starts a match with **400 G** (START_GOLD) plus whatever they earn. You can use **one item per turn, before firing** (keys 4–7 or click). Each item is bought, used and gone.

| Key | Item | Cost | Effect | Extra delay |
|---|---|---|---|---|
| 4 | **Bắn Đôi** (Dual) | 350 G | This turn's shot fires twice (the second 0.6 s after) | +250 |
| 5 | **Dịch Chuyển** (Teleport) | 300 G | The shot doesn't explode; you teleport to where it lands | +150 |
| 6 | **Hồi Máu** (Heal) | 250 G | +300 HP now (up to max) | +100 |
| 7 | **Đạn Mạnh** (Power) | 300 G | This shot +30% damage | +150 |

NPCs use items as well: they heal below 35% HP, and sometimes use Bắn Đôi when they have gold to spare.
Item icons are plain glyphs (×2 ⇄ ✚ ⚡) because some emoji don't render in every font.

## 8. Open ideas / backlog

- **Full redesign of all 10 xe, v2, waiting for the user's approval (2026-10-01):** https://claude.ai/artifact/LX3ih79iFsa1AH2zG98aD1
  - The user said every xe must be redone, based on analysing Gunbound's shots.
  - Diagnosis: Gunbound shots are memorable because each mobile has its **own physics rule the player learns to exploit**: airtime transforms (Armor/Boomer SS), entry angle decides the tunnel (Nak), helix merges when steep (Turtle/Mage), orbit phase (Trico), line of sight from a satellite (A.Sate), waiting minions (Raon), two barrels (Ice), homing needs airtime (Kalsiddon). Ours were mostly **on-hit status effects** (poison, blind, burn, mark, heal), which don't change how you aim.
  - New signatures:
    - Rồng: fire grows with airtime; S2 drops fire along the arc; SS turns into a dragon if airborne ≥ 2.5 s.
    - Kỳ Lân: horn beam from the body to the tracer point, blocked by terrain, heals allies on the line; SS gives every enemy/ally in range a light pillar.
    - Kim Quy: sliding shell (Grub-like) + Giáp ảo (done) + Nỏ Thần arrows that pierce xe.
    - Phượng: every shot is reborn once (a second hop and blast; S2 returns as lifesteal; SS chains 3 rebirths).
    - Voi: two barrels like Ice (tower S1, low trunk S2), push, bunge bonus.
    - Bạch Tuộc: twin ink helix that merges when airborne ≥ 2.5 s; SS gathers enemies to the centre.
    - Bọ Cạp: baby scorpions that wait a turn then crawl and sting (Raon); SS poison spreads.
    - Cú: lowest-wind dart, team mark, SS owls home in after ≥ 1.5 s airtime (Kalsiddon).
    - Cá Mập: Nak rules (S2 tunnels by entry angle, SS passes through terrain until it hits a xe).
    - Tề Thiên: wind boomerang with a direction-change bonus (Boomer), sky staff (Knight), SS Cân Đẩu Vân (strike + teleport).

- Tournament bracket mode (single elimination; the host seeds rooms).
- More map variants (Gamma sheets are cheapest: 70 credits per image).
- Environmental hazards on the other maps (slippery ice, sand sinking).
- Redo the key art in the toy-mech style (the current key art still shows the older realistic xe).
- Account system (company SSO) instead of name + PIN.

## 9. Art direction rules

- **Signature effects, not bounces (user feedback 2026-10-01):**
  - The user disliked the generic hops (on turn start, idle, and on winning), so they were removed.
  - Each animal instead has its own effect, the way Gunbound's dragon breathes fire:
    - Rồng: flame bursts from the mouth.
    - Kỳ Lân: horn sparkle and rainbow motes.
    - Kim Quy: a gleam across the shell.
    - Phượng: embers from the wings.
    - Voi: trunk spray.
    - Bạch Tuộc: bubbles in the bell.
    - Bọ Cạp: a venom drip from the sting.
    - Cú: glowing, blinking eyes.
    - Cá Mập: sand falling from the drill.
    - Tề Thiên: cloud wisps and gold sparkle.
  - Code: `art.js drawXeFx`. It is deterministic from time, with part anchors in `XE_PARTS` measured on the pilot sprites.
  - On firing, `game.js signatureFire` plays a bigger version at the same part (e.g. a fire breath cone from the dragon's mouth).
  - **Menus:** only the rider-on-xe pictures in the team slots animate (signature effect only); xe cards and the detail picture stay still.
- **Moving body parts (rigs), user request 2026-10-01: "the xe must look like they move; the dragon opens its mouth to breathe fire".**
  - `assets.js RIGS` cuts parts out of the one-image animal sprite: a polygon plus a pivot, grown 6% so the outline comes along. The part is erased from the base, and the hole is painted where needed (the dragon's mouth interior and tongue).
  - `art.js rigMotion` turns the parts every frame. The moving parts per xe:
    - Rồng: jaw (opens on each fire puff and wide on firing), wing, tail.
    - Kỳ Lân: tail.
    - Kim Quy: head nod.
    - Phượng: wing flap.
    - Voi: trunk (raised on firing) and ear.
    - Bạch Tuộc: two tentacle groups.
    - Bọ Cạp: tail (strikes on firing).
    - Cú: wings (double flap).
    - Cá Mập: tail fin.
    - Tề Thiên: cape.
  - The pilot is drawn on top from the composite's `pilotRect`.
- **Pilot + animal as one piece (user feedback 2026-10-01: "tay chân nhân vật nằm đè lên xe, rời rạc"):**
  - `assets.js OCCLUDE` has one polygon per xe for the animal's back, saddle, basket rim or tower wall. It is drawn again OVER the pilot, so the hips and legs sink behind it, while cannons and crossbows above stay behind the pilot.
  - Rigged drawing does the same: animal, then pilot, then the animal clipped to the occluder.
  - Seat heights are in `SEATS`.
- **Projectile graphics review (2026-10-01):** sprites that didn't match their shot were redrawn on proj-c.jpg (green key, 3×3) and proj-d.jpg (magenta key, 2×2). They are loaded by `PROJ_FIXES` in assets.js.
  - Redrawn:
    - Tề Thiên S2 Gậy Như Ý: now a red staff with gold caps (was a pink scepter).
    - Kim Quy S2 Rụt Mai: shell with a shield hexagon (was a gold bullet).
    - Phượng S2: ember phoenix chick (was a bullet with a wing).
    - Voi SS: elephant stomp (was a plain rock).
    - Rồng S2: dripping fireball.
    - Bọ Cạp S1: stinger with a venom drop (was a potion bottle).
    - Bọ Cạp SS: venom stinger (was a skull).
    - Tề Thiên SS: banana boomerang (was a peach).
  - Spares for the redesign are in `ASSETS.projNew`: nimbus, cannonball, inkHelix, slideShell, babyScorpions.
  - Explosion palettes for Phượng S2 (should be gold, not Rồng red) and Tề Thiên S2 (staff) need a `look` change in shared/xe.js. That is deferred to the redesign so the live server isn't restarted twice.

**UI "sticker" system** (graphic design pass, public/css/theme.css):
- Menus use the same language as the game art: 3px ink outlines (#0b1633), hard offset shadows (0 4–6px 0 ink), bevel highlights, and outlined titles.
- **Palette with one job per colour:** gold = primary action, green = practice/confirm, red/blue = teams, purple = items, cream = room cards, dark inset navy = the room list "screen".
- **Type scale:** 88 hero logo / 30 h1 / 21 h2 / 15 body / 13 small. Baloo 2 for words, Orbitron for digits.
- **Logo:** solid gold with an ink outline and a 3-step orange extrusion, tilted −3°, with the dragon xe emblem.
- **Painted icons** (Gamma sheet, public/assets/sheets/icons.jpg): items and the gold chest (its 5 old rank badges are no longer used; ranks come from ranks.jpg). Gamma added English captions under the icons, so the crop boxes stop above them.
- Key art v2 matches the toy-mech roster (v1 realistic art is kept in art-src/keyart/).
- **Lobby:** player card | room list (cards with map thumbnail and status pill; the empty state shows an xe parade plus CTAs) | create + leaderboard. The how-to guide lives in a modal.
- **Room:** shot cards show their projectile sprite; empty slots show a dashed "+".
- **HUD:** utility buttons (Bỏ lượt · F8, Thoát · ESC) sit top-right, away from the fire controls. The power bar is labelled 0/25/50/75/100. Results show an MVP card.

**Illustration rules:**

- Style: early-2000s Korean online game; chunky toy-like chibi; **thick hand-inked black outlines**; flat bright colours with minimal cel shading.
- Animals are **hybrids with gear**, never realistic. They move on their own legs, fins, wings or tentacles; not every xe needs wheels.
- Pilots are separate sprites (so players can choose). Vehicle-only previews in "Chọn xe" have **no pilot**.
- Text rendering: Vietnamese stacked diacritics clip with `line-height: 1`. Always use ≥ 1.35, and pad gradient (`background-clip:text`) text.
- The user prompt template for Gamma sprites: `[STYLE] … [VEHICLE] … [WEAPON] …` (see TECH_DESIGN §6).

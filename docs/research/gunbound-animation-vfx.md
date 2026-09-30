# Gunbound: how it looks and moves (animation, VFX, camera, map size)

Research date: 2026-09-30. Goal: concrete, copyable animation and effect details for Thú Chiến (Canvas 2D, chibi animal mobiles).

## How to read this

There are three kinds of source, and each bullet says which one it comes from:

- **[GB]**: real Gunbound. This covers official Softnyx 800×600 screenshots (the same set listed in `gunbound-ux-fun.md` §0), GameFAQs and StrategyWiki guides, TV Tropes, and Gunbound aimbot source code that reads the game's memory.
- **[DB]**: the **DragonBound client source**. DragonBound (dragonbound.net) is the long-running browser remake of Gunbound, with the same mobiles, maps, weather and bonuses. Its full de-obfuscated client (`DragonBound.js`, about 4 MB) is committed in https://github.com/RxFaX/Aimbot-DragonBound (file `1.js`). That code gives exact frame counts, fps, timings and map sizes. Where DragonBound copies Gunbound, the numbers are the best available stand-in for the original. Where it might differ, the bullet says so.
- **UNCONFIRMED**: my inference or recollection, with no source found.

**What was not found:**
- The Spriters Resource has **no ripped Gunbound sheets**. It only has two fan "Gunbound Customs" edits (https://www.spriters-resource.com/custom_edited/gunboundcustoms/), and the site now sits behind a Cloudflare check.
- The RaGEZONE threads on the `.img` format are also behind a bot check and were not archived.
- The Neoseeker screenshot page is behind a bot check too.
- No bot check was bypassed and nothing executable was downloaded.

Useful format note [GB]: Gunbound graphics live in `graphics.xfs` as `.img` containers. Each container holds one or more 16-bit frames with per-frame x/y offsets, and #FF00FF marks transparency. Editors for them ("Ar2roMx Image Creator", InsideGB) can "change animations, change coordinates and x/y positions" (https://forum.ragezone.com/threads/gunbound-img-editor-with-source-code.1197013/, read via archive.org). So Gunbound mobiles are **frame-by-frame bitmap animations with a per-frame anchor**, not skeletal rigs.

---

## 1. Mobile animation

### 1.1 The animation state list (the key finding)
DragonBound's `EPA` table defines one sprite strip per mobile, split into named states. The mobiles are Armor, Mage, Nak, Trico, Bigfoot, Boomer, Raon, Lightning, JD, A.Sate, Ice, Turtle, Grub, Dragon, Knight, Aduka, J.Frog and Kalsiddon. Each state lists its frames as `[w, h, anchorX, anchorY, (barrelX, barrelY)]`, and a bare integer means "repeat the previous frame N times". **Each frame carries its own anchor and barrel point.** [DB, `var EPA = {` in `1.js`]

| State | What it is | Typical frames (at 20 fps) |
|---|---|---|
| `normal` | idle loop | **20 frames = 1.0 s loop** for almost every mobile (Trico 15, Kalsiddon 19) |
| `move` | walking or driving | 15–25 (JD 7, Frog 30, Bigfoot 25, Kalsiddon 24) |
| `wnormal` / `wmove` | **weak idle and weak move, used when HP ≤ 30 %** | 18–40 |
| `unmove` | trying to move when you can't (move bar empty or stuck) | 15–21 |
| `fire1`, `fire2`, `sfire`, `ifire` | firing Shot 1, Shot 2, SS and an item shot; plays once, then back to idle | 10–26 (Armor fire1 grows from 35×40 to 55×53 = recoil and muzzle blast; Armor `sfire` is **107×91**, so the SS pose is about 3× the body) |
| `item` | using an item | 20–25 |
| `fdamage` / `bdamage` | **hit from the front / hit from behind**, chosen from the blast direction against the way the mobile faces | **25 frames = 1.25 s** for nearly all mobiles |
| `shock` | hit by electric damage | about 20 |
| `ice` | frozen, 1 frame held for **3 s** | 1 |
| `drop` | falling | 12–20 |
| `dead` | death animation, or a single wreck frame | 1–25 (Nak, Boomer, Raon, Grub, Knight and A.Sate: 1 frame = a static wreck; Armor, JD, Lightning, Turtle, Aduka, Frog: 20-frame death) |
| `emotion1` | **taunt / happy emote** | 11–40 (Bigfoot and JD 40); plays on hover in the mobile-select grid |
| `bfire1`, `bfire2`, `bsfire`, `bifire` | a pre-fire pose for each shot type; probably the pose while holding space to charge. **Inferred:** DragonBound defines these but never plays them. | 8–22 |

The HP and hit rules come from `Player2.prototype.PlayAnim` and `ChangeHPShield`:
- HP ≤ 30 % automatically swaps `normal`→`wnormal` and `move`→`wmove`.
- Hit states play once, then return to `normal` or `wnormal`.
- The HP bar also turns red at ≤ 30 %: `#c61000` versus green `#63b64a`, on a 76 px bar.

In real Gunbound:
- **Trico "cries" when defeated** (https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/Gunbound). A guide says to hit Trico at "about half HP to leave it crying", so the weak idle is a crying Trico (https://gamefaqs.gamespot.com/pc/582632-gunbound/faqs/31866). [GB]

### 1.2 Idle
- **Idle loops are full character animations, not just a bob.** Some were so memorable they became nicknames [GB]:
  - **JD = "Cake"**: a laser pops in and smaller JDs rise out of its top "like a segmented cake".
  - **Lightning = "Lovebot"**: its electric sparks sometimes form a heart.
  - Sources: https://gamefaqs.gamespot.com/pc/582632-gunbound/faqs/25616, https://gamefaqs.gamespot.com/pc/582632-gunbound/faqs/31328. TV Tropes lists "Idle Animation: … these inspired their nicknames".
- **Mobile idle runs at 20 fps (`MOBILE_FPS = 20`) and loops 20 frames, so one cycle takes 1 s.** [DB]
- **The pilot is animated on its own track at 10 fps (`ANIMATIONS_FPS = 10`)** [DB]:
  - The head, body, eyes and flag layers **ping-pong** (`LOOP_NORMAL_AND_REVERSE`).
  - The **head and eyes use a 22-frame "avatar loop"**: half A is the normal breathing ping-pong, half B is a "special" (blink or look-around). B plays on a **random cycle, once every 0–6 loops** (`RANDOM_FACE_TURN_CHANCE = 6`).
  - The background and foreground avatar layers loop at 5 fps.
  - So the pilot blinks and looks around at random times, out of sync with the vehicle.
- Idle keeps running while you aim; only fire, hit and move states interrupt it. [DB]

### 1.3 Moving and terrain tilt
- **The whole sprite (mobile and pilot) rotates to the ground slope under it** (`ChangeBodyAngle` → `rotate_container.rotation = ground.GetAngle(x, y)`). It snaps on each step, with no easing. [DB] The same tilt is visible on sloped mobiles in every Softnyx screenshot. [GB]
- **Turning around is animated.** `scale.x` eases from +1 to −1 at `dt/200` per ms, so the mobile squashes through zero in about **0.4 s** instead of flipping instantly. [DB]
- Walking speed is **50 px/s**, capped at **150 px per turn** (the blue move bar, 400 px wide, drains as you go). [DB `WALK_SPEED`, `MAX_WALK_DISTANCE`] Gunbound's move bar sits under the power bar in every screenshot. [GB]
- A move sound loops while walking. [DB]
- Pressing move with an empty bar, or against a wall, plays `unmove`, a struggling or spinning-wheels loop. [DB]
- Each mobile has its own `move` art: Bigfoot stomps (25 frames, 88 px wide), Frog hops (30 frames), and Grub, Turtle and Dragon walk. There are no generic "treads".

### 1.4 Aiming and charging
- The barrel (`angle` sprite) rotates to `180 + angle` on the body. [DB]
- A **translucent aim disc** is drawn around the active mobile: a pie with the min–max angle arc and the current angle line. Screenshots show green or red wedges. [GB sn_03, sn_19]
- The barrel point changes with each fire frame (the 5th and 6th numbers of each frame).
- The power bar fills from empty to full in "two or three seconds" (TV Tropes, on the "interface screw" item that makes it fill in under 0.5 s). [GB]
- A **green "last shot" marker** sits above the power bar, and "before / now" angle boxes sit beside it. [GB screenshots]
- **Inferred:** the pilot takes a charge pose (`bfire*`) while you hold space.

### 1.5 Firing
- The fire state plays once. Armor's `fire1` is 10 frames: the body pushes back, and the frame grows to 55×53 for the muzzle blast. The SS pose (`sfire`) is 25 frames and huge (Armor 107×91, Ice 74×71). [DB]
- **SS darkens the world** [DB]:
  - While an SS projectile flies, the background is tinted `#505050` (about 31 % brightness), the ground `#808080` (50 %), and the stage `#101010`.
  - In the older DOM renderer this was a black overlay at 0.8 opacity.
  - It fades back **1 s after the SS projectile is removed**.
- **Inferred:** Gunbound also dims the screen for SS. It is commonly remembered, but no screenshot shows it.
- A.Sate and Knight SS spawn an "ion" satellite that slides to the aim line. Thor fires a 1-px-wide beam sprite for 100 ms. [DB]

### 1.6 Getting hit
- The front or back hit reaction plays for 25 frames (1.25 s). [DB]
- Screenshots also show **spinning yellow "dizzy" stars** and white impact starbursts on hit mobiles. [GB sn_10, sn_18, sn_19]
- **The screen shakes on every explosion** [DB `Dragon2D.Shake` + CSS]:
  - `shake` keyframes of **120 ms × 3 = 360 ms**, moving the canvas vertically by **±2 px** (0 → −2 → +2 → −2).
  - It restarts on each blast, so multi-hit shots rattle.
  - It is small and vertical-only.
- **Damage numbers** [DB `DamageSprite`]:
  - They are **bitmap digits** (20×21 px glyphs spaced 14 px apart), drawn at the victim's position −30 px.
  - They **rise 60 px linearly over 600 ms, hold until 2 s, then fade out over 2–5 s** (5 s total).
  - Hits on the same player **accumulate into one number** (the old one is removed and the sum redrawn).
  - Colours: enemy damage is **red**, damage to your own team is **blue**, heals are green "+N".
- In Gunbound screenshots [GB sn_12, sn_14, sn_10]:
  - Red digits with a white outline ("−628", "−491") stack when several hits land.
  - Big-hit labels float above the number: **"CRITICAL!!"** in red, and a blue italic **"N Hit!!"** combo tag joined to its victim by a thin black leader line ("2 Hit!!", "3 Hit!!", "6 Hit!!", "7 Hit!!").
- Knockback is server-driven: the victim is moved to a new x (`movex`) and then falls to the ground at **250 px/s** (`Fall` → `ChangePos(..., 250)`). [DB]

### 1.7 Low HP
- `wnormal` and `wmove` replace idle and move at ≤ 30 % HP; the HP bar turns red at the same point. [DB]
- Trico cries at low HP. [GB] **Inferred:** the other mobiles' `w` art shows damage too (smoke, drooping, sweat). Their `wnormal` frames are shorter or lower than `normal`: Aduka goes from 61 to 34 px tall and Trico from 52 to 45, so they slump.

### 1.8 Dying, corpses and bunge
- **Corpses stay on the map in Solo** and still take hits, "being somewhat effective as a shield", blocking shots for both teams. Mobile guides mention shots "that explode when [they] hit a player … which includes dead players (corpses)". [GB https://strategywiki.org/wiki/Gunbound/Gameplay, https://strategywiki.org/wiki/Gunbound/Mobiles]
- A dead mobile shows its `dead` state: a death animation, then a static wreck frame. [DB] **Inferred:** there is no tombstone in PC Gunbound. The wreck is the marker.
- DragonBound's death effect fades the player to alpha 0 over 1.5–2 s. [DB]
- **Ghost (Score mode, waiting to respawn):** alpha 0.5 plus a slow spin (`rotation = −t/5` degrees, about 200°/s; the CSS version is a 2 s grayscale spin). The name shows "revive in N". [DB]
- **Bunge (falling off the map):** when there is no ground under the mobile, it slides down to y = 2000 at 250 px/s and dies. The big centre message reads "X Bunged" / "You fell down :(" in `#f66`. A kill shows "X Killed" / "You are dead :(" in `#f33`. [DB] Gunbound pays a "Bunge Shot Bonus" (100 G, 1 GP; https://strategywiki.org/wiki/Gunbound/Gameplay). [GB]

### 1.9 Turn indicator
- [GB, every Softnyx screenshot] An **orange "TURN" speech-bubble tag with a down-pointer** floats above the active player's head, about 20 px above the pilot.
- [DB `PlayerInfo.Update`] The tag **pulses and bobs**:
  - Scale goes 1.0 → 1.2 and y goes −116 → −86 px (30 px of travel).
  - It ping-pongs on a **2 s cycle**, 1 s each way.
  - The tag sprite also has **20 frames that count down the 20 s turn timer** (`turn_sprite.set_frame(20 − secondsLeft)`).
  - The CSS `.Turn` sprite is 32×29 px.
- At turn start the camera pans to the active player (see §3.8).

### 1.10 Victory and defeat
- The mobile-select screen plays `emotion1` (the taunt) on hover. [DB]
- **UNCONFIRMED:** that Gunbound plays `emotion1` or a win pose on the result screen. The Softnyx result screenshot (#8) is a modal table over the battlefield with "BLUE WIN / RED LOSE" in big outlined letters and an MVP pill.
- **Emotes over mobiles:** chat lines starting with `*` play animated icons above the sender: hearts, smiley, crying face, "NO" sign. [GB screenshots 3, 13, 19; see `gunbound-ux-fun.md` §1.5]

---

## 2. Room, mobile select and loading

- **Room slots show animated mobiles.** [DB] Each slot runs a live `CPlayerGraphic` (mobile idle at 20 fps plus pilot layers at 10 fps). The lobby "my player" card and the shop preview do the same.
- In Gunbound's older room screen, each banner shows **the avatar riding its mobile**. The newer screen shows **painted mobile art** behind each player card. [GB, Flickr and Softnyx #2; see `gunbound-ux-fun.md` §1.2] **UNCONFIRMED:** whether Gunbound's room figures move.
- **Mobile select grid** [DB `#roomButtonMobile`]:
  - One tile per mobile, each playing its **idle loop at 20 fps**.
  - **Hovering a tile plays `emotion1` (the taunt) once**, then returns to idle.
  - The panel slides down ("fast").
  - The Random tile has its own sprite.
  - Gunbound's grid has "?" Random in the lower-right corner. [GB]
- **Loading screen: UNCONFIRMED** for Gunbound. No archived screenshot was found, and Neoseeker's gallery is behind a bot check. DragonBound just removes a `#Loading` div.
  - Our existing loading card (slot cards, rules and minimap strip) is already richer.
  - Suggestion: run the xe idle animations on the loading cards, since DragonBound animates them everywhere else.

---

## 3. Visual effects

### 3.1 Projectiles [DB bullet table]
- Projectiles are small animated sprites: **5–20 frames at `BULLET_ANIM_FPS = 20`**, about 16–45 px (SS 30–64 px).
- They are **rotated to the flight direction every frame** unless flagged `no_rotate`.
- Some change sprite mid-flight (`shot.change.at`): Boomer's SS changes, and Kalsiddon "opens".
- **Trails:** Mage and Turtle shots draw a **ribbon of 8–16 segments covering the last 500 ms (Mage) or 800 ms (Turtle) of the path**. Each segment is stretched between past positions and rotated along the path, and Turtle's trail texture alternates 8 strips over time for a watery shimmer.
- Other mobiles rely on the animated bullet sprite alone, with no trail.

### 3.2 Explosions [DB `EXPLODES`, `CreateExplode`]
- Each shot type has **its own explosion sheet at 20 fps, played once**:
  - Normal shots: 11–20 frames (0.55–1.0 s), about **128×128 px**.
  - SS: **28–30 frames (1.5 s), up to 256×252 px**. Ice SS, Lightning SS, JD SS and Mage SS are all about 250 px.
  - Boomer is a quick 6-frame (0.3 s) pop. Nak is 11 frames.
- Each explosion also plays **its own mobile-specific blast sound**.
- Screenshots show a **white-hot starburst flash** at the centre with yellow and orange rays. [GB sn_10, sn_18]

### 3.3 Debris
- **Every explosion throws terrain chunks** [DB `CreateFlyingGroundPart`]:
  - `count = round(holeW × holeH / 250)`, so a 50×40 crater throws 8 chunks.
  - Each chunk is one of **44 debris sprites** (37 px cells), launched at a random angle 0–359° and random power 100–600, **under gravity, fading linearly over 1.5 s**.
- In Gunbound screenshots [GB sn_10, sn_14, sn_18]:
  - Debris fills the screen after big shots.
  - It is **themed to the map**: tan rocks on Miramo and Adium, blue ice shards on the ice map, and **nuts, bolts and gears on Metamine**.
  - This is one of the most "juicy" things in the stills.

### 3.4 Craters
- Craters are elliptical holes of size w×h cut into the terrain bitmap (`AddGroundHole(x, y, w, h)`). [DB]
- DragonBound also has `AddGroundShadowColumn`, which draws a darkened rim or shadow inside new holes.
- In Gunbound screenshots, crater edges show a **thin dark outline and burnt shading** where the terrain was cut. Round bites and tunnels stack up into Swiss-cheese terrain. [GB sn_03, sn_04, sn_12]

### 3.5 Big centre callouts ("bonus text")
- Gunbound shows **big stylised word art** in the middle of the screen [GB screenshots 12, 19, 14]:
  - **"SUPER SHOT!!"**: red letters with a white inner stroke and dark outline, flame wisps at both ends, about 450 px wide. It appears alongside the chat line "[Excellent Shot] −100Delay".
  - **"UNBELIEVABLE!!!"**: gold and bronze metallic letters with **white angel wings on both sides**. It appears alongside "[1000/2000/3000 Damage Achieved]".
  - The tier each word maps to is inferred from those co-occurring chat lines and is **UNCONFIRMED** as the exact trigger.
  - **"CRITICAL!!"** (small, red) sits over a damage number.
  - Chat-line bonuses (not big text): Shot Bonus (150–249 damage), Good Shot (250–499), Excellent Shot (500+), High Angle, Ultra High Angle, Bunge, Double Kill, Triple Kill, 1000/2000/3000 damage. In Gunbound these also cut delay, e.g. "[Good Shot] −40 Delay". See `gunbound-gameplay.md` §4.
- DragonBound's big message [DB CSS `.BonusMsg` and `bonus_msg_anim`]:
  - Text is 60 px bold, centred at y = 240 on the 800×600 stage, with a heavy black glow (four 40 px black text-shadows plus a 1 px outline).
  - **Animation, 2 s total:**
    - 0–25 % (500 ms): flies in from scale 0.1, rotate 40°, x −50 px, opacity 0, to scale 1, rotate 0, opacity 0.85.
    - Holds until 75 % (1.5 s).
    - Fades out in the last 500 ms.
  - A new message replaces the old one.
  - It is used for Killed (`#f33`), Bunged (`#f66`), Double Kill (`#b7f`) and Triple Kill (`#d9f`).

### 3.6 Weather, sudden death and SS tint
- **Weather visuals** are covered in `gunbound-gameplay.md` §6: the tornado column, Thor satellite and beam, lightning column, force zone and mirror. [GB]
  - DragonBound draws lightning as a **64×1024 px tiled bolt, one of 4 variants, shown for 100 ms**.
  - Snow is **30–300 flakes of 17 px drifting with the wind** across the whole map.
- **Sudden death:** DragonBound tints the background **green** (`#00A000` on the background, stage `#006000`, and a `#060` overlay at 50 % in the DOM build) for the rest of the match. The item bar shows a "sudden death" banner. [DB] **UNCONFIRMED** whether Gunbound tints the background.

### 3.7 SS cut-in
- No evidence of a portrait cut-in in PC Gunbound. The SS drama comes from the **huge `sfire` pose, the darkened world (§1.5) and the 256 px explosion**. [DB] **UNCONFIRMED** for GunboundM.

### 3.8 Camera
- [GB, GameFAQs beginner guide https://gamefaqs.gamespot.com/pc/582632-gunbound/faqs/19598]
  - The view "centers on wherever the action is. It follows individual shots and centers on whoever's turn it is."
  - You look around by moving the mouse to the **screen edge**, with an Options setting for "Mouse Scroll Speed". **Right-click-drag** is faster.
  - Holding right-click keeps the camera still instead of following the shot (https://gamefaqs.gamespot.com/pc/582632-gunbound/faqs/31328).
  - Players right-drag the view to line up long shots against the screen width (https://gamefaqs.gamespot.com/pc/582632-gunbound/faqs/28494).
- [DB `Dragon2D.CameraUpdate`, `CShot.update`]
  - The camera **moves linearly at 1 px per ms (1000 px/s) on each axis** toward its target, clamped to the map bounds.
  - The older jQuery camera also animated at 1 ms per px, and snapped when the move was under 30 px.
  - **After a shot, the camera waits 400 ms (`CAMERA_FOLLOW_DELAY = 400`)**, so you see the shot leave the barrel, then chases the projectile.
  - At turn start it pans to the active player.
  - Dragging the map cancels auto-follow.
  - When several shots are queued, replays play at **4–8× fast-forward** (`FAST_FORWARD_SPEED`).
- **No zoom** in PC Gunbound. Players on the New Gunbound Steam forum asked for a zoom-out (https://steamcommunity.com/app/306060/discussions/0/2261313417695430646/). **UNCONFIRMED** for GunboundM.
- **Parallax:** one background image (DragonBound 1000×1000; classic maps 1200–1300 px) scrolls at `(bgW − 800) / (mapW − 800)`, which is **about 0.2–0.5× the camera speed**. The whole background is visible exactly across the camera range. Some maps also have an animated foreground. [DB]

---

## 4. Map size and camera range

### 4.1 Gunbound (real)
- **World x runs 0 to 1800 and y runs −20 to 1840** (`MIN_MAP_X = 0, MAX_MAP_X = 1800, MIN_MAP_Y = −20, MAX_MAP_Y = 1840`) in a GunBound aimbot that reads positions from game memory (https://github.com/SanjoSolutions/gunbound-aimbot, `main.py`). [GB]
  - The screen is 800×600, and the camera value is the **screen centre** (screen x = world x − camX + 400).
  - Source: https://github.com/agasready/Gunbound_aimbot, `bot_w8_v79.py`, for GunBound Classic.
  - **So a standard map is 1800 px wide = 2.25 screens.**
- Aiming guides divide one screen width into **8 "distance units"** (100 px each) [GB, agasready `PARTS_PER_SCREEN_WIDTH = 8`; Creedo formula guides]:
  - A "full screen" shot is about 800 px.
  - Common shots are "half to one screen away".
  - Some shots need the target "not more than 1.5 screens away".
  - Sources: https://gamefaqs.gamespot.com/pc/582632-gunbound/faqs/28494 and other guides in this folder's sources.
  - In practice, fights happen **0.5–1.5 screens apart on a map 2.25 screens wide**.

### 4.2 Per-map sizes (DragonBound recreations of the Gunbound maps) [DB `MAPS[...]` in `1.js`]
- `ground_size` is the square world (the camera range).
- `w×h` is the drawn terrain.
- `offset_y` is how far down the world the terrain starts; everything above it is sky.
- The "classic" theme swaps in the Gunbound art (`miramo_fg.jpg`, `nirvana_fg.jpg`, …) **on the same geometry**.

| Map (classic name) | Terrain w×h | World | Terrain in screens (w × h) | Sky above terrain |
|---|---|---|---|---|
| Miramo Town | 1766×456 | 1800 | 2.2 × 0.76 | 1344 px (2.2 screens) |
| Nirvana | 1600×310 | 1600 | 2.0 × 0.52 | 1067 |
| Metropolis | 1800×715 | 1800 | 2.25 × 1.2 | 1085 |
| Sea of Hero | 1600×629 | 1600 | 2.0 × 1.05 | 688 |
| Adium Root | 1800×372 | 1800 | 2.25 × 0.62 | 788 |
| Dragon | 2000×461 | 2000 | 2.5 × 0.77 | 1539 |
| Cozy Tower | 1649×396 | 1800 | 2.06 × 0.66 | 1384 |
| Dummy Slope | 1429×391 | 1600 | 1.8 × 0.65 | 1037 |
| Star Dust | 1345×425 | 1800 | 1.7 × 0.71 | 922 |
| Meta Mine | 1409×760 | 1800 | 1.76 × 1.27 | 1020 |
| Cave | 1545×697 | 1800 | 1.9 × 1.16 | 1103 |
| Prix/Secret | 1800×886 | 1800 | 2.25 × 1.5 | 914 |
| Miramo Town B | 1376×328 | 1800 | 1.7 × 0.55 | 1472 |
| Nirvana B | 814×836 | 1600 | 1.0 × 1.4 (a tower) | 741 |
| Metropolis B | 1298×499 | 1800 | 1.6 × 0.83 | 1040 |
| Sea of Hero B | 1518×329 | 1600 | 1.9 × 0.55 | 955 |
| Adium Root B | 1599×425 | 1800 | 2.0 × 0.71 | 1289 |
| Dragon B | 1800×721 | 1800 | 2.25 × 1.2 | 590 |
| Cozy Tower B | 1558×567 | 1800 | 1.95 × 0.95 | 1233 |
| Dummy Slope B | 1275×364 | 1800 | 1.6 × 0.6 | 1126 |
| Star Dust B | 1707×468 | 1800 | 2.1 × 0.78 | 1332 |
| Meta Mine B | 1800×904 | 1800 | 2.25 × 1.5 | 753 |
| Ice Cave (cave) | 2000×1334 | 2000 | 2.5 × 2.2 | 0 (roofed) |

Caveats:
- "Kingdom" and "Star" are not in DragonBound's list. "Star" is probably Star Dust (UNCONFIRMED).
- DragonBound-only maps range from 979×805 (Mario World) to 1759×1394 (Desert B).

Takeaways:
- **The world is 1600–2000 px wide (2–2.5 screens) and square.** The **terrain band is usually 0.5–1.2 screens tall**, with **1.5–2.5 screens of open sky above it** so high-angle shots stay in bounds.
- The camera can scroll the whole square. The bottom limit leaves room for the 84 px HUD (`GAME_UI_HEIGHT = 84`).
- The camera opens centred horizontally on the map. [DB `CameraInit` → `FocusAt(w/2, 0)`]
- **Horizontal scrolling is constant but short:** at most about 1.25 screens of travel either side of centre.

### 4.3 Spawn spacing
- **UNCONFIRMED:** no source gives Gunbound's spawn rule. DragonBound's server chooses positions; the client only sets facing (`look = x < mapW/2 ? RIGHT : LEFT`), so **everyone starts facing the map centre**.
- In the Softnyx 4v4 screenshots, **3–6 mobiles are visible on one 800 px screen at once**, often mixed across teams. That fits 8 players spread over 1800 px, about **200–250 px (a quarter screen) between neighbours**, with enemies typically **0.5–1.5 screens** apart.
- Score-mode respawns land where the dead player clicks after 4 turns. [GB StrategyWiki]

### 4.4 Minimap
- **UNCONFIRMED** that PC Gunbound had a minimap. None of the eight Softnyx in-game screenshots shows one: the top-right corner is an ad banner, and the bottom-left has the round wind dial with weather icons.
- An older FAQ mentions a "circular wind marker at the top of the screen" used as a half-screen distance guide (https://gamefaqs.gamespot.com/pc/582632-gunbound/faqs/28494), so early builds put the wind dial at top-centre.
- Players judge range by dragging the view instead.

### 4.5 Mobile size relative to the screen
- Idle frames [DB `EPA.*.normal`, same sizes as DragonBound's classic mobiles]:
  - Armor 36×40, JD 35×45, Boomer 38×37, Frog 39×40, Raon 40×41, Lightning 42×43, A.Sate 44×31, Mage 47×46, Turtle 50×48, Bigfoot 50×46, Nak 51×34, Ice 55×55, Kalsiddon 55×49, Trico 60×52, Knight 64×51, Aduka 67×61, Grub 70×55, Dragon 83×63.
  - The pilot avatar sits on top (anchor about +17 x, −28 y).
- In screenshots a mobile with its pilot is about **45–70 px wide and 55–80 px tall**. That is **about 1/12–1/16 of the screen width, 1/8–1/10 of its height, and about 1/30 of the map width**. [GB sn_03, sn_12, sn_15]
- The name, guild and HP bar sit under the mobile. The HP bar is about 76 px wide, a little wider than the mobile.

---

## 5. What made it feel alive (fan and screenshot evidence)

1. **Personality idles.** JD "Cake" and Lightning "Lovebot" earned nicknames from their idle loops, and Trico cries. Every mobile has about 18 states. [GB]
2. **The pilot is alive separately from the vehicle.** The avatar breathes in ping-pong at 10 fps and blinks or looks around at random every few cycles. [DB]
3. **Debris showers.** Dozens of map-themed chunks (rocks, ice, bolts) fly and fade on every blast; the screenshots are full of them. [GB, DB]
4. **Stacked hit feedback.** A mobile-specific explosion, a small screen shake, the front or back flinch with dizzy stars, bitmap damage numbers that add up, "CRITICAL!!", and "N Hit!!" tags with leader lines. [GB, DB]
5. **Big word-art callouts** ("SUPER SHOT!!" with flames, "UNBELIEVABLE!!!" with wings) that everyone watching sees, plus chat-log bonus lines that also cut delay. [GB]
6. **Emotes over the mobile** (`*` chat) and chat bubbles. [GB]
7. **SS drama:** the screen dims, the pose is oversized, and the 256 px explosion. [DB]
8. **Corpses and wrecks stay on the map** as shields and landmarks. The ghost spins while waiting to respawn. [GB, DB]
9. **The camera chases every shot** after a short beat, and players can grab the view with the right mouse button. [GB]
10. **Weather you can see:** tornado columns, the Thor satellite and its beam, lightning columns, snow drifting with the wind. [GB, DB]

---

## 6. Copy list for Thú Chiến (in priority order)

1. Twenty-frame idle at 20 fps (1 s loop), plus a separate pilot layer at 10 fps with a random blink every 0–6 cycles. If we paint single poses, a ±1–2 px bob, a squash of about 3 %, and a 120 ms blink every 2–5 s get close.
2. Swap to a weak idle at ≤ 30 % HP (slumped, smoking, or crying for the cute animals), and turn the HP bar red at the same point.
3. A 1.25 s hit reaction, facing-aware (front or back), with dizzy stars.
4. Damage numbers that rise 60 px over 0.6 s, hold until 2 s, fade out by 5 s, and add up for the same victim. Red for enemies, blue for allies, green "+" for heals.
5. A screen shake of ±2 px vertical, 3 × 120 ms, on every blast.
6. Debris of `holeW × holeH / 250` chunks, random angle, power 100–600, fading over 1.5 s, themed to the map.
7. Per-xe explosion sheets at 20 fps: about 128 px for normal shots, about 256 px for SS.
8. For SS, dim the background to about 30 % and the ground to 50 % while the SS flies, and restore 1 s after impact.
9. Centre callout: 60 px text that flies in over 0.5 s (from scale 0.1 and 40° rotation), holds 1 s and fades over 0.5 s. Use gold word art with wings for top tiers.
10. The TURN tag bobs 30 px and scales 1.0–1.2 on a 2 s ping-pong, and its fill counts down the turn timer.
11. The camera chases at 1000 px/s, waits 400 ms after firing before following, and pans to the active player at turn start.
12. Tilt the body to the slope, ease the facing flip over 0.4 s, and play a struggle animation when there is no move left.

---

## Sources

- DragonBound full client (de-obfuscated), `1.js` in https://github.com/RxFaX/Aimbot-DragonBound. Key symbols: `var EPA`, `MOBILES`, `EXPLODES`, `BULLET`, `MAPS`, `CLASSIC_MAPS`, `Dragon2D.CameraUpdate`, `CShot.update`, `DamageSprite`, `PlayerContainer.Update`, `PlayerInfo.Update`, `Player2.PlayAnim`, `Dragon2D.Shake`, `SSBackgroundFadeIn`, `SDBackgroundFadeIn`, `ShowBigMsg`, `MOBILE_FPS`, `ANIMATIONS_FPS`, `BULLET_ANIM_FPS`, `CAMERA_FOLLOW_DELAY`, `WALK_SPEED`
- DragonBound CSS (shake, BonusMsg, ghost, sudden-death overlay, Turn sprite): https://web.archive.org/web/20190108232412/https://dragonbound.net/static/css/DragonBound.min.css?10082
- Gunbound map bounds 0–1800 × −20–1840: https://github.com/SanjoSolutions/gunbound-aimbot (`main.py`)
- Gunbound 800×600 screen-centre camera and 8 units per screen: https://github.com/agasready/Gunbound_aimbot (`bot_w8_v79.py`)
- Softnyx official screenshots (archived): https://web.archive.org/web/20250816060427/http://gunbound.softnyx.net/Downloads/ScreenShots.aspx. Images `screenshot_03/04/06/10/12/14/15/18/19_b.jpg` via `https://web.archive.org/web/2025id_/http://img.softnyx.net/1/gb/Download/screenshot_NN_b.jpg`
- GameFAQs guides:
  - Camera: https://gamefaqs.gamespot.com/pc/582632-gunbound/faqs/19598
  - Glossary (Lovebot) and scroll options: https://gamefaqs.gamespot.com/pc/582632-gunbound/faqs/31328
  - Mobile visual descriptions (JD cake, Lightning heart, Ice debuff crumble): https://gamefaqs.gamespot.com/pc/582632-gunbound/faqs/25616
  - Screen-distance aiming: https://gamefaqs.gamespot.com/pc/582632-gunbound/faqs/28494
  - Trico crying: https://gamefaqs.gamespot.com/pc/582632-gunbound/faqs/31866
- StrategyWiki: https://strategywiki.org/wiki/Gunbound/Gameplay (corpses in Solo, Bunge bonus, Score respawn), https://strategywiki.org/wiki/Gunbound/Mobiles (corpses block shots)
- TV Tropes (idle-animation nicknames, Trico cries, power bar fills in 2–3 s): https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/Gunbound
- Gunbound `.img` editor thread (frames with x/y offsets): https://forum.ragezone.com/threads/gunbound-img-editor-with-source-code.1197013/
- Spriters Resource (only fan customs): https://www.spriters-resource.com/custom_edited/gunboundcustoms/
- New Gunbound Steam discussion (players wanting zoom-out): https://steamcommunity.com/app/306060/discussions/0/2261313417695430646/

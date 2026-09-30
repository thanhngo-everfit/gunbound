# Gunbound mobiles: aiming angles and shot trajectories

Covers GunBound Classic / Thor's Hammer (2002–2005) and World Champion (2006+) on PC, plus DragonBound (a web clone that copies Gunbound closely). Written 2026-09-30.

**About the sources.** StrategyWiki, GameFAQs, Neoseeker, dragonbound.net and namu.wiki block the fetch tool (403 or Cloudflare). No bot check was bypassed. GameFAQs and StrategyWiki were read in full through `web.archive.org/web/2020id_/…` using curl. dragonbound.us had no challenge and was read in full. Angle ranges come from four fan tables written in 2004–2006. They agree with each other almost everywhere, and the places where they differ are noted. Physics constants come from open-source aimbots: one reads real GunBound process memory, and one reads DragonBound's in-browser game data. Anything I could not confirm is marked **unconfirmed**. Anything I worked out myself rather than read is marked **inferred**.

Main sources (they are cited below by the short name in brackets):

- **[Vexez]** "Detail Mobile Informations" table by Vexez, on CreeDo's site: https://creedo.gbgl-hq.com/mobiles.htm. It gives total and true angle for every shot of 16 mobiles.
- **[GBDB]** Gunbound Mobile Database (Gunbound Canada, 2004–05): https://www.oocities.org/gunbound_canada/database.html. It gives angle, weight and damage per shot.
- **[NickBush]** Total and true angle widths per shot, credited to NickBush24, inside the FAQ by Anthropofobe: https://gamefaqs.gamespot.com/pc/582632-gunbound/faqs/31328
- **[Lee]** Mobile Guide v1.6 by Lee T. HaXXXor (2004): https://gamefaqs.gamespot.com/pc/582632-gunbound/faqs/25616. It gives angle width and projectile weight per shot.
- **[EverNoob]** Lightning Mobile Guide v2.00: https://gamefaqs.gamespot.com/pc/582632-gunbound/faqs/30567
- **[tolerance0]** Ice/Mammoth Strategy Guide: https://gamefaqs.gamespot.com/pc/582632-gunbound/faqs/31845
- **[exploder]** Nakmachine FAQ: https://gamefaqs.gamespot.com/pc/582632-gunbound/faqs/25277
- **[CreeDo-Armor]** Armor guide by CreeDo: https://www.oocities.org/gunbound_canada/armor.html
- **[CreeDo-Tricks]** "Fun GB tricks": https://creedo.gbgl-hq.com/gbfunstuff.php
- **[CreeDo-KalFrog]** "Basic J.Frog and Kalsiddon use": https://creedo.gbgl-hq.com/basic_frog_and_kal.php
- **[Wood]** Boomer/JD high-angle guide: https://creedo.gbgl-hq.com/angles.php
- **[NakDB]** Nak guide on Gunbound Canada: https://www.geocities.ws/gunbound_canada/nak.html
- **[DB-guide]** DragonBound mobiles guide: https://dragonbound.us/guide/mobiles (mirror of https://dragonbound.net/guide/mobiles)
- **[SW]** StrategyWiki Gunbound/Mobiles (WC era): https://strategywiki.org/wiki/Gunbound/Mobiles
- **[Softnyx]** Official mobile pages (archived), for example http://gunbound.softnyx.net/GameInfo/Mobileinfo/kalsiddon.html, …/jfrog.html and …/phoenix.html
- **[GB-mem]** SanjoSolutions/gunbound-aimbot, `main.py`, which reads GunBound process memory: https://github.com/SanjoSolutions/gunbound-aimbot
- **[GB-ocr]** agasready/Gunbound_aimbot, a GB Classic aimbot with an OCR template for every angle number the HUD can show, plus calibrated gravity and mass per mobile: https://github.com/agasready/Gunbound_aimbot
- **[DB-bot]** RxFaX/Aimbot-DragonBound, `script.js`, which holds DragonBound's gravity and wind factor per mobile: https://github.com/RxFaX/Aimbot-DragonBound
- **[DB-clone]** pasanzaza/Dragonbound, a DragonBound clone server, `Chanel.cs` `GameShoot`: https://github.com/pasanzaza/Dragonbound
- **[KR]** Korean wiki page on Gunbound: https://tcatmon.com/wiki/건바운드
- **[VN]** Vietnamese "fix 70" formula post: https://igunbound.blogspot.com/2017/12/cong-thuc-ban-tat-ca-cac-xe-gunbound.html

---

## 1. The general angle rule

### 1.1 The range is fixed to the mobile's body, and the body tilts with the ground

- Each mobile, and each of its three shots, has a fixed angle window **relative to its own body**, for example "Armor shot 1: 10°–55°". The mobile sits rotated to match the terrain under it, so the whole window rotates with the slope.
  - Evidence from game memory [GB-mem]: the client stores the aim angle and the cart (body) angle separately. The launch angle is `aim ± cartAngle`, with the sign set by facing: `a += cart` when facing left and `a -= cart` when facing right. The muzzle offset is also rotated by the cart angle. Nak's muzzle offset is rotated a further 180° because it fires from its rear.
  - DragonBound does the same [DB-bot]: the world launch angle is `player.ang + player.body * (look ? -1 : 1)`, and the muzzle point is rotated by `-body`. The clone server does `a = (look==0 ? 180-angle : angle) - body` [DB-clone].
  - Player guides say the same thing: move the mobile to push the pointer high or low enough for true angle [CreeDo-Armor]; Bigfoot's poor climbing makes it hard to find higher angles [DB-guide]; Mage has to go onto slopes to get a high angle [NakDB].
- **The HUD shows the world angle,** meaning the elevation above the horizon in the facing direction, with tilt already included. All fixed-angle formulas ("angle 60 at 2.4 bars reaches 1 screen", "angle 81 at full power reaches 1 screen") use this world number. A mobile whose relative window tops out at 55° can still fire "angle 70" by standing on an uphill slope.
  - The HUD number does not show which side you are facing. Firing "the wrong angle 89" (backwards) is a known mistake [Anthropofobe FAQ, game-screen legend item 15].
  - [GB-ocr] keeps a template image for every HUD angle value from **−34 to 90**. So the HUD can show negative angles, and 90 is the largest number it shows.

### 1.2 Can the angle go negative?

- **Yes, but only through tilt.** On flat ground no mobile's relative window goes below **10°** (see the table in section 3). A world angle at or below 0° happens when you face downhill: the body tilts nose-down and carries the window below the horizon.
  - Nak guide [NakDB]: players climb the wall on the far side of a pit to get a downward angle. For long Nak shot 2 shots, they look for a negative angle so the shell dives into the ground early.
  - Hitting the ground just in front of a mobile makes its angle point downward. This is used to take away an enemy's shot ("angle ruining") [NakDB].
  - Turtles standing on a down-slope can shotgun you, because the slope brings their high-set window down [NakDB].
  - Kalsiddon's close-range trick needs a positive (above 0) angle [CreeDo-KalFrog]. So angles at or below 0 are possible in play.

### 1.3 Shooting backwards and turning around

- **Every mobile can face either way at will.** Left/right walks and turns. Nak firing from its rear has no tactical effect, because any tank can face either direction [exploder].
- "Backwards" beyond the vertical: a tilted body can carry the window past 90°. Raon players climb down the front slope of a pit, turn around, and end up facing nearly straight up. They then fire at angle 89 "backwards", or at 90 when the wind helps [CreeDo-Tricks].
- Boomer's "backshot" is a wind trick, not an angle trick. You face away from the enemy at about angle 70 with half power, and a tailwind blows the boomerang back over your head onto the target [Anthropofobe FAQ, Boomer].
- The "butt shot" (Ice/Mammoth) is an input trick. You tap the opposite arrow at the moment you fire, so the avatar flips but the shot still leaves in the original direction. It gets Ice's low trunk shot out of holes [tolerance0].

### 1.4 What steep slopes do

- They tilt the window, as described in 1.1. Uphill gives higher angles and downhill gives lower or negative ones. Each mobile also has a climbing limit (the "Climbing" stat), so it may be unable to reach the slope it needs. Bigfoot, Lightning and Nak climb badly; JD and Dragon climb best [Lee, DB-guide].
- The muzzle can be jammed against terrain. Sometimes a mobile in a hole hits the wall with its own shot ("nose jam", noted for A.Sate [NakDB]). Ice's shot 2 and SS leave from the lower trunk, so they jam where shot 1 still clears [DB-guide, tolerance0].
- Players "lean on walls" to get high angles. Enemies answer by blowing the wall away, which tilts the mobile down. This fight over position is a core part of Gunbound play [NakDB, EverNoob §3.2.5].

### 1.5 True angle

Some shots have a darker **true angle** band inside their window. Shots fired inside it do full damage. The lighter **false/weak angle** at the edges does about **20% less** [CreeDo-Armor], or simply "reduced" damage [DB-guide]. Many shots are entirely true angle. In practice this pushes players toward the middle of the window. Mobiles with a narrow true band have to reposition more.

---

## 2. Trajectory and physics rules that apply to all mobiles

- **Everything that leaves the barrel is ballistic.** It feels gravity and wind. "Laser" in Gunbound is a **damage type** (strong against Bionic, weak against Shield), not a flight path [SW]. I found no Gunbound mobile whose projectile flies in a straight line from the barrel.
- **Straight lines in Gunbound come from a source in the sky, never from the barrel.** A ballistic "tracer" or "guide" lands, and then a beam or bolt strikes that spot from a fixed source: A.Sate's satellite, Knight's sword, Aduka's Thor, or Lightning's vertical and 45° bolts. The beam stops at the first land between its source and the target [DB-guide, Lee, EverNoob]. So the height difference between shooter and target does not matter for a straight line, because the shooter only has to lob the tracer.
- **Shots of one mobile share one arc.** Shot 1, Shot 2 and SS have the same weight and hit the same spot at the same angle and power. Players use Shot 1 as a cheap ranging shot, then switch to Shot 2 or SS [CreeDo-Armor on Armor; exploder on Nak; tolerance0 on Ice; the Artillery role in Lee]. DragonBound stores **one** gravity value and **one** wind factor per mobile, not per shot [DB-bot]. The exceptions (different muzzle, different weight, rotation) are listed per mobile.
- **Gravity and wind differ by mobile,** which the guides call "weight". Boomer is by far the most wind-sensitive. Lightning and J.Frog are light. Trico and Raon shot 1 are heaviest [Lee, GBDB, VN, DB-bot]. The table is in section 4.
- **Behaviour after landing** defines most shot identities: explode, burrow (Nak 2), roll or bounce (Grub 2/SS), walk (Raon SS, J.Frog), split at the top of the arc (Kalsiddon), open after airtime (Armor SS, Boomer SS, Turtle SS), or call a sky strike (A.Sate, Knight, Aduka, Lightning, Dragon SS).

---

## 3. Per mobile

The angle notation is **relative to the body, min–max, with the true band in brackets**. [Vexez] is the main source; others are listed where they differ. "S1 / S2 / SS" means Shot 1 / Shot 2 / Special Shot.

### Armor (Armor Mobile)
- **Angle:** S1 10–55 (true 25–40). S2 10–50 (true 25–40). SS 10–50, all true [Vexez]. [GBDB] gives S1 10–55, S2 15–50 and SS 10–55. [NickBush] gives widths of S1 45 (true 15), S2 35 (true 10) and SS 45 (all true). [Lee] gives widths 45/40/40.
- **Sweet spot:** the middle of the true band, 25–40. On flat ground, angle ~35 with 2.4 bars reaches 1 screen. From slopes, the classic formula is fixed 2.4 bars with angle 60 for 1 screen and 75 for ½ screen [CreeDo-Armor].
- **Flight:** S1 is one heavy shell, normal arc, big crater. S2 is a two-part shell on the same arc: the second warhead keeps going after the first explodes. SS flies as a shell and turns into a rocket after about 1.8–3 s of airtime. It needs that airtime for full damage and does not speed up [Lee, CreeDo-Armor, DB-guide].
- **Same arc for all shots:** yes. All three have the same weight [CreeDo-Armor].
- **Straight shots:** none.

### Mage
- **Angle:** 15–50, all true, for all three shots [Vexez, GBDB]. [NickBush] gives 35/35/35. [Lee] lists SS as width 30 (older version).
- **Flight:** S1 is one "laser" bolt, drawn long and narrow but flying a normal arc. S2 is two bolts winding round each other in a double helix; they never merge, so sometimes only one hits. SS is a big glowing ball with a large blast that strips shields [Lee, DB-guide].
- **Straight shots:** none. "Laser" here is the damage type only.

### Nak (NakMachine)
- **Angle:** 10–50 (true 15–45) for S1 and S2. SS 10–50, all true [Vexez]. [GBDB] and [NickBush] give 10–50 / width 40, all true.
- **Fires from its rear** [GB-mem, exploder].
- **Flight:** S1 is a normal heavy shell. **S2 flies the same arc as S1,** then on hitting ground it keeps its horizontal direction and curves upward underground, as if gravity were reversed. It explodes when it comes back out of the ground. A shallow entry gives a long underground run; a steep entry goes down and straight back up. **SS** flies the normal arc but **passes through all terrain** and explodes only on a mobile [exploder, Lee].
- **Sweet spot:** high angles for S2, so it enters steeply and pops up right under the enemy. A negative angle suits long ground runs [NakDB].
- **Wind:** about average for a heavy shell. DragonBound wind factor 0.875 [DB-bot].
- **Straight shots:** none. SS is "through-terrain", not straight.

### Trico
- **Angle:** S1 and S2 10–50 (true 20–40). SS 20–40, all true [Vexez, GBDB, NickBush].
- **Flight:** S1 is one heavy "cabbage" on a normal arc, the heaviest shot in the game [GBDB, VN]. S2 is a centre ball with two balls orbiting it. All three land on target only when the orbit phase lines up, which depends on airtime. **The spin looks different when firing left and right:** the balls leave in line with the aim when firing left, which suits melee, while firing right suits mid range [Anthropofobe FAQ, Trico]. SS is a fireball that sets off many small explosions at the feet [DB-guide].
- **Same arc:** S2's centre ball follows S1's arc. The Vietnamese guide gives fixed-70 powers for "Trico shot 1" only [VN].
- **Straight shots:** none.

### Bigfoot
- **Angle:** S1 and S2 18–40 (true 23–35). SS 23–35, all true [Vexez, GBDB, NickBush]. This is the smallest range in the game, and its climbing is poor as well [DB-guide].
- **Flight:** S1 is 4 missiles on an arc that fan out with distance. S2 is 6 small bombs that spread even wider. SS is 9 or 12 missiles fired like S1. At higher angles the spread gets worse [Lee, NakDB].
- **Weight:** S1 "average", S2 and SS "lighter than average" [Lee]; [GBDB] gives S1 and SS "average+", S2 "average". So **Bigfoot's shots may not share one arc** (**unconfirmed**; the fan tables are close to each other). DragonBound gravity is 90, the second heaviest [DB-bot].
- **Straight shots:** none. It is played as a close-range spread gun, so aim straight at the target from close.

### Boomer (BoomerLauncher)
- **Angle:** 10–90 (true 35–65) for all three shots [Vexez]. [GBDB] gives 10–90. [NickBush] gives width 80 with a true band of 30. This is the widest range in the game, and it can aim straight up from flat ground.
- **Flight:** a boomerang that is **extremely light and wind-driven.** Headwind makes it "hook" (dive down in front of you). Tailwind at a high angle with ≤2 bars makes it "backshot" (drift back behind you). Changing direction in mid-air gives a damage bonus. S2 is 4 boomerangs one after another on the same path. SS is 1 boomerang that turns gold after about 3 s and does much more damage [Lee, Anthropofobe FAQ].
- **Wind:** the most sensitive in the game. DragonBound wind factor **1.39** against about 0.6–0.9 for everyone else, and gravity 62.5, one of the lowest [DB-bot]. GB Classic calibrated mass is 90 against 110–170 for the others [GB-ocr].
- **Sweet spot:** backshots at about angle 70; ultra-high full-power shots at 81–89 [Wood, Anthropofobe FAQ].
- **Straight shots:** none.

### Raon (Raon Launcher)
- **Angle:** 10–50, all true, for all three shots [Vexez, GBDB, NickBush]. [Lee], an older version, gives S2 width 30 and SS width 20.
- **Flight:** S1 is 3 spinning discs (or a stream of small mines) on a heavy arc [DB-guide, Lee]. S2 is 2 baby Raons in a "hard to control arc". They wait where they land and crawl to an enemy on the next turn. Shot at angles near 0 or 90 they land close together [Anthropofobe FAQ]. SS is a big Raon that walks along the ground, turns back at walls too steep to climb, and blows up on contact or after 3–7 s [DB-guide, Lee].
- **Weight:** "heavier than average" [Lee]. Only shot 1 appears in the Vietnamese fixed-70 table, so shot 2 probably flies differently (**inferred**).
- **Straight shots:** none.

### Lightning
- **Angle:** S1 and S2 18–40 (true 23–35). SS 23–35 [Vexez, GBDB]. [NickBush] gives 22/22/22. **Changed by a later patch:** "32, all true, raised by about 10°" [EverNoob v2.00], which would make it about 18–50, all true (**inferred**).
- **Flight:** every shot is a **light tracer** that passes through mobiles and stops only on land. S1 calls **one vertical bolt** down onto the landing point. S2 calls **two bolts at about 45° from left and right** (a V shape; the left bolt strikes first, so it can make a y shape). SS is a bird-shaped shot with a huge radius; every enemy inside it is hit by its own vertical bolt [EverNoob, Lee, DB-guide]. Bolts are blocked by land above the target.
- **Wind:** very sensitive. It has the same weight as a teleport shot, and at long range 1 point of wind is enough to miss [EverNoob]. DragonBound wind factor 0.72, gravity 65 [DB-bot].
- **Sweet spot:** high angles or a headwind, so the tracer comes straight down and dual shots do not miss after the first one digs [EverNoob].
- **Straight shots:** yes, the bolts. They are straight lines from the sky at a fixed direction (vertical or ±45°), so the shooter's height does not matter. Only the lobbed tracer is aimed.

### J.D. (JD, "Cakebot")
- **Angle:** 10–40, all true [Vexez]. [GBDB] gives 15–45 (30). [NickBush] gives 30/30/30. It was narrowed in 2004 [Lee changelog].
- **Flight:** S1 is an electric ball on a normal arc with a wide splash. S2 is an electric ball that pulls mobiles into the landing point and digs under the target. SS is a pyramid that pushes mobiles out [Lee, DB-guide].
- **Weight:** light [Lee, GBDB]. DragonBound wind factor 0.625, the lowest, and gravity 63.5 [DB-bot]. Its high angles almost match Boomer's [Wood].
- **Straight shots:** none.

### A.Sate
- **Angle:** S1 and S2 20–60, all true. SS 25–55 [Vexez, GBDB]. [NickBush] gives 40/40/30.
- **Flight:** each shot is a ballistic **tracer**. After it lands, the **satellite floating above A.Sate** fires lasers in a **straight line from the satellite to the tracer point.** Any land or mobile in between takes the hit instead. S1 fires 1 laser. S2 raises the satellite higher and fires 3 lasers that converge on the tracer; convergence works best when the lasers come in at about 45° or 90° to the target. SS moves the satellite right above the landing point and fires 5–6 lasers straight down, sweeping from left to right and digging a deep, narrow hole [Lee, DB-guide].
- **Wind:** tracers and lasers are both bent by hurricanes (weather) [Lee]. DragonBound wind factor 0.765, gravity 75.5 [DB-bot].
- **Straight shots:** yes, the satellite lasers. The source is **high above A.Sate** (S1/S2) or **directly above the target** (SS), so the line reaches targets below by coming down from the sky, not by aiming the barrel low. The cost is that the shooter must check line of sight from the satellite to the target.

### Ice (Mammoth)
Ice is the mammoth mobile, called "Mammoth" in many guides [KR, tolerance0].
- **Angle:** S1 and S2 20–70 (true 30–60). SS 30–60, all true [Vexez, GBDB, tolerance0]. [NickBush] gives widths 50 (true 30) / 50 (true 30) / 30.
- **Flight:** S1 is an ice shell from the **cannon on the back**. S2 is an ice rock and SS a snowflake, both from the **trunk**, which is lower. So **S1 and S2 fly different paths but hit the same place** in open ground. Near walls and holes the low trunk shot jams [tolerance0, DB-guide, KR: "the only mobile whose shot 1 and 2 fire from different spots"]. [Lee] says the reverse (S2's firing point is higher), but the later sources agree it is the trunk.
- **Weight:** light [GBDB, tolerance0]. DragonBound wind factor 0.625, gravity 63.5 [DB-bot]. Its high angles match Boomer's [Wood].
- **Straight shots:** none.

### Turtle
- **Angle:** 25–50, all true, for all three shots [Vexez, GBDB, NickBush]. It is narrow and set high ("angle fixated upwards" [NakDB]).
- **Flight:** S1 is a water spurt that looks like a laser but flies a normal arc. S2 is two water streams crossing in a helix that **merge into one if they come down steeply enough** (about 3 s of airtime). SS is a water ball that splits into 6 balls after about 3 s [Lee, DB-guide]. At point blank, full power gives the "shotgun turtle".
- **Wind and delay:** average (DragonBound wind 0.75, gravity 74.5 [DB-bot]). It is the only mobile with 12 delay per second instead of 10 [Lee, DB-guide].
- **Straight shots:** none. The "laser-like" look is only visual.

### Grub
- **Angle:** S1 and S2 30–60 (true 35–55). SS 30–60, all true [Vexez]. [GBDB] gives 30–60 (30). [NickBush] gives 30 with a true band of 20.
- **Flight:** S1 is a weak ball on a normal arc. S2 is 4 balls that **bounce and roll** along the ground, bounce off the map edges, and explode after about 1.5–3 s or on touching a mobile. SS is a ball that rolls for about 3 s and damages anything it touches. Its timer starts only when it lands, so it can be lobbed high [Lee, DB-guide, CreeDo-Tricks].
- **Weight:** S2 is "heavier than average" [Lee]. DragonBound wind 0.69, gravity 63.5 [DB-bot].
- **Straight shots:** none.

### Aduka
- **Angle:** 10–50, all true, for all three shots [Vexez, GBDB, NickBush]. [Lee] gives SS width 30.
- **Fires from its rear,** like Nak [DB-guide].
- **Flight:** S1 is an electric ball on a normal arc. S2 is 3 mini-Aduka **tracers**; where they land, **Thor** (the big satellite high above the map) fires beams at them. Land or a mobile in between takes the hit. SS is a mini-Aduka that **passes through all terrain and mobiles**; each enemy it passes through gets a Thor beam [Lee, DB-guide].
- **Wind:** DragonBound wind 0.7, gravity 60.5 (the lowest) [DB-bot].
- **Straight shots:** yes, the Thor beams, which come from a fixed sky source.

### Kalsiddon (World Champion)
- **Angle:** **unconfirmed.** It has a "good angle range, sort of like Nak's old angle range" [CreeDo-KalFrog]. Nak's range is 10–50, so something like 10–50 is likely (**inferred**).
- **Flight:** a big shell on a normal arc that **splits at the top of its arc** into 2 (S1), 4 (S2) or 4 then 8 (SS) homing missiles. A small tracer keeps flying the original arc, and the missiles loop and then home in on where it lands. Low or short shots do not give them time, so they scatter. The big shell passes through mobiles until it splits [CreeDo-KalFrog, Softnyx, SW].
- **Sweet spot:** high angles (the official page says to fire at a high angle), or the trick of making the arc peak inside the enemy.
- **Wind:** DragonBound wind 0.74, gravity 65.5 [DB-bot]. The GB Classic calibration gives it a heavier feel [GB-ocr]. It is in the same fixed-70 weight class as Knight [VN].
- **Straight shots:** none.

### J.Frog (World Champion)
- **Angle:** **unconfirmed** (not found in any table).
- **Flight:** a very light jelly on a normal arc. It passes through mobiles. After landing it **walks or rolls** for about 3 s and then explodes. **S1 always walks screen-left and S2 always screen-right, whatever way you face.** The SS walks in the direction it was fired, damages anything it touches, and can circle a small floating island [CreeDo-KalFrog, Softnyx, DB-guide].
- **Wind:** very light, "lighter even than boomer's" but with a normal wind effect [CreeDo-KalFrog]. It is the lightest fixed-70 class together with Dragon [VN].
- **Straight shots:** none.

### Knight (hidden, from Random)
- **Angle:** 10–80, all true, for all three shots [Vexez, GBDB]. [Lee] gives width 70. It is the second-widest range and the widest true range [NakDB].
- **Flight:** each shot is a **tracer**. A **sword floating above Knight** then fires sword beams at the landing point: about 3 for S1 and about 5–6 falling straight down for S2 and SS. They work like a stronger A.Sate [Lee, DB-guide].
- **Wind:** DragonBound wind 0.695, gravity 65.5 [DB-bot].
- **Straight shots:** yes, the sword beams from the sky.

### Dragon (hidden, from Random)
- **Angle:** 30–60, all true, for all three shots [Vexez, GBDB, Lee].
- **Flight:** S1 is one light fireball. S2 is 4 fireballs in 2 streams that spread fast; they need very close range or a **low, near-0° shot**, and should not be fired at high angles [SW, Lee]. SS is a tracer; 5 mini-dragons appear in a half-circle around the landing point and fly into it [DB-guide, Lee]. Dragon hovers, so it ignores Grub S2, Nak S2 and J.Frog rolling shots, and takes only splash damage from Lightning [SW].
- **Wind:** light [Lee]. DragonBound gravity 95 (the highest; "Dragon2" is 120) and wind 0.74 [DB-bot], which looks inconsistent with "light", so treat it as **unconfirmed**.
- **Straight shots:** none. S2 aimed near 0° is the closest thing to direct fire.

### Phoenix (World Champion, Random / Power User)
- **Angle:** **unconfirmed.**
- **Flight:** it fires explosive **clones launched from its back**. Softnyx says it is "not affected by the shape of the ground" because the clones leave from the back, and that its "trajectory is easily manipulated by wind change" [Softnyx phoenix page]. Per-shot details were not found.
- **Straight shots:** unknown.

### Mammoth
In Gunbound this is **Ice** (see above). There is no separate Mammoth mobile [KR, tolerance0, GB Revolution wiki mobile list].

---

## 4. Summary table

Angles are relative to the body, as S1 / S2 / SS, with the true band in brackets. "All true" means the whole window is true angle.

| Mobile | Angle range (body-relative) | Shot types | Straight-line shots | Notes |
|---|---|---|---|---|
| Armor | 10–55 (25–40) / 10–50 (25–40) / 10–50 all true | arc shell; 2-stage shell; shell that becomes a rocket after airtime | none | all shots same weight; ~35 at 2.4 bars on flat ground; fixed 2.4 at angle 60/75 from slopes |
| Mage | 15–50 all true (all shots) | "laser" bolt on an arc; helix pair; big shield-strip ball | none (laser = damage type) | |
| Nak | 10–50 (15–45) / same / 10–50 all true | arc shell; **burrows and pops up**; **passes through terrain** | none | fires from rear; negative/high angles useful for S2 |
| Trico | 10–50 (20–40) / same / 20–40 | heavy arc; 3-ball orbit; multi-blast | none | orbit differs by facing; heaviest shot 1 |
| Bigfoot | 18–40 (23–35) / same / 23–35 | 4 / 6 / 9–12 spreading missiles | none | smallest range, poor climbing; S2/SS maybe lighter (unconfirmed) |
| Boomer | 10–90 (35–65) all shots | **boomerang, wind-curved** (hook, backshot); ×4; turns gold | none | wind factor ~1.4, about 2× other mobiles |
| Raon | 10–50 all true | disc/mine stream; 2 crawling mines; walking big Raon | none | S2 arc hard to control (inferred: different weight) |
| Lightning | 18–40 (23–35) / same / 23–35; later **~18–50 all true** (patch; inferred bounds) | light tracer that passes through mobiles | **yes: vertical bolt (S1), two 45° bolts (S2), bolt per enemy (SS)** from the sky | very wind-sensitive |
| J.D. | 10–40 all true ([GBDB]: 15–45) | electric ball; pulling ball; pushing pyramid | none | light, lowest wind factor (0.625) |
| A.Sate | 20–60 / 20–60 / 25–55, all true | tracer | **yes: satellite lasers from above the shooter (S1/S2) or above the target (SS)** | line of sight from the satellite needed |
| Ice (Mammoth) | 20–70 (30–60) / same / 30–60 | arc shell from back cannon; S2/SS from the **lower trunk** | none | S1 and S2 fly different paths to the same spot; trunk jams in holes |
| Turtle | 25–50 all true | water spurt; helix that merges at high angles; ball that splits after 3 s | none (laser-looking only) | 12 delay per second |
| Grub | 30–60 (35–55) / same / 30–60 | arc ball; 4 bouncing/rolling balls; rolling damage ball | none | S2 heavier |
| Aduka | 10–50 all true | arc ball; 3 tracers for Thor; through-terrain tracer | **yes: Thor beams from the sky satellite** | fires from rear |
| Kalsiddon | unconfirmed (probably ~10–50, inferred) | shell that splits at the peak into 2/4/8 homing missiles following a tracer | none | needs high angle and airtime |
| J.Frog | unconfirmed | light jelly that walks ~3 s (S1 walks left, S2 right, SS forward) | none | lightest class |
| Knight | 10–80 all true | tracer | **yes: sword beams from a sword above Knight / straight down** | widest true range |
| Dragon | 30–60 all true | fireball; 4 spreading fireballs; tracer + 5 mini-dragons | none | hovers |
| Phoenix | unconfirmed | clones fired from the back, strongly wind-affected | unconfirmed | |

### Wind and gravity per mobile

DragonBound values come from [DB-bot]. `a` is the downward acceleration and `b` is multiplied by the wind vector. There is one pair per mobile, not per shot.

| Mobile | gravity a | wind factor b |
|---|---|---|
| Aduka | 60.5 | 0.70 |
| Boomer | 62.5 | **1.39** |
| Ice | 63.5 | 0.625 |
| J.D. | 63.5 | 0.625 |
| Grub | 63.5 | 0.69 |
| Lightning | 65 | 0.72 |
| Knight | 65.5 | 0.695 |
| Kalsiddon | 65.5 | 0.74 |
| J.Frog | 65.5 | 0.74 |
| Mage | 71.5 | 0.78 |
| Turtle | 74.5 | 0.75 |
| Armor | 75 | 0.76 |
| A.Sate | 75.5 | 0.765 |
| Nak | 79.5 | 0.875 |
| Trico | 84 | 0.87 |
| Bigfoot | 90 | 0.74 |
| Dragon | 95 | 0.74 |

Raon is missing from the named table. The clone server's comment list gives it 0.827 (**unconfirmed**) [DB-clone].

GB Classic, as calibrated by an aimbot author as (gravity, mass) [GB-ocr]: Nak 0.93/110, Raon 0.81/129, Turtle 0.73/143, Armor 0.73/143, Mage 0.70/132, Kalsiddon 0.67/169, Lightning 0.64/145, Boomer 0.43/90, and about 0.61/168 for the rest. These are approximate, but the ordering agrees with DragonBound: Boomer is lightest and most wind-driven, and Nak, Trico and Raon are heaviest.

Weight classes by the power needed at a fixed angle of 70 for the same distance [VN], heaviest first:

1. Trico S1 and Raon S1 (3.2)
2. Turtle and Armor (3.0)
3. Kalsiddon and Knight (2.9)
4. Ice, JD, Boomer and Grub (2.7)
5. J.Frog and Dragon (2.55)

Is the wind effect the same for all shots of one mobile? Yes, with these exceptions:

- Ice: different muzzle.
- Trico S2: the orbit phase depends on airtime.
- Bigfoot, and possibly Boomer SS: listed as a different weight by [Lee] (**unconfirmed**).
- Raon S2 and Nak S2/SS: they share the arc but behave differently after landing.

---

## 5. DragonBound per-mobile angle and power tables

- The public DragonBound guide lists **no angle ranges**, only type, HP, delay and damage per shot [DB-guide]. The server sends each player's `minang`/`maxang` and a per-shot aim length at runtime, as fields `minang`, `maxang`, `aim_s1_ang`… in the client's player record [DB-bot `assets/DragonBound.js`], so the numbers are not in any static page I could reach. **Unconfirmed.** DragonBound is known to copy Gunbound's windows, but I could not verify that.
- DragonBound physics per mobile is in the table above (gravity and wind factor).
- DragonBound fixed-power formula: its power bar has a different scale. The Spanish guide says "Armor, power always 4.5 bars; angle 60 = 1 screen; angle 75 = ½ screen" (http://demosdemosdemos.blogspot.com/2013/05/moviles-de-dragonbound-caracteristicas.html), which is the Gunbound 2.4-bar rule rescaled.
- DragonBound bonuses: High Angle is angle ≥70 with ≥2 s of flight and ≥50 damage; Ultra High Angle needs ≥4 s [DB-guide "How to play"].

---

## 6. Design rules worth copying for Thú Chiến

1. **Store the angle relative to the body and let the body tilt with the ground.** The launch angle is `relAngle ± bodyTilt` depending on facing, and the muzzle point rotates with the body. Show the world angle on the HUD, including negative values. This single rule creates "go find a slope to get angle", "blow up the enemy's slope", and downward shots from a down-slope.
2. **Keep every mobile's minimum at or above ~10° on flat ground.** Only tilt produces horizontal or downward shots. Tops vary: most mobiles cap at 40–60 on flat ground, and only a few (Boomer 90, Knight 80, Ice 70) reach high angles without a slope.
3. **Give each shot its own window and an optional true-angle band** with about 20% less damage outside it. SS windows are often narrower than S1/S2.
4. **Every mobile can face either way.** Left/right turns it. Aim is mirrored, and the HUD number does not say which side.
5. **Barrel-fired projectiles are always ballistic.** Differences come from gravity and wind per mobile (Boomer about 2× wind) and from what happens after landing: burrow, roll, walk, split, open after airtime, pass through terrain.
6. **All shots of one mobile share one arc** so Shot 1 works as a ranging shot. When a shot needs a different feel, change its muzzle (Ice trunk) or its after-landing behaviour, not its gravity.
7. **Make straight lines usable by firing them from the sky, not the barrel.** Lob a ballistic tracer, then fire the beam from a fixed high source (a satellite above the shooter, a point straight above the target, or a fixed ±45° pair) to the tracer point. Terrain in between blocks the beam. Height difference between shooter and target stops mattering, so the straight shot works anywhere on the map. If a direct barrel beam is kept anyway, it must use rule 1 (tilt and negative world angles) and be short-range. Gunbound itself has no such weapon.

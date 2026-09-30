# Thú Chiến: UX and fun research (artillery games)

Research date: 2026-09-30. Sources: Gunbound (Softnyx official screenshots, StrategyWiki, GameFAQs, TV Tropes, Wikipedia), DragonBound (the browser Gunbound clone, whose guide numbers every UI element), GunBound Classic, ShellShock Live wiki, Worms wiki, Pocket Tanks, Gunny/DDTank (VN).
Several sites (StrategyWiki, DragonBound, MobyGames, supercheats) block direct fetches or show a Cloudflare check. Those were read through archive.org snapshots, and no bot check was bypassed.

**Already in Thú Chiến** (checked in the code, so not proposed again): the "?" random pick and all-random rooms (`server/room.js` xeMode), the GP rank ladder with dragons for the top of the leaderboard (`shared/ranks.js`), a rank-up badge on the results screen, the MVP card, a spectator label ("Khán giả"), chat bubbles, and gold bonuses.

---

## 0. Best screenshots to look at

All Softnyx images are official Gunbound screenshots, 800×600, archived. The originals were `img.softnyx.net/1/gb/Download/screenshot_NN_b.jpg`, and that host no longer answers, so use the archive links.
Gallery page: https://web.archive.org/web/20250816060427/http://gunbound.softnyx.net/Downloads/ScreenShots.aspx

| # | What it shows | URL |
|---|---|---|
| 1 | **Room (waiting) screen, 4v4.** Wide player cards with READY stamps, room info panel, READY and TEAM CHANGE buttons, Mobile/Item/Room buttons | https://web.archive.org/web/2025id_/http://img.softnyx.net/1/gb/Download/screenshot_02_b.jpg |
| 2 | **In-game HUD.** Turn list with delay, chat top-left, emote bubbles, item bar, before/now angle, power bar, My Team / Enemy Team score | https://web.archive.org/web/2025id_/http://img.softnyx.net/1/gb/Download/screenshot_03_b.jpg |
| 3 | **Result screen.** BLUE WIN / RED LOSE, MVP badge, columns K, D, GP, Gold and Event (bonus icons) | https://web.archive.org/web/2025id_/http://img.softnyx.net/1/gb/Download/screenshot_08_b.jpg |
| 4 | **Emotes.** "*I Love You :D" shown as hearts and a face icon over the mobile | https://web.archive.org/web/2025id_/http://img.softnyx.net/1/gb/Download/screenshot_13_b.jpg |
| 5 | **"SUPER SHOT!!" callout** plus a "[Mission 2]" line in chat | https://web.archive.org/web/2025id_/http://img.softnyx.net/1/gb/Download/screenshot_12_b.jpg |
| 6 | **"UNBELIEVABLE!!!" callout** plus bonus lines ("1000/2000/3000 Damage Achieved") | https://web.archive.org/web/2025id_/http://img.softnyx.net/1/gb/Download/screenshot_19_b.jpg |
| 7 | **Lobby.** Room list with mode tags (SCORE, TAG, JEWEL), a player card with GP bar and gold, rank icons in the user list | https://web.archive.org/web/2025id_/http://img.softnyx.net/1/gb/Download/screenshot_01_b.jpg |
| 8 | **Bonuses in chat** ("[Good Shot] −40 Delay", "[High Angle] −80 Delay"), a lightning column, "2 Hit!! 3 Hit!!" counters | https://web.archive.org/web/2025id_/http://img.softnyx.net/1/gb/Download/screenshot_06_b.jpg |
| 9 | **Jewel/score mode** ("[25 points received] +25score", My Team 30 / Enemy 81) | https://web.archive.org/web/2025id_/http://img.softnyx.net/1/gb/Download/screenshot_07_b.jpg |
| 10 | **Inventory/avatar screen.** Tabs, item cards, avatar preview with stat bars, gold and cash | https://web.archive.org/web/2025id_/http://img.softnyx.net/1/gb/Download/screenshot_20_b.jpg |
| 11 | **Older room screen** (classic banner slots, 4 per side, weather toggles at the top, "Cave(Random)" map, room rules box, item slots, buddy list) | https://live.staticflickr.com/3544/3482047270_4ce8d62174_b.jpg (page: https://www.flickr.com/photos/mmohut/3482047270) |
| 12 | **DragonBound lobby with numbered callouts** (22 elements explained) | https://dragonbound.net/static/images/guide/lobby_en.jpg (explained at https://dragonbound.net/guide/lobby) |
| 13 | **DragonBound room with the `/dice` mini-game** (dice in speech bubbles, GP/gold reward preview "Team A 1 GP 100G") | https://dragonbound.net/static/images/guide/dice_en.jpg (https://dragonbound.net/guide/commands) |
| 14 | DragonBound room, game HUD and shop with numbered callouts | https://dragonbound.net/static/images/guide/room_desc_en.jpg, …/game2_en.jpg, …/shop1.jpg (pages /guide/room, /guide/game, /guide/shop) |
| 15 | Gunbound mobile roster, item list and "moondisk" weather icons | https://cdn.wikimg.net/en/strategywiki/images/9/97/Gunbound_mobiles.png, https://cdn.wikimg.net/en/strategywiki/images/thumb/0/09/Gunbound_items.png/300px-Gunbound_items.png, https://cdn.wikimg.net/en/strategywiki/images/8/81/Gunbound_moondisk.png |
| 16 | Gunbound rank icons (animated GIFs) | https://gunboundclassic.net/assets/img/ranks/level_19.gif … level_-5.gif (19 is Chick, the pattern is from https://gunboundclassic.net/pages/howto.php?sec=levels) |
| 17 | DragonBound rank table with the reward for each rank | https://dragonbound.net/static/images/guide/ranks_rewards_en.webp (https://dragonbound.net/guide/ranks) |
| 18 | ShellShock Live team match | https://upload.wikimedia.org/wikipedia/en/d/d1/Shellshock_live_2019_screenshot.jpg |

The dragonbound.net pages sit behind a Cloudflare check. If one does not open, prefix it with `https://web.archive.org/web/2025id_/`.

---

## 1. Screen and UX layouts

### 1.1 Lobby
Gunbound (Softnyx #1) and the DragonBound guide list the same elements:
- **Top bar of room filters and actions:** Waiting (show only waiting rooms), Quick Play (join a random waiting room), Create, Mode filter (SOLO/SCORE/TAG/JEWEL), Friends (rooms your buddies are in), and Room Number (jump to room # with a password).
- **Room list in the main area, 2 columns × 3–4 rows, paged with ◀ 2 ▶.** Each row shows the room number, a play button, the title, the player count "4/4", and a coloured **mode tag**. DragonBound also shows a big **Waiting/Playing** word, a small map thumbnail, a padlock for private rooms and "(Random)" when the map is random.
- **Right column:** a *preview/character card* with the avatar, **Title** (earned title), Name, **GP with a % bar**, Point, cash and gold, and a big coin "RECHARGE" button. Below it sits the **user list** with a rank icon before each name and All / Friends / Guild tabs, plus a **channel selector** (CH 1–8).
- **Bottom:** lobby chat with system announcements in orange (events, "this week's winner is …", "+10% GP this weekend"), then a menu bar with Shop, Avatar, Gift and Options buttons.
- The beginner guide (GameFAQs) notes that the top of the lobby shows your own rank, name, GP and gold, that F10 opens the buddy list anywhere, and that double-clicking a name opens a private chat.

**Ideas for us:** a "Chơi nhanh" (quick join) button; a **Waiting/Playing** pill; a "friends are here" marker on room cards; **orange system announcements** in lobby chat (e.g. "Tuần này: Rồng Lửa x2 GP", "🏆 Thanh vừa lên Rìu Vàng"); an earned **title** on the player card.

### 1.2 Room (waiting) screen
Two versions are shown (Flickr, older; Softnyx #2, newer):
- **Top:** the room number and title (editable by the host). There is a map preview with its name, "Cave(Random)", and above it a row of **weather icons that the room allows** (click to toggle).
- **Room rules box:** Game Mode, Teams (4 VS 4), Map, *Slot Machine Item* (BASIC), *Sudden Death Type* (DOUBLE), *Sudden Death Turns* (40), and a **Room Options (F2)** button for the host.
- **Slots:**
  - *Older version:* 4 arrow-shaped banners per side (red on the left, blue on the right). Each shows the avatar riding its mobile, a flag, rank icon and name, the ping ("250ms"), and a stamp: **Master** for the host, **Ready** for others.
  - *Newer version:* 8 big cards in 2 rows (blue team on top, red below). Each card shows the rank icon, name, **[wins/losses]**, a **painted background of the chosen mobile**, "READY" stamped in green, and a guild name or pet under the card.
- **Centre:** a large **READY (F5)** button (START for the host), **Team Change (F4)**, **Mobile Select (F3)**, **Item Select (F7)**. There are also chat, whisper and ignore icons.
- **Right panel:** your mobile's stat bars and item slots (Item1/Item2 tabs, 6 slots, some items take 2 slots), plus a Buddy List tab.
- **DragonBound adds:**
  - an **Eye** toggle so outsiders can watch;
  - a **Microphone** toggle so watchers can chat;
  - a **Reward preview** ("Team A 1 GP 100G" and a "100%" multiplier);
  - **Random Teams** (mixes A and B at start) and a max-wind setting (0/12/26/50);
  - `/dice` and `/rps` mini-games whose result appears as a **die in the player's speech bubble**.
- Players spam "rdy" when someone forgets to ready. A visible "who is not ready" nudge helps.

### 1.3 Mobile select and the "Random" option
- In Gunbound you open Mobile Select from the room (F3), a grid of mobile portraits. **Random is a "?" tile in the lower-right corner of the grid.** With Random, the mobile is rolled when the battle starts, so neither your team nor the enemy knows it in the room.
- **Secret mobiles:** Dragon and Knight (and Phoenix in some versions) cannot be picked directly. They only come from Random, at roughly 1 in 30 according to one player's GameFAQs estimate. This is the main reason people pick "?": a small lottery with a big payoff and bragging rights.
- DragonBound's **Same mode** puts everyone on the host's mobile, and TV Tropes notes that "Aduka-only" rooms were a popular community style. Tag mode lets you pick a primary and a secondary mobile.
- Sources: https://strategywiki.org/wiki/Gunbound/Mobiles (archived), https://gamefaqs.gamespot.com/pc/582632-gunbound/faqs/26935 (archived), https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/Gunbound (archived)
- **Idea:** when "?" rolls, show a **slot-machine spin of the portraits on the loading card** before it lands. Consider one or two **"secret" variants** that only Random can give (e.g. a golden Rồng Lửa skin or a special xe), at ~1/30.

### 1.4 Loading screen
We already match Gunbound here: a card per slot, a rules panel and a minimap strip. Possible additions: a per-card load % or "✔" as each client finishes, a rotating tip line, and the random-xe reveal above.

### 1.5 In-game HUD
Checked on Softnyx screenshots 3–19 and the DragonBound /guide/game numbered list:
- **Top-left:** a chat log of about 6–8 lines. Bonus lines have an icon ("[Good Shot] −40 Delay", "[2000 Damage Achieved]"), mission lines are orange ("[Mission 2] Take 'Good Shot Bonus' in this game"), and system lines such as "Screenshot saved".
- **Top-right:** an ad or event banner in the real game, and the weather strip.
- **Left-middle, the "Turn List":** index 0–7, country flag, rank icon, name (the current player highlighted in green, your own row in orange), **ping in colour** (green, yellow, red), and the delay number. **Icons to the right of each row show what that player used last turn** (SS, ×2 dual, 40/100 items). You can read the enemy's plan at a glance.
- **Above each mobile:** HP bar, guild/title line, name, an orange **"TURN" tag** over the active player, and a translucent aim disc.
- **Big centre callouts:** "SUPER SHOT!!", "UNBELIEVABLE!!!", "CRITICAL!!", and an **"N Hit!!" combo counter** with big damage digits.
- **Bottom bar, left to right:**
  - a round **wind/angle dial** with "?" and weather sub-icons;
  - **1 / 2 / SS** buttons;
  - **before / now angle** boxes ("before 36 / now 70");
  - a **Drag/Slice** toggle (mouse-drag or space-bar firing);
  - the item bar (6 slots with counts, a scroll arrow and **Item1/Item2 tabs**);
  - the long power bar (orange fill, green last-shot marker on top, blue move bar below);
  - on the far right, **My Team / Enemy Team counters** (lives in score mode, points in jewel mode), **PASS** and **OPTION** buttons.
- In **Tag mode** a "Tag (F1)" button with the second mobile's portrait replaces the team counters.
- **Emotes:** chat lines that start with `*` (e.g. `*VNS!` = very nice shot, `*HI`, `*Thx`, `*Bye~`, `*Help~`, `*I Love You :D`) also play an **animated emote over the sender's mobile** (hearts, smiley or crying face, "NO" sign). Seen in screenshots 3, 9, 12, 13 and 19.

### 1.6 Result screen (Softnyx #8)
- A modal over the battlefield with a blue header "RESULT". The top block reads **"BLUE WIN"** in big outlined letters, the bottom block **"RED LOSE"** in grey.
- Next to the winners sits an **MVP pill** with medal and name.
- Each team has a table: Nick (flag and rank) | **K** | **D** | **GP** | **GOLD** | **Event** (round "P" icons = bonuses or events earned, e.g. Power User). The totals row is marked with a green "!".
- The DragonBound end screen shows the GP and gold earned and the winning and losing teams.
- **Idea:** keep our MVP card, and add an **Event column with fun award badges** (see §3) and **+GP / rank progress bars** that fill for each player.

### 1.7 Avatar shop / inventory (Softnyx #20, DragonBound /guide/shop)
- **Left:** a grid of item cards (name, picture, 8 small stat icons, a gold or cash coin, level). Tabs by slot (Head, Body, Glasses, Flag, Background, Foreground, Ex-item, Pet) plus Search and Sort.
- **Right:** "My Avatar" preview with stat bars, a title and name field, GP %, currency, and **Shop / Reset / Train Pet** buttons, then a **Locker** list below.
- Items can be bought for 1 week, 1 month or permanently, and can be **gifted** (from Diamond Wand rank in DragonBound).
- Each DragonBound rank-up gives a free avatar piece as a reward (ranks_rewards_en.webp).
- **Idea for us (no money):** spend career gold on **cosmetics only**: pilot hats and flags, a **tombstone** style, a **victory pose**, a **chat-bubble frame**, or **name colour**. Unlock one cosmetic at each rank-up, as DragonBound does.

---

## 2. Reducing boredom while waiting (large 5v5 matches)

| Idea | Seen in | Notes / cost |
|---|---|---|
| **Slot machine for dead players** | Gunbound Solo/Tag. After death, a 3-reel slot appears. It can give gold, change the wind, or drop random items or bombs (dynamite, hammers, lightning) from the sky, or give teammates items. The room option "Slot Machine Item: BASIC" sets the pool. | This is Gunbound's main answer to "I died on turn 3, now what". Medium cost: one spin every N turns, resolved as a server event. |
| **Animated emotes from `*` chat** and a hotkey emote wheel | Gunbound; Worms W.M.D (speechbanks, victory dances, gravestones); Worms Rumble emote packs | Cheap: 10–12 icons over the xe for about 2 s. The main banter channel in an office. |
| **Turn list with "what they used" icons, relative delay, ping** | Gunbound HUD | Cheap. Waiting players read the list to predict turns ("he used Dual, I go twice"). |
| **"Your turn soon" alert** (2 turns away: chime + tab title "⚠ Sắp tới lượt bạn!") | Implied by the Gunbound turn list; common practice | Cheap. In an office people alt-tab to Slack while waiting. |
| **Missions for each match** ("[Nhiệm vụ] Đạt Thưởng góc cao trong trận này") | Gunbound "[Mission 2]" line | Cheap. Gives waiting players a personal goal. |
| **Spectator eye and spectator chat** | DragonBound room Eye and Microphone | Coworkers who could not get a slot can still watch and heckle. Partly done ("Khán giả"). |
| **Team-simultaneous shots** (the whole team fires at once, or everyone does) | ShellShock Live "Shot Type: Single / Team / All" | Biggest cut in waiting time for 5v5, but it changes our delay system. Medium-high cost; could be a room option for a "chaos mode". |
| **Respawn instead of elimination** | Gunbound Score mode (respawn after 4 turns; you **click the map to choose your drop point**, and everyone sees a marker with a countdown) | Keeps everyone playing. Medium cost. |
| **Room mini-games** `/dice`, `/rps` | DragonBound | Cheap, fun while waiting for the host. |
| **Big callouts and combo counters** ("SUPER SHOT!!", "UNBELIEVABLE!!!", "3 Hit!!") | Gunbound | Cheap. Makes spectating fun because everyone reacts to the same moment. |
| **Predictions / betting** (vote who dies next or which team wins; gold payout) | Not seen in these games; a general party-game pattern | Cheap to medium. Optional. |

---

## 3. Social and party features for office groups

- **Emotes and quick chat:** Gunbound's `*` emotes plus a quick-chat list. Suggested Vietnamese set:
  - `*Đỉnh!` (VNS), `*Hú hồn`, `*Xin lỗi` (for hitting a teammate), `*Cứu!`, `*GG`, `*Cười`, `*Khóc`, `*Tim`, `*Lêu lêu`, `*Chạy đi!`
  - Show an icon over the xe. Hotkeys F5–F9, or a radial menu on T.
- **Funny awards on the results screen.** Gunbound already pays event bonuses (Shot of God = 2+ kills in one shot, Bunge Shot, Boomer/Back Shot, Ultra High Angle with 4 s hang time, 1000/2000/3000 damage achieved, team-kill penalty). Turn these into named awards:
  - "Thần Góc Cao": highest-angle hit.
  - "Tay Tàn": most damage to allies.
  - "Bơi Lội": fell into water.
  - "Bắn Trượt Vương": most misses.
  - "Một Phát Hai Mạng": double kill.
  - "Bất Tử": lowest damage taken.
  - "Phản Đòn": damage from a back shot.
  - "Thần May Mắn": won with Random xe.
- **Rank-up and announcements:** DragonBound and Gunbound broadcast events in the lobby. "🏆 X vừa lên Rìu Vàng" in the lobby is cheap and very social.
- **Random Teams / auto-balance:** a DragonBound room option. For offices, **balance by GP** (snake draft: highest to team A, next two to B, …) so the same good players don't always stack.
- **Same-xe night** ("Chỉ Tề Thiên"): DragonBound Same mode and Gunbound Aduka-only rooms. Cheap.
- **Tournaments and seasons:** DragonBound runs a Tournament server on fixed days (Wed/Sun "Prix") with set mobiles and a standings table. Gunbound resets top ranks daily by percentile. GunboundM advertises seasons with rewards. For us: a **monthly season leaderboard** (reset the season GP but keep career GP), and a **Friday Prix** room preset (fixed map and xe rules, results posted to the lobby).
- **Replays and highlights:** not found in the classic games. Our shots are deterministic replays (frames already exist), so we could **save the top 3 shots of a match** (most damage, longest, highest angle) and play them on the results screen as "Pha bắn hay nhất". Medium cost.
- **Worms personality:** speechbanks (voice lines on own goals and big hits), gravestones and victory dances. We could add cheap synthesized "voice" squeaks, or a Vietnamese text quip over the xe when it self-damages or falls.
- **Gifting:** DragonBound lets you gift avatars. For coworkers, "tặng 100 G cho đồng đội" after a match is a small warm touch.

---

## 4. Rank and progression presentation

- **Rank icon everywhere before the name:** lobby user list, room slots, the in-game turn list and the name tag above the mobile, and results rows (Softnyx #1, #2, #3, #8; the Flickr room shows the icon in the name bar).
- The Gunbound ladder runs Chick → Wood Hammer → Stone Hammer → Axes (metal, silver, gold, single and double) → Wands and holes (percentile) → Dragons (Silver Dragon top 1, Red top 2–5, Blue top 6–21). Ranks are recomputed daily. GP gives the ranks up to about Double Metal Axe, and after that the rank depends on your percentile. The icons are **animated GIFs**: the wands glow and the dragons shimmer.
  - Sources: https://gunboundclassic.net/pages/howto.php?sec=levels and https://dragonbound.net/guide/ranks (archived)
- **GP display:** the lobby card shows GP with a **% progress bar**. The newer room cards show **[wins/losses]** next to the name, and the results table shows GP gained for each player.
- **Rank-up rewards:** each DragonBound rank-up gives an avatar piece; GunboundM gives gems, gold and tickets the first time you reach a rank.
- **Gating by rank:** DragonBound unlocks room options by rank (Random Teams from Silver Axe, turn time from Gold Battle Axe, …) and Score/Same modes after beating Boss mode. That is a light "earned feature" motivation; use it sparingly in an office.
- **Ideas:**
  - animate our top ranks (a CSS shimmer on the dragon badges);
  - show **[W/L]** on room cards;
  - add a GP % bar to the player card and results rows;
  - give a free cosmetic at each rank-up;
  - post a lobby broadcast on rank-up;
  - show a small **"+12 GP" floating over each results row**.

---

## 5. Well-known fun modes, with rough cost for us

| Mode | Where | Rules | Cost for us |
|---|---|---|---|
| **Score** | Gunbound | Team lives = players + 1; the dead respawn after 4 turns at a map point they click; lose at 0 lives or when no one is alive | **Medium.** Reuses the Phượng revive; needs a drop-point UI and a lives counter in the HUD |
| **Jewel** | Gunbound | Players take no damage. "Jewels" (raons) drop from the sky worth 5/10/25/−5 (the −5 turns into +5 after a few turns) and need 100/200/300 damage **in one turn**. First to 100 wins. Falling still kills (2-turn free respawn) | **Medium.** Reuses the practice dummies as targets. Great for non-gamers because nobody dies |
| **Tag** | Gunbound | Two xe (second at 50% HP), swap once per turn; losing either one knocks you out | Medium (two sprites per player, HP per xe) |
| **Same xe** | DragonBound Same; Gunbound "Aduka-only" rooms | Everyone uses the host's xe | **Cheap** (one room setting) |
| **All random / secret xe** | Gunbound Random with secret Dragon/Knight | Roll at start; ~1/30 chance of a secret xe | All-random is done. A secret xe or skin is cheap in code but needs art |
| **Powerball** | Gunbound | Items off; each turn a ball drops (Dual, Thunder, Force, Gold, Bomb); roll near it to pick it up; balls can fuse | Medium |
| **Sudden death types** | Gunbound room: Type = DOUBLE / BIG BOMB / SS (from the room screenshot; exact effects from memory); Worms: water rises, everyone to 1 HP, nuke poison, random Armageddon between turns | **Cheap.** We have ×2 damage. Add "Nước dâng" (water rises), "Bom To" (bigger blasts) and "Ai cũng có SS" |
| **Marksman** | ShellShock Live | Each turn a random target appears; miss and you are out; the target shrinks | **Cheap to medium.** A good warm-up or party mode |
| **Rebound / Vortex** | ShellShock Live | Only shots that touch bumpers or go through portals deal damage | Medium |
| **Juggernaut** | ShellShock Live | One player has huge HP versus everyone else | **Cheap** (HP override; 1 vs 4–9). Great for "the boss vs the team" |
| **Assassin** | ShellShock Live | Each player has one secret target and can only damage that target | Medium |
| **Points** | ShellShock Live | Most damage dealt after N turns wins; self-damage subtracts | **Cheap** (a turn limit plus a score). Keeps short lunch games bounded |
| **One Weapon / Level Field** | ShellShock Live mods | Start with one random weapon and get one per turn / everyone equalised | Cheap variant: "random shot each turn" (Shot 1/2/SS picked for you) |
| **Weapon draft** | Pocket Tanks | 20 random weapons; players take turns picking until 10 each; each fired once | Medium. Could be an "item draft" at match start |
| **Low gravity / fast walk** | Worms utilities | Global physics tweak | **Cheap in physics.js**, but it breaks the "same curve" muscle memory, so only as a labelled fun room |
| **Hysteria / tiny turn time** | Worms "Hysteria" (1 s turns) | Very short turns | **Cheap** (add a 5–8 s turn option as "Siêu tốc") |
| **Crate shower / random drops** | Worms crates | Random crates with random weapons fall mid-match | Medium (overlaps with Powerball) |
| **Boss (PvE)** | DragonBound Boss mode; Gunny (bosses like "Gà Vương") | Team versus scripted bot bosses of rising difficulty | Medium-high. The NPC bots exist, so a "Boss" is a bot with a big HP pool and a special pattern |
| **Big head / chaos visuals** | General party-game trope (not seen in the artillery sources) | Visual only | Cheap, low value |

Gunbound items that make good future items or powerballs (StrategyWiki Gameplay page):
- **Blood:** −8% own HP for +33% damage, no delay.
- **Change Wind:** reverses the wind.
- **Team Teleport:** swap with your lowest-HP ally.
- **Bunge Shot:** +25% land destruction.
- **Thunder:** a lightning strike at the landing point.

TV Tropes also mentions an "interface screw" item that makes the victim's power bar charge very fast. It is hilarious in an office, but use it carefully.

---

## 6. Other notes

- **Gunny/DDTank** (VNG, Vietnam, 2009) is the version most Vietnamese coworkers know. Its chibi style, PvE bosses ("bắn gà" is the popular nickname), weddings and guilds were the social hooks. Sources: https://vi.wikipedia.org/wiki/Gunny, https://vi.ldplayer.net/blog/615.html. Details of its quick-chat and room UI could not be verified online, so none are claimed here.
- **Gunbound bonuses cut delay as well as paying gold** ("[Good Shot] −40 Delay", "[Excellent Shot] −100 Delay" in the screenshots). A good shot lets you act sooner, which is a neat reward loop we do not have yet. Cheap: subtract delay on our existing bonuses.
- **Leaving:** in Gunbound, leaving mid-game gives each teammate 100 gold. It is a small gesture that softens rage-quits.
- **Trico cries when it dies** in Gunbound. Per-xe death emotes give each xe personality cheaply.
- Wild Ones (Playdom, 2009–2013): pets with weapons and accessories, live multiplayer and a practice mode (https://en.wikipedia.org/wiki/Wild_Ones_(video_game)). Its fandom wiki was blocked, so no details beyond that.
- Tank Stars: vs Computer, Online PvP, **Tournament** and **same-device 2-player** modes.
- No reliable sources were found for "Boom Boom Tank", "Gunbound Legend" or Angry Birds-style artillery (Gunny's 2012 slingshot weapon was compared to Angry Birds).

---

## 7. Ranked recommendations (value ÷ cost, for a coworker group)

1. **`*` emotes and quick-chat wheel.** Cheap. The biggest banter multiplier, and Gunbound's signature social feature.
2. **Slot machine for dead players.** Medium. Fixes "dead on turn 3 of a 5v5, nothing to do".
3. **Funny awards and an Event column on the results screen.** Cheap. Built from stats we already track; creates office stories.
4. **"Your turn soon" chime plus a tab-title flash, and a turn list with last-used icons and relative delay.** Cheap. People alt-tab at work, and the list makes waiting strategic.
5. **Big callouts and combo counter** ("SIÊU PHẨM!!", "KHÔNG THỂ TIN NỔI!!!", "3 Trúng!!"), and good-shot bonuses that cut delay. Cheap. Everyone watching reacts to the same moment.
6. **Score mode** (team lives, respawn after 4 turns at a clicked drop point). Medium. Everyone stays in the match.
7. **GP-balanced Random Teams button, plus `/dice` and `/rps` in the room.** Cheap. Fair teams, no arguments, fun while waiting.
8. **Same-xe rooms and a secret random-only variant (~1/30).** Cheap (art for the secret). Makes "?" exciting, and theme nights are easy.
9. **Jewel mode.** Medium. Nobody dies, so it is a friendly on-ramp for non-gamer colleagues.
10. **Missions for each match, plus lobby broadcasts for rank-ups, awards and a Friday Prix.** Cheap. Personal goals and a shared lobby feed build a habit.

Honourable mentions:
- Juggernaut ("Sếp vs cả phòng") and Marksman: both cheap.
- Extra sudden-death types (water rises, big bomb): cheap.
- Top-3 shot replays on the results screen: medium.
- A monthly season leaderboard: cheap.
- Team-simultaneous shots (ShellShock Live): a big cut in waiting time, but it changes the core rules.

---

## Sources

- Softnyx Gunbound official screenshots (archived): https://web.archive.org/web/20250816060427/http://gunbound.softnyx.net/Downloads/ScreenShots.aspx
- StrategyWiki, GunBound Classic game modes: https://strategywiki.org/wiki/GunBound_Classic/Game_Modes (read via archive.org)
- StrategyWiki, Gunbound gameplay (modes, delay, items, moondisk, bonuses): https://strategywiki.org/wiki/Gunbound/Gameplay (archive)
- StrategyWiki, Gunbound mobiles (Random "?" and secret mobiles): https://strategywiki.org/wiki/Gunbound/Mobiles (archive)
- GameFAQs beginner guide by _KuraiChan_ (slot machine, ~1/30 secret odds, lobby buttons, ready etiquette): https://gamefaqs.gamespot.com/pc/582632-gunbound/faqs/26935 (archive)
- TV Tropes, Gunbound (Aduka-only rooms, roulette, interface-screw item, Trico cries): https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/Gunbound (archive)
- Wikipedia, Gunbound (modes, Powerball, avatars): https://en.wikipedia.org/wiki/Gunbound
- GunBound Classic level and award table: https://gunboundclassic.net/pages/howto.php?sec=levels
- DragonBound guide: lobby, room, game, shop, commands, ranks: https://dragonbound.net/guide/lobby, /guide/room, /guide/game, /guide/shop, /guide/commands, /guide/ranks (read via archive.org because of a Cloudflare check)
- Flickr, Gunbound room screen (MMOHut): https://www.flickr.com/photos/mmohut/3482047270
- ShellShock Live modes and room variations (Shot Type Single/Team/All, Marksman, Juggernaut…): https://shellshocklive.fandom.com/wiki/Modes (archive); https://en.wikipedia.org/wiki/ShellShock_Live
- Worms Sudden Death types: https://worms.fandom.com/wiki/Sudden_Death (archive); Worms scheme notes (Hysteria, Shopper, BnG): https://www.tus-wa.com/schemes/rules/, https://lee-mon.neocities.org/worms-armageddon
- Worms W.M.D cosmetics (hats, gravestones, speechbanks, victory dances): https://www.shacknews.com/article/96486/worms-wmd-all-outfits-voices-dances-and-gravestones
- Pocket Tanks weapon draft: https://en.wikipedia.org/wiki/Pocket_Tanks
- GunboundM (seasons, guilds): https://play.google.com/store/apps/details?id=com.DargomStudio.GunboundM.Global ; rank rewards: http://gunboundmguide.blogspot.com/2017/07/ranks.html
- Gunny (VN): https://vi.wikipedia.org/wiki/Gunny
- Tank Stars modes: https://tank-stars.fandom.com/wiki/Game_Modes

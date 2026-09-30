# Gunbound (Softnyx) rules and design research

Covers GunBound Classic / Thor's Hammer (2002) / World Champion (2006). Written 2026-09-30.

**About the sources.** StrategyWiki, GameFAQs, Neoseeker, Supercheats, TV Tropes, the fandom wikis, gitzwc.com and voz returned 403, 402 or empty pages to the fetch tool. The fetch tool also could not reach web.archive.org. Where one of those pages is cited, the facts come from the search engine's excerpt of that page, not a full read, and are marked "(snippet)". Anything taken from GunboundM (the 2017 mobile remake) or GunBound GGH (the 2025 remake) is labelled as such, because their numbers differ from the PC original. Facts I could not confirm from any source are marked **unconfirmed**.

---

## 1. Rank system

### Ordered rank list (PC Gunbound, highest to lowest)

Source: GunBound Classic private server, "Level & Award" page, https://gunboundclassic.net/pages/howto.php?sec=levels (full read). The same GP thresholds appear in https://www.battleforums.com/threads/gunbound.46564/ (full read) and in the Softnyx Canada forum excerpt https://www.tapatalk.com/groups/uber1/what-are-the-rankings-t2077.html (snippet).

| # | Rank icon (English) | Rule |
|---|---|---|
| 0 | Administrator / GM | staff only |
| 1 | Silver Dragon | top 1 player |
| 2 | Red Dragon | top 2–5 (4 people) |
| 3 | Blue Dragon | top 6–21 (16 people) |
| 4 | Diamond Wand ("Diamond Hole") | top 0.1% |
| 5 | Ruby Wand (red glowing sceptre) | top 0.2–1% |
| 6 | Sapphire Wand (blue sceptre) | top 2–3% |
| 7 | Violet Wand (purple sceptre) | top 4–6% |
| 8 | Gold Battle Axe + (gold double-sided axe +) | top 7–10% |
| 9 | Gold Battle Axe | top 11–20% |
| 10 | Silver Battle Axe + | top 21–30% |
| 11 | Silver Battle Axe | top 31–50% |
| 12 | Metal Battle Axe + | top 51–70% |
| 13 | Metal Battle Axe (double-sided) | 6900+ GP |
| 14 | Double Gold Axe | 6000 GP |
| 15 | Gold Axe | 5100 GP |
| 16 | Double Silver Axe | 4200 GP |
| 17 | Silver Axe | 3500 GP |
| 18 | Double Metal Axe | 2800 GP |
| 19 | Metal Axe | 2300 GP |
| 20 | Double Stone Hammer | 1800 GP |
| 21 | Stone Hammer | 1500 GP |
| 22 | Double Wooden Hammer | 1200 GP |
| 23 | Wooden Hammer | 1100 GP |
| 24 | Chick ("A Little Chick") | starting rank, below 1100 GP |

- New accounts start at **1000 GP**. Source: https://www.dlh.net/en/cheats/29444/gunbound.html
- Naming varies between sources. The two lowest icon pairs are called "Wood Axe / Stone Axe" by gunboundclassic.net and battleforums, and "Wooden Hammer / Stone Hammer" by the Softnyx Canada forum and the GameFAQs FAQ excerpt. Vietnamese players say "búa gỗ" (wooden hammer), so **Hammer** is the name that matches the icon.
- **How rank is computed:**
  - Everything up to Metal Battle Axe uses fixed GP thresholds.
  - Metal Battle Axe + through Diamond Wand are percentiles of all ranked players.
  - The dragons are absolute leaderboard positions: 1 / 4 / 16 players.
  - Rankings are recalculated once a day: 18:00 GMT+9 per gunboundclassic.net, 5:30 PM KST per dlh.net.
- **GunboundM (2017 mobile remake) rank ladder**, for comparison. Source: http://gunboundmguide.blogspot.com/2017/07/ranks.html
  - Order: Chick 0, Wooden Hammer 10, Double Wooden Hammer 30, Stone Hammer 60, Double Stone Hammer 160, Axe 310, Double Axe 510, Silver Axe 760, Double Silver Axe 1060, Gold Axe 1410, Double Gold Axe 1810, Battle Axe, Battle Axe+, Silver Battle Axe 6260, Silver Battle Axe+ 8660, Gold Battle Axe 11060, Gold Battle Axe+ 13860, Violet Wand 16660, Sapphire Wand 21660, Ruby Wand 27660, Diamond Wand 34660, Blue Dragon, Red Dragon 52660, Silver Dragon, **Gold Dragon** (new in M).
  - GP per battle in GunboundM: Rookie win +3 / loss 0, Pro win +10 / loss −2, Master win +25 / loss −5. Source: https://www.urgametips.com/2017/07/gunboundm-increase-league-rank-fast.html

### GP awarded per event (PC)

Sources: https://gunboundnet.proboards.com/thread/92/all-bonus-penaltiees (full read) and https://gunboundclassic.net/pages/howto.php?sec=levels. GP only goes up or down through these events.

- **Win:** 1v1 **+3 GP**, 2v2 **+6**, 3v3 **+9**, 4v4 **+12**. That is 3 GP per enemy player.
  - Win gold: 1v1 +100G, 2v2 +150G, 3v3 +200G, 4v4 +300G.
- **Kills:**
  - Kill ("Ending/Finish bonus"): +1 GP
  - Bunge kill (knocking an enemy off the map): +1 GP
  - Two kills in one turn ("Shot of God"): +4 GP
- **Total damage in the match:** over 1000 = +1 GP, over 2000 = +2 GP, over 3000 = +4 GP.
- **500+ damage in one shot:** +4 GP according to gunboundclassic.net. The proboards list gives it 0 GP. **Conflicting.**
- **Penalties:**
  - Suicide (falling off by yourself): −1 GP
  - 50+ damage to a teammate or yourself: −1 GP
  - Team kill: −2 GP
- No GP is lost for a plain loss in PC Gunbound. **Unconfirmed**; no source states a loss penalty.

### Vietnamese rank names

- **"gà con"** (chick): the starting rank. It became general Vietnamese gamer slang, where "gà" means a weak player.
  - https://vietgiaitri.com/4-4-aduka-solo-boomerang-va-nhung-hoai-niem-mot-thoi-ve-huyen-thoai-gunbound-ma-cac-game-thu-nho-mai-20210713i5885666/
  - https://2game.vn/quay-lai-thoi-leo-rank-tu-ga-con-bua-go-tro-len-voi-gunbound-m-vng-post165489.html
- **"búa gỗ"** (wooden hammer), **"rìu vàng"** (gold axe), **"trượng"** (wand/staff), **"Rồng bạc / Rồng đỏ / Rồng xanh"** (silver / red / blue dragon).
  - One article's phrasing: "Từ những búa gỗ, rìu vàng, trượng,… cho đến đỉnh cao của game là Rồng bạc".
  - https://www.xemgame.com/gunbound-m-goi-nhac-cam-giac-chinh-phuc-cac-moc-xep-hang-cua-gunbound-post237452.html
- Also used: "rìu gỗ, rìu bạc, rìu vàng, rìu đôi" (wood / silver / gold / double axe). "Rồng xanh" is the elite rank, with only the red and silver dragons above it.
  - https://2game.vn/goc-nhin-game-thu/gunbound-de-lai-nhung-ky-niem-kho-quen-trong-long-moi-game-thu
- My proposed Vietnamese labels for the full ladder (**unconfirmed**, but they follow the terms above):
  - Gà con → Búa gỗ → Búa gỗ đôi → Búa đá → Búa đá đôi → Rìu sắt → Rìu sắt đôi → Rìu bạc → Rìu bạc đôi → Rìu vàng → Rìu vàng đôi
  - → Rìu chiến sắt → Rìu chiến sắt+ → Rìu chiến bạc → Rìu chiến bạc+ → Rìu chiến vàng → Rìu chiến vàng+
  - → Trượng tím → Trượng lam (sapphire) → Trượng đỏ (ruby) → Trượng kim cương
  - → Rồng xanh → Rồng đỏ → Rồng bạc

---

## 2. Game modes and room options

### Modes

- **Solo:** each player has one life, and you win by eliminating the whole enemy team.
  - Dead players get a slot machine: three-in-a-row reels that can give gold, change the wind, or drop random items or bombs on the map.
  - https://en.wikipedia.org/wiki/Gunbound
  - https://en-academic.com/dic.nsf/enwiki/298794
- **Tag:** each player picks 2 mobiles and may switch once per turn (F7 key per battleforums).
  - The secondary mobile starts at **half HP**.
  - https://academickids.com/encyclopedia/index.php/Gunbound
  - https://www.battleforums.com/threads/gunbound.46564/
- **Score:** each team shares a pool of lives equal to **team size + 1**: 2v2 has 3, 3v3 has 4, 4v4 has 5.
  - A dead player drops back onto the map **4 turns** later. The "Power User 2" item cuts this to 2 turns.
  - The first team whose life counter hits 0 loses.
  - Sources: https://en-academic.com/dic.nsf/enwiki/298794 (Score lives), https://www.dlh.net/en/cheats/29444/gunbound.html (Score lives), http://projetogb.blogspot.com/2011/12/tutorial-para-iniciantes-em-gunbound.html (Power User)
  - Score was historically the most popular lobby mode: https://mmohuts.com/review/gunbound
- **Jewel:** jewels fall from the sky and are worth **5, 10, 25 or −5** points.
  - A −5 jewel turns into a +5 jewel after sitting for some turns.
  - Destroying a jewel takes, **in a single turn**: 100 damage for a ±5 jewel, 200 for a 10, 300 for a 25.
  - Players are invincible in Jewel mode (academickids). The first team to **100 points** wins.
  - StrategyWiki GunBound Classic/Game Modes (snippet): https://strategywiki.org/wiki/GunBound_Classic/Game_Modes
  - https://academickids.com/encyclopedia/index.php/Gunbound
- **Powerball (later):** like Score, but Teleport is the only usable item.
  - Balls fall from the sky and give temporary bonuses: Dual Ball (double shot), Gold Ball, Thunder Ball, Power/Force wave, Bomb.
  - http://projetogb.blogspot.com/2011/12/tutorial-para-iniciantes-em-gunbound.html
  - https://gamemelablog.wordpress.com/action-games/gunbound/
- Stage mode (a PvE mission beta) existed later. Same projetogb source.

### Room options

- **Sudden Death trigger turn:** 40, 56 or 72 turns (snippet from the Gunbound room guide, https://gunboundggh.com/guides/room/EN; that site is now shut down).
- **Once Sudden Death starts, items are disabled** and one of these applies:
  - **Double Death:** every shot fires twice; SS disabled.
  - **Big Bomb Death:** shots do more damage and destroy more ground; SS disabled.
  - **SS Death:** SS can be used every turn.
  - **No Death / Disabled:** Sudden Death never triggers.
  - Sources: https://www.battleforums.com/threads/gunbound.46564/, https://academickids.com/encyclopedia/index.php/Gunbound
- **SS cooldown:** after you fire your SS it is locked for **4 turns** according to most sources. Academickids says 9 turns counting every player's turns.
- **Item restrictions:** the room master can disable items before the match (https://en.wikipedia.org/wiki/Gunbound). The room guide excerpt mentions a slot-machine option of "Basic Bomb only" or "Attack Bomb" (snippet, gunboundggh room guide).
- **Mobile pick:** "Random" is the only way to get **Dragon, Knight or Phoenix**. Phoenix required Power User status or cash.
  - https://en.wikipedia.org/wiki/Mobile_(GunBound)
  - Vietnamese players remember the random dragon and horse (Knight) as legendary: https://vietgiaitri.com/4-4-aduka-solo-boomerang-va-nhung-hoai-niem-mot-thoi-ve-huyen-thoai-gunbound-ma-cac-game-thu-nho-mai-20210713i5885666/
- **Avatar on/off:** "avatar off" channels and servers disable avatar stat bonuses for fair games. https://mmohuts.com/review/gunbound
- **Map selection:** random or a chosen map, with 1v1 up to 4v4 (8 players). **Unconfirmed** as a room toggle, though maps are listed on StrategyWiki GunBound Classic/Maps.
- **Rooms by team size:** 1v1, 2v2, 3v3, 4v4, with a maximum of 8 players. https://mmohuts.com/review/gunbound
- **Servers by skill (later era):** Horus Spirit (beginners, bonus GP), DarkHover (intermediate), Dragons Land (advanced), Freedom Valley (all levels, avatar-on and avatar-off capitals). http://projetogb.blogspot.com/2011/12/tutorial-para-iniciantes-em-gunbound.html

---

## 3. Turn order and delay

- **Delay is a priority queue:** the player with the **lowest accumulated delay** acts next, so a player can act twice before a slower enemy.
  - The delay a turn costs is added to that player's running total.
  - StrategyWiki GunBound Classic/Delay (snippet): https://strategywiki.org/wiki/GunBound_Classic/Delay
  - https://gunboundclassic.net/pages/howto.php?sec=play
- **A turn's delay is:**
  - the mobile's base delay for the weapon used
  - plus the item's delay
  - plus time spent: **+10 delay per second** (Turtle **+12/s**)
  - It is measured in 0.01 increments (academickids).
  - Sources: https://academickids.com/encyclopedia/index.php/Gunbound, StrategyWiki Delay (snippet)
- **Weapon delay:** Shot 1 is lowest, Shot 2 higher, SS much higher. J.Frog's Shot 1 and Shot 2 cost the same.
  - Rough base values: about **800 (Shot 1), 900 (Shot 2), 1000–1500 (SS)**.
  - https://www.dlh.net/en/cheats/29444/gunbound.html
  - GameFAQs Delay Guide by psion0011 (snippet): https://gamefaqs.gamespot.com/pc/582632-gunbound/faqs/27330
- **Movement:** moving costs delay too, and the usual advice is "move as little as possible, shoot fast, avoid heavy weapons." The per-pixel number is **unconfirmed**.
  - https://www.battleforums.com/threads/gunbound.46564/
- **Changing the angle** between turns costs no delay (dlh.net).
- **Turn timer:** **20 seconds** to shoot in the original (academickids). GunboundM uses 30 seconds (https://sites.google.com/view/gbmessentials/home/glossary).
- **Avatar "Hourglass" stat:** reduces delay, about 0.6% per point (dlh.net). Some mobiles have innate item-delay modifiers from −28 to +32 (https://www.dlh.net/en/cheats/31951/gunbound.html).
- **Weather changes on the delay clock** rather than per player; see section 6.

---

## 4. Shot bonuses, gold and GP

Main source: the proboards list, https://gunboundnet.proboards.com/thread/92/all-bonus-penaltiees (full read). The GameFAQs Boomer FAQ and StrategyWiki excerpts give different gold numbers; they are shown where they differ.

| Bonus | Condition | Gold (proboards) | Gold (alt. source, snippet) | GP |
|---|---|---|---|---|
| Shot of God ("DK", double kill) | kill or bunge 2+ enemies in one turn | +500 | +500 | +4 |
| Bunge Shot Bonus | knock an enemy off the map | +100 | +100 | +1 |
| Ending / Finish Bonus | bring an enemy to 0 HP | +100 | +100 | +1 |
| Excellent Shot | 500+ damage in one turn | +50 | +100 | 0 (+4 per gbclassic) |
| Good Shot | 250–499 damage | +20 | +50 | 0 |
| Shot Bonus | 150–249 damage | +10 | +20 | 0 |
| Hurricane (Tornado) Bonus | shot passes through a tornado and does 50+ damage | +20 | +10 | 0 |
| High Angle Bonus | angle ≥ 70°, 2.5 s or more airtime, 50+ damage | +15 | +20 | 0 |
| Ultra High Angle Bonus | angle ≥ 70°, 4 s or more airtime, 50+ damage | +30 | +15 | 0 |
| Boomer Shot Bonus | boomerang path reverses back and forth | +20 | — | 0 |
| Back Shot Bonus | shot flies backwards, behind the mobile | +25 | +25 | 0 |
| 1000 / 2000 / 3000 total damage | cumulative damage in the match | +100 each | — | +1 / +2 / +4 |
| Win 1v1 / 2v2 / 3v3 / 4v4 | team wins | +100 / 150 / 200 / 300 | — | +3 / 6 / 9 / 12 |
| **Penalty:** suicide | fall off by yourself | −50 | — | −1 |
| **Penalty:** team damage | 50+ damage to an ally or yourself | −25 | — | −1 |
| **Penalty:** team kill | kill or bunge an ally | −50 | — | −2 |

- Alt. source (snippet): GameFAQs Boomer FAQ, https://gamefaqs.gamespot.com/pc/582632-gunbound/faqs/27223, and StrategyWiki Gunbound/Gameplay.
- A "Lightning bonus" is **unconfirmed**; no source lists one. Thor and Lightning weather add damage, which feeds the damage-tier bonuses.
- The bonus name pops up on screen with a sound when it triggers. This is widely remembered, but no written source describes it: **unconfirmed**.

---

## 5. Items

- **Slots:** 6 item slots per match. A weak item takes 1 slot and a strong item takes 2, so you can bring at most 6 small or 3 large items.
  - Items are picked before the match starts, cost nothing, and are consumed when used.
  - Sources: https://en.wikipedia.org/wiki/Gunbound, https://academickids.com/encyclopedia/index.php/Gunbound, https://www.battleforums.com/threads/gunbound.46564/
- **Later: "Item 2" slots.** A second bar with 12 default slots, expandable with cash. https://en-academic.com/dic.nsf/enwiki/298794
- **Using an item:** one item per turn, used before you shoot. **Unconfirmed**, but it is standard behaviour.
- **Solo/Tag:** treasure chests or the slot machine can give random 1-slot items (academickids).

Item table source: https://www.dlh.net/en/cheats/29444/gunbound.html. It agrees with the Neoseeker and GameFAQs excerpts except where noted.

| Item | Slots | Delay | Effect |
|---|---|---|---|
| Dual | 2 | 550 (600 in some versions) | Fire the selected weapon twice in one turn |
| Dual+ | 2 | 400 (250 in one FAQ) | Fire the selected weapon, then your other weapon |
| Teleport | 2 | 100 (150 in some versions) | Your shot's landing point becomes your new position |
| Team Teleport | 2 | 50 | Swap places with the teammate who has the lowest HP |
| Bandage / Energy 1 | 1 | 50 (100 in one FAQ) | Small heal, about 10%; bionic mobiles get about +5% more |
| Medkit / Energy 2 | 2 | 300 | Heals about 25%; bionic mobiles get about +5% more |
| Power Up | 1 | 150 | +33% damage for this shot |
| Blood | 1 | 0 | Costs 8% of your HP for +33% damage |
| Bunge Shot | 1 | 50 | +25% terrain destruction |
| Thunder (Thunderbolt) | 2 | 100 (200 in one FAQ) | A lightning bolt strikes at the impact point: extra damage and extra land destroyed |
| Wind Change | 1 | 100 (150 per another guide) | Reverses the wind direction |

- Other versions of these numbers:
  - The "Dual adds 600, Teleport 150" figures come from the StrategyWiki Delay snippet.
  - The 250 Dual+ and 100 Energy1 delays come from the GameFAQs FAQ by Tirodalth (snippet).
- **Item categories:** attack, defense (heal), weather (Wind Change), and utility (teleports). https://en-academic.com/dic.nsf/enwiki/298794
- **Vietnamese slang:** "tele" (teleport) and "dual". Duals can deal 500+ damage; "SS" is the special shot.

---

## 6. Weather ("forces" / satellites)

- **Weather queue:** up to 7 weather effects in Classic. The current effect is shown in the bottom-right, and the next one is visible.
  - **Each effect lasts as many turns as there are players at the start**: a 3v3 means 6 turns.
  - Force cycles are 1v1: 2 turns, 2v2: 4, 3v3: 6, 4v4: 8.
  - Which effects can appear depends on the map.
  - StrategyWiki GunBound Classic/Weather Effects (snippet): https://strategywiki.org/wiki/GunBound_Classic/Weather_Effects
  - https://en-academic.com/dic.nsf/enwiki/298794
- **Classic effects: Moon, Eclipse, Meteor, Thor, Force, Lightning, Tornado.** WC and later added Mirror, Dark Force, Joker, Wind and Land icons.
  - **Tornado (Hurricane):** a vertical blue vortex column. A shot that enters it zig-zags or spirals and exits with its direction changed, which can lengthen or shorten the shot. It triggers the Hurricane bonus.
  - **Lightning (Magnetic pole):** a vertical beam. A shot passing through becomes electrified, and on impact a bolt strikes from above down to the ground. That makes a small hole and damages nearby players.
  - **Force (Sun):** a vertical yellow beam. Shots passing through gain damage, and the longer the shot stays inside, the more damage it adds.
  - **Moon (Protection / Life Star):** every player recovers a little HP at the start of their turn. Bionic mobiles recover much more (double).
    - The later "Frost Moon" variant raises surface damage by 15% (projetogb).
  - **Eclipse (Ignorance / Dark Star):** items cannot be used, and shield regeneration stops, while it is active.
  - **Meteor (Wind Star):** when it first appears the wind changes randomly. It has no other effect.
  - **Thor (satellite):** while Thor weather is active, any shot that hits land or a player makes Thor fire a laser at the impact point.
    - Thor starts at level 1 and **levels up to 5 ("Max")** as it deals damage, so its laser grows stronger over the match.
    - Aduka's tracer shots command Thor directly, so Aduka gets stronger late in the game.
    - WC added an "Ice Thor" that throws ice clumps.
  - **Mirror (WC):** a trapezoid mirror that reflects any airborne shot touching it and adds damage.
  - **Dark Force:** the shot's damage is cut by 50%.
  - **Joker:** "?" icon, a random effect. **Unconfirmed** mechanics.
  - **Wind:** changes the wind's strength and direction.
  - **Land:** ice-pellet icon; effect **unconfirmed**.
  - **Destruction Moon (later):** a war satellite that attacks players and grows stronger with each hit (projetogb).
  - Sources for the effects above:
    - StrategyWiki Classic Weather (snippet)
    - https://en-academic.com/dic.nsf/enwiki/298794
    - http://projetogb.blogspot.com/2011/12/tutorial-para-iniciantes-em-gunbound.html
    - Gravity Game Link support article (snippet): https://support.gnjoy.id/hc/pt-br/articles/39653318602009
    - Thor levels (snippet): StrategyWiki weather and Tropedia
- "**Black hole**" is not in any Gunbound source I found. It is probably from another game (DDTank / Boom?): **unconfirmed / likely not Gunbound**.
- **Wind:** strength 0–26 in PC Gunbound, shown as an arrow and a number at the top of the screen. The 0–26 range is **unconfirmed**; guides reference winds up to the mid-20s. Wind direction is 360° (from the Vietnamese wind-coefficient charts).

---

## 7. Mobiles

- **Defense types:**
  - Mechanical: highest defense and slow. +4% resistance to impact, −4% to electric.
  - Shield: low HP, but a regenerating shield. +4% to laser, −4% to impact.
  - Bionic: weakest armor, but heal items and Moon heal double. +4% to electric, −4% to laser.
  - http://projetogb.blogspot.com/2011/12/tutorial-para-iniciantes-em-gunbound.html
- **Attack types:** Laser, Explosion, Impact, Electrical. https://en.wikipedia.org/wiki/Gunbound
- **Weapons:** each mobile has Shot 1, Shot 2 and SS.
- **Roster:** 20 mobiles in Classic (18 selectable plus 2 random-only). Later versions reached about 24–28.
- Lines marked (u) are from general knowledge or remake sources: **unconfirmed** for PC Classic. The GGH (2025 remake) source is https://www.joytify.com/blog/en-us/other/others-gunbound-ggh/.

**Roster:**

- **Armor Mobile:** the Mechanical all-rounder with high HP and a solid shell. Shot 2 fires 2 shells in a row (snippet). SS is a big high-damage shell (u).
- **Mage:** a floating Shield mobile with a strong regenerating shield and low HP. Its SS is a piercing wave (u).
- **Nak:** Shot 2 travels **underground** and bursts out under the target, ignoring cover. It can dig (Neoseeker Nak guide, snippet).
- **Trico:** fires **3 orbiting projectiles**. They do massive damage if all three land on one point, and their rotation depends on angle and power.
- **Bigfoot:** the land destroyer / "bunger". It fires a spray of small missiles (4 in GGH) that dig pits.
- **Boomer:** fires **boomerangs** that are very sensitive to wind. It is the king of backshots and Boomer-shot bonuses; see creedo's 70° backshot method in section 8.
- **Raon Launcher:** Mechanical. Fires small walking robots and mines that crawl to enemies or wait as proximity mines.
- **Lightning:** a Shield mobile with 300 shield level. Its shots call **lightning strikes** from the sky at the impact point. Weak to impact (Boomer, Turtle, Ice). GameFAQs Lightning guide (snippet).
- **J.D:** a Shield mobile with laser shots. Shot 2 is a reflecting laser (GGH). Balanced and beginner-friendly (u).
- **A.Sate:** a **satellite** follows it and fires laser beams where you aim. The shield regenerates about 20/turn (GGH).
- **Ice (Mammoth), Vietnamese "Voi":** Bionic. Low delay and low damage, with a precise ice shot. Hard to aim but cheap (u).
- **Turtle, Vietnamese "Rùa":** Bionic, water shots. The **only mobile with 12 delay/sec** instead of 10 (StrategyWiki Delay snippet).
- **Grub:** Bionic, fires **bouncing** energy balls. Its SS needs team setup (Lightning guide snippet).
- **Aduka:** Metallic and fires backwards. Shots are **Thor tracers**: Thor does the damage, so Aduka grows stronger as Thor levels up. Shot 2 goes underground. The 4v4 Aduka meta was iconic in Vietnam.
- **Kalsiddon:** its shots depend on precise airtime (u: shots hang and dive).
- **J.Frog, Vietnamese "Ếch":** Bionic and mobile, with high jumps. Shot 1 and Shot 2 have the same delay. The lightest shot: 70° needs only about 2.55 bars.
- **Dragon, Vietnamese "Rồng":** **random-only** super mobile. Very strong, and immune to many shot types (GGH).
- **Knight, Vietnamese "Ngựa" (horse):** **random-only**. Shoots swords that fly to the target.
- **Phoenix:** random-only for Power Users / paid through the EX item. It revives (u).
- **Later additions:** Tiburon, Maya, Wolf, Blue Whale, Frank. https://en.wikipedia.org/wiki/Mobile_(GunBound)

**Vietnamese mobile nicknames** (https://kissgamepr.forum-viet.com/t759-topic, https://igunbound.blogspot.com/2017/12/cong-thuc-ban-tat-ca-cac-xe-gunbound.html):

- Rùa = Turtle
- Voi = Ice/Mammoth
- Điện = Lightning
- Ếch = J.Frog
- Rồng = Dragon
- Ngựa = Knight
- Armour, Aduka, Mage, JD, Boomer, Grub, Nak, Trico and Raon keep their English names.

---

## 8. What made it fun socially, and power-user tricks

### Social and economy

- **Avatar shop:** clothes, hats, glasses, flags, backgrounds and so on. They are bought with gold earned in battle, or with cash for premium items. They give stat bonuses (https://www.battleforums.com/threads/gunbound.46564/, https://www.dlh.net/en/cheats/29444/gunbound.html):
  - Sword: attack %
  - Heart: HP %
  - Shield: defense %
  - Star: gold earned %
  - Tyre/Wheel: movement %
  - Mountain: climbing
  - Target/Crosshair: angle range
  - Hourglass: less delay
  - Stats cap at 50 per stat (https://www.dlh.net/en/cheats/31951/gunbound.html). Avatars later enchant up to level 20.
  - "Avatar off" channels keep games fair (https://mmohuts.com/review/gunbound).
- **Guilds:** Softnyx had guild creation, a guild list and **guild ranking** pages.
  - http://gunbound.softnyx.net/Ranking/Guild.aspx
  - http://gunbound.softnyx.net/Guild/GuildList.aspx
  - Vietnamese players ran guild-vs-guild matches ("độ kèo") in internet cafés ("quán nét"), with friends teaching newcomers angles and wind. https://2game.vn/goc-nhin-game-thu/gunbound-de-lai-nhung-ky-niem-kho-quen-trong-long-moi-game-thu
- **Dead players stay engaged:** the Solo slot machine lets them earn gold, change the wind or drop bombs. https://en.wikipedia.org/wiki/Gunbound
- **Nostalgia hooks for Vietnamese players:**
  - Climbing from "gà con" upward
  - The random Dragon and Knight ("rồng", "ngựa")
  - "4-4 Aduka" on the harbour map
  - "Solo Boomerang" wind duels
  - Metamine as the hardest map, with shifting wind, lightning and tornados
  - Sources: https://vietgiaitri.com/4-4-aduka-solo-boomerang-va-nhung-hoai-niem-mot-thoi-ve-huyen-thoai-gunbound-ma-cac-game-thu-nho-mai-20210713i5885666/ and the 2game.vn article above
- **Chat, emotes, buddy list:**
  - Lobby and room chat, whispers, a buddy list, and team chat in match: **unconfirmed** (no written source found).
  - The "Power User" paid status gave perks such as faster Score respawn (projetogb) and Phoenix access (Wikipedia).
- **Bonus pop-ups and gold after every shot** make each turn feel rewarding. See section 4.

### Aiming formulas

- **Screen = 8 bars.** Players measure distance by splitting the screen into 8 parts, where 1/8 of the screen equals 1 power bar. Measure from the centre of your mobile to the target.
  - https://igunbound.blogspot.com/2017/12/cong-thuc-ban-tat-ca-cac-xe-gunbound.html
- **Fixed 70° method** ("góc 70"): keep the angle at 70°, use a fixed power per mobile for a given distance, and correct only the **angle** for wind.
  - The wind correction is wind strength × a coefficient from a 360° wind chart. Example: crosswind at 3 o'clock, coefficient 0.63, wind 10 → +6.3°.
  - Full-screen 70° power at zero wind (Vietnamese guides; the two sources differ by ±0.1):
    - Nak 3.4
    - Trico 3.2
    - Bigfoot 3.2
    - A.Sate 3.05
    - Turtle / Armor 3.0
    - Mage 2.95
    - Kalsiddon / Knight 2.9
    - Aduka 2.8
    - Lightning 2.75
    - Ice / JD / Boomer / Grub 2.7
    - J.Frog / Dragon 2.55
  - Sources: https://igunbound.blogspot.com/2017/12/cong-thuc-ban-tat-ca-cac-xe-gunbound.html, https://kissgamepr.forum-viet.com/t759-topic
- **"Standard angle" per mobile** (góc chuẩn): Nak, Trico and Raon 68°; Turtle, Armor and A.Sate 70°; Mage, Kalsiddon and Knight 71°; Aduka and Lightning 72°; Ice, JD and Boomer 73°; Grub 74°; J.Frog and Dragon 75°.
  - https://kissgamepr.forum-viet.com/t759-topic
- **High-angle method (80–89°):** fire at full power and change only the angle.
  - Roughly **1 screen of distance ≈ 9°**, so 2 screens away means 90 − 18 = 72°.
  - Wind 3+ correction: step back one mobile length and add (wind − 1)°.
  - https://creedo.gbgl-hq.com/angles.php
- **Boomer 70° backshot** (creedo):
  - At 70° with a "base wind", the power-bar length equals the horizontal distance to the target, so players measure it with their fingers on the screen.
  - Another version: start at 60°, lower the angle by wind × 0.5 for a crosswind to get the "TK angle", raise 1° per distance unit (full screen = 30 units), and fire at 2.5 bars.
  - Maximum backshot range is 66° at 2.9 bars.
  - https://creedo.gbgl-hq.com/backshotformula.php
  - https://creedo.gbgl-hq.com/boomer_backshot_70_unsober.php
- **Other tricks:**
  - Delay management: shoot fast, don't move, avoid SS and Dual when you need the next turn.
  - Bunge: dig under enemies at map edges.
  - Team-teleport the lowest-HP ally out of danger.
  - Shots through Tornado and Force for the bonus and extra damage.
  - "30-degree formula": no written source found, **unconfirmed**. The common Vietnamese formulas are 70° and the high-angle methods.

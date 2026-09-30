# Xe Roster v1 — 10 Animal Xe

In-game language: Vietnamese. Design notes: English.

## Gunbound reference (what we keep)

- Side-view 2D artillery, destructible terrain, turn-based.
- Each "mobile" (xe) has: angle range, attack power, durability (HP + shield/armor), wind sensitivity, movement, and 3 shots: **Shot 1**, **Shot 2**, **SS**.
- **Delay system**: every action adds delay; the player with the lowest total delay goes next. Strong shots = long delay. This is the core balance lever.
- Art style: 2D sprites that look pre-rendered 3D (chunky, glossy, cartoon). We copy the *feel*, not any original art or names.

## Stat system

| Stat (VN) | Meaning | Range |
|---|---|---|
| Máu (HP) | Hit points | 800–1300 |
| Giáp | Damage reduction | 0–30% |
| Góc bắn | Allowed firing angle | degrees |
| Công phá | Base damage scale | 1–10 |
| Cơ động | Move distance / slope climb | 1–10 |
| Chịu gió | Wind effect on shots (lower = less drift) | 0.5–1.5× |
| Delay | Turn cost (Shot 1 / Shot 2 / SS) | 600–1200 |

**SS rule:** each xe has a **Thanh Nộ** (rage bar) that fills from damage dealt + taken. SS is usable when full, then resets.

Balance rule: Công phá + Độ bền + Cơ động ≈ 20 for every xe (ratings 1–10).

## Overview

| # | Xe | Animal | Role | Góc bắn | Công phá | Độ bền | Cơ động | Chịu gió | Độ khó |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Xe Rồng Lửa | Dragon | Heavy artillery | 30–70° | 9 | 7 | 4 | 1.0× | ★★☆ |
| 2 | Xe Kỳ Lân | Unicorn | Support / healer | 20–80° | 5 | 6 | 9 | 0.7× | ★★☆ |
| 3 | Xe Kim Quy | Golden turtle | Tank / low arc | 10–45° | 6 | 10 | 4 | 1.2× | ★☆☆ |
| 4 | Xe Phượng Hoàng | Phoenix | Burst + revive | 40–85° | 8 | 5 | 7 | 1.3× | ★★★ |
| 5 | Xe Voi Chiến | War elephant | Terrain breaker | 25–60° | 7 | 9 | 4 | 0.8× | ★☆☆ |
| 6 | Xe Bạch Tuộc | Octopus | Control / debuff | 30–75° | 6 | 7 | 7 | 1.1× | ★★★ |
| 7 | Xe Bọ Cạp | Scorpion | Poison DoT | 20–65° | 7 | 6 | 7 | 0.9× | ★★☆ |
| 8 | Xe Cú Đêm | Owl | Sniper | 45–89° | 6 | 4 | 10 | 0.5× | ★★★ |
| 9 | Xe Cá Mập Cát | Sand shark | Digger / underground | 15–55° | 8 | 6 | 6 | 1.0× | ★★☆ |
| 10 | Xe Tề Thiên | Monkey King | Trickster / multi-hit | 20–75° | 7 | 5 | 8 | 1.4× | ★★★ |

---

## 1. Xe Rồng Lửa (Dragon)
A red-gold dragon coiled around a cannon turret; the cannon is its mouth.
- Máu 1150 · Giáp 15% · Delay 780 / 850 / 1150
- **Shot 1 – Hỏa Cầu:** big fireball, 1 crater, leaves burning ground for 1 turn (small damage to anyone standing in it).
- **Shot 2 – Long Trảo:** splits into 3 claw-shaped fireballs at the top of the arc, spreading forward.
- **SS – Thiên Long Giáng:** a dragon spirit dives straight down from the sky onto the landing point. Largest crater in the game.

## 2. Xe Kỳ Lân (Unicorn)
White unicorn with a crystal horn and rainbow mane; very mobile.
- Máu 1000 · Giáp 10% · Delay 650 / 720 / 1050
- **Shot 1 – Tia Sừng:** fast, flat crystal bolt; low wind drift.
- **Shot 2 – Cầu Vồng:** slow rainbow arc; damages enemies and heals allies within the blast (+80 HP).
- **SS – Thánh Quang:** column of light on the target; heavy damage to enemies, heals all allies inside +200 HP, removes poison and burn.

## 3. Xe Kim Quy (Golden Turtle — legend of An Dương Vương)
Giant golden turtle carrying a stone fortress on its shell.
- Máu 1300 · Giáp 30% · Delay 800 / 820 / 1200
- **Shot 1 – Mai Nảy:** shell fragment that bounces twice along the ground before exploding.
- **Shot 2 – Khiên Vàng:** weak shot; gives itself +20% armor for 1 turn.
- **SS – Nỏ Thần:** fires 3 golden crossbow bolts in a flat straight line that pierce through terrain, hitting every tank in the line.

## 4. Xe Phượng Hoàng (Phoenix)
Blazing bird perched on a slim launcher; fragile but explosive.
- Máu 850 · Giáp 0% · Delay 700 / 800 / 1100
- **Shot 1 – Lông Lửa:** 2 flaming feathers fired back to back.
- **Shot 2 – Cánh Lửa:** at the arc peak, splits into 2 that fly left and right.
- **SS – Hỏa Điểu:** phoenix flies in a straight line to the target and explodes, burning a wide area.
- **Passive – Tái Sinh:** once per match, revives at 25% HP when killed.

## 5. Xe Voi Chiến (War Elephant — Hai Bà Trưng era)
Armored war elephant with a bronze tower on its back.
- Máu 1250 · Giáp 20% · Delay 820 / 880 / 1150
- **Shot 1 – Ngà Khoan:** tusk drill; pierces terrain a short way before exploding.
- **Shot 2 – Vòi Rồng:** water blast that pushes the hit tank back a distance.
- **SS – Dậm Đất:** earthquake; the shockwave travels along the terrain surface, destroying ground and damaging every tank it passes.

## 6. Xe Bạch Tuộc (Octopus)
Purple octopus in a glass diving-bell tank, tentacles as cannons.
- Máu 1050 · Giáp 10% · Delay 720 / 800 / 1100
- **Shot 1 – Mực Đen:** ink bomb; the hit player gets no aiming-line preview and no wind indicator next turn.
- **Shot 2 – Tám Xúc Tu:** splits into 8 small bomblets scattered over the target area.
- **SS – Kraken Kéo:** giant tentacle grabs the hit tank and drags it toward the octopus (can pull enemies off cliffs).

## 7. Xe Bọ Cạp (Scorpion)
Black-emerald scorpion; the tail is the cannon.
- Máu 1000 · Giáp 15% · Delay 700 / 760 / 1100
- **Shot 1 – Nọc Độc:** poison 40 HP/turn for 3 turns.
- **Shot 2 – Càng Kẹp:** lands, then crawls along the ground toward the nearest enemy before exploding.
- **SS – Đuôi Tử Thần:** very high sting that ignores armor and applies strong poison (80 HP/turn, 3 turns).

## 8. Xe Cú Đêm (Night Owl)
Small owl with huge glowing eyes on a light sniper rig.
- Máu 800 · Giáp 0% · Delay 620 / 700 / 1000
- **Shot 1 – Lông Vũ:** light feather dart, barely affected by wind (0.5×).
- **Shot 2 – Mắt Đêm:** marks the target; the next hit on it by any ally deals +30% damage.
- **SS – Bầy Cú:** 5 owls dive one after another on the same point; each hit is small, stacking into big damage.

## 9. Xe Cá Mập Cát (Sand Shark)
Shark with a drill nose that "swims" through the ground.
- Máu 1050 · Giáp 10% · Delay 760 / 820 / 1150
- **Shot 1 – Răng Cưa:** tunnels through terrain in a straight line, then explodes.
- **Shot 2 – Vây Lướt:** skims along the terrain surface like a fin, exploding on the first tank it touches.
- **SS – Hàm Cá Mập:** after 1 second, a giant shark jaw bursts up from under the target, biting a deep crater (the target may fall).

## 10. Xe Tề Thiên (Monkey King)
Monkey in gold armor riding a cloud-shaped cart, holding the Như Ý staff.
- Máu 900 · Giáp 5% · Delay 680 / 760 / 1100
- **Shot 1 – Chuối Boomerang:** banana that curves hard with the wind; masters can hit behind cover.
- **Shot 2 – Gậy Như Ý:** staff extends in a straight line at the firing angle (no gravity), limited range.
- **SS – Phân Thân:** 3 monkey clones appear in the sky and each fire a Shot 1 at once.

---

## Open questions
- 100 players: 100 online at once, but each match up to 8 (4v4) like Gunbound? Or a special 100-player mode?
- Art: 2D gameplay with pre-rendered 3D-look sprites (recommended), or true 3D models (Three.js)?

---
name: gen-game-art
description: Generate Thú Chiến art with Gamma (new or redesigned xe, projectile sheets, pilots, props) using the proven prompt template, then check facing/style and wire the sprite into the game. Use whenever the user asks to gen/vẽ lại/redesign a xe, đạn, nhân vật or any sprite.
---

# Generating game art (Gamma)

Gamma `generate_image` costs **70 credits per image** (check `credits.remaining` in the result and tell the user).
Put several sprites (or several design variants) on ONE sheet. Never use `type: "abstract"`.

## 1. Prompt (copy this template, only change the [UNIT]/[ITEMS] part)

```
[STYLE] 2D game sprite sheet, early-2000s Korean online game art style (Gunbound mobiles) mixed with modern anime chibi, chunky toy-like proportions, thick hand-inked black outlines around every shape, bright flat colors with cel shading and small white highlights, playful, wildly stylized and unconventional: NOT a realistic animal, a fantasy battle-mount character with a strong gimmick. The weapons are themed to the concept.
[LAYOUT] Exactly 3 separate battle mounts in ONE row, evenly spaced with wide empty gaps between them, same scale, full body visible, isolated on a flat solid pure magenta #FF00FF background. ALL THREE FACE RIGHT in side view: head, eyes, snout and weapons all turned toward the RIGHT edge of the image. Each walks/flies on its own (no tank treads, no wheels). Each has a small EMPTY saddle seat on its back. No pilot, no rider, no text, no captions, no numbers, no ground, no shadow. Do not use any magenta or pink on the characters.
[CONCEPTS, left to right] 1. … 2. … 3. …
```

- `type: "illustration"`, `sizePreset: "banner"` for xe (3 in a row); `social-square` / `story` for projectile grids (3x3 / 3x5, "every projectile flies to the RIGHT").
- Background: magenta `#FF00FF`, or pure green `#00FF00` when the subject is pink/purple. Say "do not use <key colour> on the characters".
- **Phá cách:** the user rejects plain realistic animals ("không có gì đặc biệt"). Give every xe a gimmick (volcano back, boombox cannon, steam engine body…). Offer 3 different concepts on one sheet, not 3 colour swaps.
- Keep the xe's mechanics readable in the art: e.g. Voi has an upper barrel (back) and a lower barrel (trunk). Check `shared/xe.js` for the shots and `muzzle` offsets before writing the prompt.
- Names must come from known sources (Tây Du Ký…), not invented puns.

## 2. Check BEFORE showing the user

1. Download to `art-src/<name>-vN.jpg` (`curl -s -o …`), make a 1400 px preview in the scratchpad (`sips -Z 1400`) and look at it.
2. **Facing:** Gamma often ignores "facing right". If heads/trunks/muzzles point left, mirror the sheet (`sips -f horizontal`) when the weapons are symmetric, otherwise regenerate. Never show the user a left-facing option.
3. **Style:** thick black ink outlines like the other xe (compare with `public/assets/sheets/xe5.jpg`). Flat vector art without outlines = regenerate.
4. Then show the (mirrored) sheet with SendUserFile and pick the best concept yourself unless it is a pure taste call.

## 3. Wire it in (see docs/TECH_DESIGN.md §6)

- Sheet into `public/assets/sheets/<new-name>.jpg` at 1400x781 (`sips -z 781 1400`). Use a NEW filename when replacing art: browsers cache assets.
- `public/js/assets.js`: a sheet entry with hand `boxes` on the 1400x781 view (+ `erase` rects for neighbours' bits), loaded after the old sheet so it overrides; then re-measure `SEATS`, `OCCLUDE`, `RIGS` for that xe on a grid overlay of the trimmed sprite.
- `public/js/art.js`: `XE_PARTS` anchors (fx), `SIZE_K` if it comes out small. `shared/xe.js`: `muzzle` offsets so shots leave the drawn barrels (editing `shared/` restarts the live dev server — batch and warn).
- Render the xe with a rider (`xeSprite(id, look)`) next to others in the browser pane and compare size/seat. Run `node tools/test-shots.mjs`, update docs, commit, push.

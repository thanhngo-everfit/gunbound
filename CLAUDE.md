# Thú Chiến

Gunbound-style 5v5 artillery web game for internal company play. All in-game text is Vietnamese.

**Read first:** [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md) (design, Gunbound learnings, roster, rules) and [docs/TECH_DESIGN.md](docs/TECH_DESIGN.md) (architecture, protocol, art pipeline, testing). Keep both up to date when you change behaviour.

Rules that matter:
- Match real Gunbound (screenshots/video) rather than designing from memory. Check the reference before changing visuals or feel.
- The user plays on the live `npm run dev` server. Editing `server/` or `shared/` restarts it and ends every match, so batch those edits and say so. `public/` edits only need a reload.
- Test in your own room, named "… (Claude)", joined by id. Never join other people's rooms.
- Balance numbers live in `shared/xe.js`. Painted maps need `node tools/build-maps.mjs` after changing a terrain image.
- Gamma images cost 70 credits each. Put many sprites on one sheet, and never use the "abstract" type.
- Vietnamese diacritics clip with a tight line-height; keep line-height ≥ 1.35.

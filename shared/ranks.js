// Rank ladder, shared so the client can show the full table.
// Gunbound-style ladder (checked against the Gunbound WC level table and Gunbound M VN names, 2026-09-30):
// Gà Con → Búa Gỗ → Búa Đá → Rìu Sắt/Bạc/Vàng (each with a "Đôi" step) → Gậy Tím/Ngọc Bích/Hồng Ngọc/Kim Cương
// by GP, and the top of the leaderboard wears dragons (Gunbound: 1 white, 4 red, 16 blue; scaled for one office).
// GP only goes up, so everyone keeps climbing: 2 per match, 10 per win, 3 per kill.
export const RANKS = [
  [0, 'chick', 'Gà Con'], [20, 'wood', 'Búa Gỗ'], [45, 'wood2', 'Búa Gỗ Đôi'], [80, 'stone', 'Búa Đá'], [120, 'stone2', 'Búa Đá Đôi'],
  [170, 'iron', 'Rìu Sắt'], [230, 'iron2', 'Rìu Sắt Đôi'], [300, 'silver', 'Rìu Bạc'], [380, 'silver2', 'Rìu Bạc Đôi'],
  [470, 'gold', 'Rìu Vàng'], [570, 'gold2', 'Rìu Vàng Đôi'],
  [700, 'violet', 'Gậy Tím'], [850, 'sapphire', 'Gậy Ngọc Bích'], [1000, 'ruby', 'Gậy Hồng Ngọc'], [1200, 'diamond', 'Gậy Kim Cương'],
];
// leaderboard places that wear a dragon instead (needs DRAGON_MIN_GAMES matches)
export const DRAGONS = [[1, 'dragonW', 'Rồng Trắng'], [3, 'dragonR', 'Rồng Đỏ'], [6, 'dragonB', 'Rồng Xanh']];
export const DRAGON_MIN_GAMES = 10;
export const RANK_LIST = [...RANKS.map(([gp, id, name]) => ({ id, name, gp })), ...[...DRAGONS].reverse().map(([top, id, name]) => ({ id, name, top }))]; // low → high;

export const gpOf = s => (s.games || 0) * 2 + (s.wins || 0) * 10 + (s.kills || 0) * 3;

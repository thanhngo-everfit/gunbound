// Trang phục (Gunbound avatar items), phase 1: a few free items per slot, drawn over the four base pilots.
// A player's "look" travels everywhere the old pilot id did (the `gender` field), as one short string:
//   "<pilot>" or "<pilot>.h<n>.g<n>.s<n>"  e.g. "f2.h3.g1" = pilot Nữ 2, wizard hat, aviator sunglasses
// so the server only has to validate it, and every drawing path keys its cache on it.
export const PILOTS = ['m', 'f', 'm2', 'f2'];
export const PILOT_NAMES = { m: 'Nam 1', f: 'Nữ 1', m2: 'Nam 2', f2: 'Nữ 2' };

export const SLOTS = [
  { key: 'h', name: 'Mũ', icon: '🎩' },
  { key: 'g', name: 'Kính', icon: '🕶' },
  { key: 's', name: 'Áo', icon: '👕' },
];
// n = cell number on public/assets/sheets/outfits.jpg (row = slot, column = n - 1)
export const ITEMS = {
  h: [
    { n: 1, name: 'Nón Lá' }, { n: 2, name: 'Vương Miện' }, { n: 3, name: 'Mũ Phù Thuỷ' },
    { n: 4, name: 'Mũ Cướp Biển' }, { n: 5, name: 'Mũ Len Tai Mèo' },
  ],
  g: [
    { n: 1, name: 'Kính Phi Công' }, { n: 2, name: 'Kính Trái Tim' }, { n: 3, name: 'Kính Pixel' },
    { n: 4, name: 'Kính Tròn' }, { n: 5, name: 'Kính 3D' },
  ],
  s: [
    { n: 1, name: 'Giáp Hiệp Sĩ' }, { n: 2, name: 'Áo Choàng Siêu Nhân' }, { n: 3, name: 'Vest Nơ Đỏ' },
    { n: 4, name: 'Áo Đấu Sao Vàng' }, { n: 5, name: 'Áo Phao' },
  ],
};

// "f2.h3.g1" → { pilot: 'f2', h: 3, g: 1, s: 0 } (unknown parts are dropped)
export function parseLook(look) {
  const [pilot, ...parts] = String(look || '').split('.');
  const out = { pilot: PILOTS.includes(pilot) ? pilot : 'm', h: 0, g: 0, s: 0 };
  for (const p of parts) {
    const slot = p[0], n = Number(p.slice(1));
    if (ITEMS[slot]?.some(it => it.n === n)) out[slot] = n;
  }
  return out;
}
export const lookString = ({ pilot, h, g, s }) => [pilot, h && `h${h}`, g && `g${g}`, s && `s${s}`].filter(Boolean).join('.');
export const cleanLook = look => lookString(parseLook(look));

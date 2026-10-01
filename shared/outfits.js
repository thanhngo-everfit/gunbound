// Trang phục (Gunbound avatar items), phase 1: a few free items per slot, drawn over the four base pilots.
// A player's "look" travels everywhere the old pilot id did (the `gender` field), as one short string:
//   "<pilot>" or "<pilot>.h<n>.c<n>.g<n>.s<n>"  e.g. "f2.h3.c5.g1" = pilot Nữ 2, spiky hair, dyed blue, aviator shades
// so the server only has to validate it, and every drawing path keys its cache on it.
export const PILOTS = ['m', 'f', 'm2', 'f2'];
export const PILOT_NAMES = { m: 'Nam 1', f: 'Nữ 1', m2: 'Nam 2', f2: 'Nữ 2' };

// User 2026-10-01: hats looked pasted on ("lỏ"), so the head slot is the hairstyle itself, cut from the base pilots
// (Gunbound's Head items are hairstyles too), plus a hair colour painted into it; glasses stay.
export const SLOTS = [
  { key: 'h', name: 'Kiểu tóc', icon: '💇' },
  { key: 'c', name: 'Màu tóc', icon: '🎨' },
  { key: 'g', name: 'Kính', icon: '🕶' },
  { key: 's', name: 'Áo', icon: '👕' },
];
// glasses are drawn in code (public/js/outfit-art.js)
export const ITEMS = {
  // each hairstyle is one base pilot's hair (pilot), worn on another head. Nữ 2's twin tails hang over her arms,
  // so they can be lent to others (drawn behind the body) but not taken off her: her hair only takes a colour.
  h: [
    { n: 1, name: 'Tóc Rối', pilot: 'm' }, { n: 2, name: 'Tóc Búi', pilot: 'f' },
    { n: 3, name: 'Tóc Nhím', pilot: 'm2' }, { n: 4, name: 'Tóc Hai Bím', pilot: 'f2' },
  ],
  c: [
    { n: 1, name: 'Đen Tuyền' }, { n: 2, name: 'Vàng Kim' }, { n: 3, name: 'Bạch Kim' }, { n: 4, name: 'Đỏ Rực' },
    { n: 5, name: 'Xanh Biển' }, { n: 6, name: 'Tím Mộng' }, { n: 7, name: 'Xanh Lá' }, { n: 8, name: 'Hồng Phấn' },
  ],
  g: [
    { n: 1, name: 'Kính Phi Công' }, { n: 2, name: 'Kính Trái Tim' }, { n: 3, name: 'Kính Pixel' },
    { n: 4, name: 'Kính Tròn' }, { n: 5, name: 'Kính 3D' },
  ],
  // tops are painted into the base pilot's white tee (exact fit), except the classic aviator set
  s: [
    { n: 1, name: 'Áo Đấu Sao Vàng' }, { n: 2, name: 'Áo Sọc Thuỷ Thủ' }, { n: 3, name: 'Áo Siêu Nhân' },
    { n: 4, name: 'Áo Rằn Ri' }, { n: 5, name: 'Áo Hoa Hawaii' }, { n: 6, name: 'Giáp Hiệp Sĩ' },
    { n: 7, name: 'Áo Phao' }, { n: 8, name: 'Bộ Phi Công', classic: true },
  ],
};

export const KEEP_HAIR = new Set(['f2']);
// "f2.h3.g1" → { pilot: 'f2', h: 3, g: 1, s: 0 } (unknown parts are dropped)
export function parseLook(look) {
  const [pilot, ...parts] = String(look || '').split('.');
  const out = { pilot: PILOTS.includes(pilot) ? pilot : 'm', h: 0, c: 0, g: 0, s: 0 };
  for (const p of parts) {
    const slot = p[0], n = Number(p.slice(1));
    if (ITEMS[slot]?.some(it => it.n === n)) out[slot] = n;
  }
  if (KEEP_HAIR.has(out.pilot)) out.h = 0;
  return out;
}
export const lookString = ({ pilot, h, c, g, s }) => [pilot, h && `h${h}`, c && `c${c}`, g && `g${g}`, s && `s${s}`].filter(Boolean).join('.');
export const cleanLook = look => lookString(parseLook(look));

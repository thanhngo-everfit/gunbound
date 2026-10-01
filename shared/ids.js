// Stable player id from a display name, computed the same way by the Vercel functions and the host's browser
// (the Ably clientId is the name, so the room host can derive who sent a command without trusting the payload).
export function pidOf(name) {
  let h = 0x811c9dc5;
  for (const ch of String(name).toLowerCase()) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return 'u' + h.toString(36);
}
export const cleanName = s => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 16);
export const PILOTS = ['m', 'f', 'm2', 'f2'];
export const cleanGender = g => (PILOTS.includes(g) ? g : 'm');

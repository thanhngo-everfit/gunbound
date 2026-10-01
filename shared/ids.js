// Stable player id from a display name, computed the same way by the Vercel functions and the host's browser
// (the Ably clientId is the name, so the room host can derive who sent a command without trusting the payload).
export function pidOf(name) {
  let h = 0x811c9dc5;
  for (const ch of String(name).toLowerCase()) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return 'u' + h.toString(36);
}
export const cleanName = s => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 16);
// the `gender` field carries the player's whole look: pilot + outfit items (shared/outfits.js)
import { cleanLook, PILOTS } from './outfits.js';
export { PILOTS };
export const cleanGender = cleanLook;
